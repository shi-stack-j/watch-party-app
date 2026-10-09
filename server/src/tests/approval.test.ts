import request from 'supertest';
import { io as ClientSocket } from 'socket.io-client';
import { app, server } from '../index';
import { prisma } from '../config/prisma';

const TEST_PORT = 5064;

describe('Phase 7 Feature C — Participant Approval Workflow Test Suite', () => {
  let serverInstance: ReturnType<typeof server.listen>;

  const hostUser = {
    username: `apphost_${Date.now()}`,
    email: `apphost_${Date.now()}@example.com`,
    password: 'HostPassword123!',
  };

  const requesterUser = {
    username: `appreq_${Date.now()}`,
    email: `appreq_${Date.now()}@example.com`,
    password: 'ReqPassword123!',
  };

  const unauthorizedUser = {
    username: `appunauth_${Date.now()}`,
    email: `appunauth_${Date.now()}@example.com`,
    password: 'UnauthPassword123!',
  };

  let hostCookie: string;
  let reqCookie: string;
  let unauthCookie: string;

  let roomId: string;
  let requestId: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      serverInstance = server.listen(TEST_PORT, () => resolve());
    });

    const resHost = await request(app).post('/api/auth/signup').send(hostUser);
    hostCookie = resHost.headers['set-cookie'][0];

    const resReq = await request(app).post('/api/auth/signup').send(requesterUser);
    reqCookie = resReq.headers['set-cookie'][0];

    const resUnauth = await request(app).post('/api/auth/signup').send(unauthorizedUser);
    unauthCookie = resUnauth.headers['set-cookie'][0];

    // Create private room requiring approval
    const roomRes = await request(app)
      .post('/api/rooms')
      .set('Cookie', hostCookie)
      .send({ title: 'Approval Test Room', isPrivate: true });
    roomId = roomRes.body.data.id;
  });

  afterAll(async () => {
    await prisma.joinRequest.deleteMany({
      where: { room: { title: 'Approval Test Room' } },
    });
    await prisma.roomParticipant.deleteMany({
      where: { user: { email: { contains: '@example.com' } } },
    });
    await prisma.room.deleteMany({
      where: { title: 'Approval Test Room' },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@example.com' } },
    });
    await prisma.$disconnect();
    serverInstance.close();
  });

  it('1. Eligible user can submit a join request to private room', async () => {
    const res = await request(app)
      .post(`/api/rooms/${roomId}/request-access`)
      .set('Cookie', reqCookie);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.username).toBe(requesterUser.username);
    requestId = res.body.data.id;
  });

  it('2. Pending user cannot connect socket or access room playback', (done) => {
    const pendingSocket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: reqCookie },
    });

    pendingSocket.on('connect', () => {
      pendingSocket.emit('join_room', { roomId }, (res: any) => {
        try {
          expect(res.success).toBe(false);
          expect(res.message).toContain('pending approval');
          pendingSocket.disconnect();
          done();
        } catch (err) {
          pendingSocket.disconnect();
          done(err);
        }
      });
    });
  });

  it('3. Non-host cannot view or decide pending join requests (403)', async () => {
    const resView = await request(app)
      .get(`/api/rooms/${roomId}/requests`)
      .set('Cookie', unauthCookie);
    expect(resView.status).toBe(403);

    const resDecide = await request(app)
      .patch(`/api/rooms/requests/${requestId}`)
      .set('Cookie', unauthCookie)
      .send({ action: 'APPROVE' });
    expect(resDecide.status).toBe(403);
  });

  it('4. Host can view pending join requests', async () => {
    const res = await request(app)
      .get(`/api/rooms/${roomId}/requests`)
      .set('Cookie', hostCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(requestId);
  });

  it('5. Host can approve join request and activate membership', async () => {
    const res = await request(app)
      .patch(`/api/rooms/requests/${requestId}`)
      .set('Cookie', hostCookie)
      .send({ action: 'APPROVE' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('APPROVED');

    // Verify DB participant is now approved
    const dbParticipant = await prisma.roomParticipant.findFirst({
      where: { roomId, user: { email: requesterUser.email } },
    });
    expect(dbParticipant).toBeDefined();
    expect(dbParticipant?.isApproved).toBe(true);
  });

  it('6. Approved user can now connect socket and receive playback state', (done) => {
    const approvedSocket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: reqCookie },
    });

    approvedSocket.on('connect', () => {
      approvedSocket.emit('join_room', { roomId }, (res: any) => {
        try {
          expect(res.success).toBe(true);
          expect(res.state).toBeDefined();
          expect(res.state.roomId).toBe(roomId);
          approvedSocket.disconnect();
          done();
        } catch (err) {
          approvedSocket.disconnect();
          done(err);
        }
      });
    });
  });
});
