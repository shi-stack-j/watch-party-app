import request from 'supertest';
import bcrypt from 'bcryptjs';
import { io as ClientSocket } from 'socket.io-client';
import { app, server } from '../index';
import { prisma } from '../config/prisma';

const TEST_PORT = 5055;

describe('Phase 3 Authentication & Database Integration Test Suite', () => {
  let serverInstance: ReturnType<typeof server.listen>;
  const testUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'SecurePassword123!',
  };

  let sessionCookie: string;

  beforeAll((done) => {
    serverInstance = server.listen(TEST_PORT, () => {
      done();
    });
  });

  afterAll(async () => {
    // Cleanup created test user
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test_' } },
    });
    await prisma.$disconnect();
    serverInstance.close();
  });

  it('1. Input Validation: rejects invalid email or missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'tu', email: 'invalid-email', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Validation failed');
  });

  it('2. Successful Signup: creates user in MySQL and returns safe user object', async () => {
    const res = await request(app).post('/api/auth/signup').send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data.username).toBe(testUser.username);
    expect(res.body.data).not.toHaveProperty('passwordHash');

    // Store session cookie from signup response
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    sessionCookie = cookies[0];
  });

  it('3. Password Hashing: verifies password is stored hashed in MySQL with bcrypt', async () => {
    const dbUser = await prisma.user.findUnique({
      where: { email: testUser.email.toLowerCase() },
    });

    expect(dbUser).not.toBeNull();
    expect(dbUser?.passwordHash).not.toBe(testUser.password);
    const isBcryptMatch = await bcrypt.compare(testUser.password, dbUser!.passwordHash);
    expect(isBcryptMatch).toBe(true);
  });

  it('4. Duplicate Email Rejection: rejects signup with existing email', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        username: `unique_${Date.now()}`,
        email: testUser.email,
        password: 'Password123!',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('already exists');
  });

  it('5. Current User Endpoint (GET /api/auth/me): succeeds with session', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', [sessionCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  it('6. Logout (POST /api/auth/logout): invalidates session', async () => {
    const res = await request(app).post('/api/auth/logout').set('Cookie', [sessionCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('7. Current User Endpoint without session: returns 401 Unauthorized', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('8. Incorrect Password Login: returns 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('9. Successful Login: regenerates session & returns safe user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data).not.toHaveProperty('passwordHash');

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    sessionCookie = cookies[0];
  });

  it('10. Socket.IO Rejection: rejects unauthenticated socket connection attempt', (done) => {
    const clientSocket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      autoConnect: true,
      transports: ['websocket'],
    });

    clientSocket.on('connect_error', (err: Error) => {
      expect(err.message).toContain('Unauthorized');
      clientSocket.disconnect();
      done();
    });

    clientSocket.on('connect', () => {
      clientSocket.disconnect();
      done(new Error('Unauthenticated socket should not have connected'));
    });
  });
});
