import request from 'supertest';
import { io as ClientSocket } from 'socket.io-client';
import { app, server } from '../index';
import { prisma } from '../config/prisma';

const TEST_PORT = 5056;

describe('Phase 4 Room Management & Server-Side Authorization Test Suite', () => {
  let serverInstance: ReturnType<typeof server.listen>;

  const hostUser = {
    username: `roomhost_${Date.now()}`,
    email: `host_${Date.now()}@example.com`,
    password: 'HostPassword123!',
  };

  const participantUser = {
    username: `roompart_${Date.now()}`,
    email: `part_${Date.now()}@example.com`,
    password: 'PartPassword123!',
  };

  let hostCookie: string;
  let partCookie: string;

  let createdRoomId: string;
  let createdInviteCode: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      serverInstance = server.listen(TEST_PORT, () => resolve());
    });

    // Register host user
    const resHost = await request(app).post('/api/auth/signup').send(hostUser);
    hostCookie = resHost.headers['set-cookie'][0];

    // Register participant user
    const resPart = await request(app).post('/api/auth/signup').send(participantUser);
    partCookie = resPart.headers['set-cookie'][0];
  });

  afterAll(async () => {
    await prisma.roomParticipant.deleteMany({
      where: { user: { email: { contains: '@example.com' } } },
    });
    await prisma.room.deleteMany({
      where: { title: { startsWith: 'Test Room' } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@example.com' } },
    });
    await prisma.$disconnect();
    serverInstance.close();
  });

  it('1. Unauthenticated room creation rejected (401)', async () => {
    const res = await request(app).post('/api/rooms').send({ title: 'Unauth Room' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('2. Successful room creation assigns correct host & creates HOST membership', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Cookie', [hostCookie])
      .send({
        title: 'Test Room Alpha',
        description: 'Test room description',
        isPrivate: true,
        // Attempt spoofed hostId / role injection
        hostId: 'spoofed-id',
        role: 'HOST',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.code).toBeDefined();
    expect(res.body.data.hostId).not.toBe('spoofed-id');

    createdRoomId = res.body.data.id;
    createdInviteCode = res.body.data.code;

    // Verify DB HOST participant
    const hostMember = await prisma.roomParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId: createdRoomId,
          userId: res.body.data.hostId,
        },
      },
    });

    expect(hostMember).not.toBeNull();
    expect(hostMember?.role).toBe('HOST');
  });

  it('3. Invalid invite code rejected (404)', async () => {
    const res = await request(app)
      .post('/api/rooms/join')
      .set('Cookie', [partCookie])
      .send({ code: 'INVALID99' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('4. Successful join via invite code creates PARTICIPANT membership', async () => {
    const res = await request(app)
      .post('/api/rooms/join')
      .set('Cookie', [partCookie])
      .send({ code: createdInviteCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdRoomId);

    // Verify DB PARTICIPANT membership
    const partMember = await prisma.roomParticipant.findFirst({
      where: {
        roomId: createdRoomId,
        user: { email: participantUser.email.toLowerCase() },
      },
    });

    expect(partMember).not.toBeNull();
    expect(partMember?.role).toBe('PARTICIPANT');
  });

  it('5. Duplicate join handled gracefully', async () => {
    const res = await request(app)
      .post('/api/rooms/join')
      .set('Cookie', [partCookie])
      .send({ code: createdInviteCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('6. Non-member cannot read protected private room details', async () => {
    // Create new non-member user
    const outsiderRes = await request(app).post('/api/auth/signup').send({
      username: `outsider_${Date.now()}`,
      email: `outsider_${Date.now()}@example.com`,
      password: 'OutsiderPassword1!',
    });
    const outsiderCookie = outsiderRes.headers['set-cookie'][0];

    const res = await request(app)
      .get(`/api/rooms/${createdRoomId}`)
      .set('Cookie', [outsiderCookie]);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('7. Non-host cannot delete a room (403)', async () => {
    const res = await request(app)
      .delete(`/api/rooms/${createdRoomId}`)
      .set('Cookie', [partCookie]);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('8. Socket.IO rejects non-member room access attempt', (done) => {
    const clientSocket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      autoConnect: true,
      transports: ['websocket'],
      extraHeaders: {
        cookie: partCookie,
      },
    });

    clientSocket.on('connect', () => {
      // Attempt join unauthorized room
      clientSocket.emit('join_room', { roomId: 'non-existent-room-id' }, (ack: { success: boolean }) => {
        expect(ack.success).toBe(false);
        clientSocket.disconnect();
        done();
      });
    });
  });

  it('9. Host can delete a room (200)', async () => {
    const res = await request(app)
      .delete(`/api/rooms/${createdRoomId}`)
      .set('Cookie', [hostCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify room removed from DB
    const dbRoom = await prisma.room.findUnique({ where: { id: createdRoomId } });
    expect(dbRoom).toBeNull();
  });
});
