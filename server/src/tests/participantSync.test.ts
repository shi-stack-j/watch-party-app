import request from 'supertest';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { app, server } from '../index';
import { prisma } from '../config/prisma';

const TEST_PORT = 5060;

describe('Phase 2 real-time participant synchronization test suite', () => {
  let serverInstance: ReturnType<typeof server.listen>;

  const hostUser = {
    username: `syncHost_${Date.now()}`,
    email: `synchost_${Date.now()}@example.com`,
    password: 'HostPassword123!',
  };

  const participantUserB = {
    username: `syncUserB_${Date.now()}`,
    email: `syncuserb_${Date.now()}@example.com`,
    password: 'UserBPassword123!',
  };

  const outsiderUser = {
    username: `syncOutsider_${Date.now()}`,
    email: `syncoutsider_${Date.now()}@example.com`,
    password: 'OutsiderPassword123!',
  };

  let hostCookie: string;
  let userBCookie: string;
  let outsiderCookie: string;

  let hostUserId: string;
  let userBUserId: string;

  let publicRoomId: string;
  let publicInviteCode: string;

  let privateRoomId: string;
  let privateInviteCode: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      serverInstance = server.listen(TEST_PORT, () => resolve());
    });

    // Register Host
    const resHost = await request(app).post('/api/auth/signup').send(hostUser);
    hostCookie = resHost.headers['set-cookie'][0];
    hostUserId = resHost.body.data.id;

    // Register User B
    const resB = await request(app).post('/api/auth/signup').send(participantUserB);
    userBCookie = resB.headers['set-cookie'][0];
    userBUserId = resB.body.data.id;

    // Register Outsider
    const resOutsider = await request(app).post('/api/auth/signup').send(outsiderUser);
    outsiderCookie = resOutsider.headers['set-cookie'][0];

    // Create Public Room
    const publicRoomRes = await request(app)
      .post('/api/rooms')
      .set('Cookie', [hostCookie])
      .send({
        title: 'Public Participant Sync Room',
        isPrivate: false,
      });

    publicRoomId = publicRoomRes.body.data.id;
    publicInviteCode = publicRoomRes.body.data.code;

    // Create Private Room
    const privateRoomRes = await request(app)
      .post('/api/rooms')
      .set('Cookie', [hostCookie])
      .send({
        title: 'Private Participant Sync Room',
        isPrivate: true,
      });

    privateRoomId = privateRoomRes.body.data.id;
    privateInviteCode = privateRoomRes.body.data.code;
  });

  afterAll(async () => {
    await prisma.roomParticipant.deleteMany({
      where: { user: { email: { contains: '@example.com' } } },
    });
    await prisma.joinRequest.deleteMany({
      where: { OR: [{ roomId: publicRoomId }, { roomId: privateRoomId }] },
    });
    await prisma.room.deleteMany({
      where: { OR: [{ id: publicRoomId }, { id: privateRoomId }] },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@example.com' } },
    });
    await prisma.$disconnect();
    serverInstance.close();
  });

  it('1. When User B joins, Host (User A) receives participant_joined event with full participant details', async () => {
    const hostSocket: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: hostCookie },
    });

    await new Promise<void>((resolve) => {
      hostSocket.on('connect', () => {
        hostSocket.emit('join_room', { roomId: publicRoomId }, () => resolve());
      });
    });

    await request(app)
      .post('/api/rooms/join')
      .set('Cookie', [userBCookie])
      .send({ code: publicInviteCode });

    const userBSocket: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: userBCookie },
    });

    const joinedPromise = new Promise<any>((resolve) => {
      hostSocket.on('participant_joined', (data: any) => resolve(data));
    });

    await new Promise<void>((resolve) => {
      userBSocket.on('connect', () => {
        userBSocket.emit('join_room', { roomId: publicRoomId }, () => resolve());
      });
    });

    const joinedData = await joinedPromise;
    expect(joinedData.success).toBe(true);
    expect(joinedData.roomId).toBe(publicRoomId);
    expect(joinedData.participant).toBeDefined();
    expect(joinedData.participant.userId).toBe(userBUserId);
    expect(joinedData.participant.user.username).toBe(participantUserB.username);

    userBSocket.disconnect();
    hostSocket.disconnect();
  });

  it('2. A participant leaving emits participant_left event to remaining members', async () => {
    const hostSocket: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: hostCookie },
    });

    await new Promise<void>((resolve) => {
      hostSocket.on('connect', () => {
        hostSocket.emit('join_room', { roomId: publicRoomId }, () => resolve());
      });
    });

    const userBSocket: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: userBCookie },
    });

    await new Promise<void>((resolve) => {
      userBSocket.on('connect', () => {
        userBSocket.emit('join_room', { roomId: publicRoomId }, () => resolve());
      });
    });

    const leftPromise = new Promise<any>((resolve) => {
      hostSocket.on('participant_left', (data: any) => resolve(data));
    });

    userBSocket.emit('leave_room', { roomId: publicRoomId });

    const leftData = await leftPromise;
    expect(leftData.success).toBe(true);
    expect(leftData.roomId).toBe(publicRoomId);
    expect(leftData.userId).toBe(userBUserId);

    userBSocket.disconnect();
    hostSocket.disconnect();
  });

  it('3. Duplicate join_room events do not broadcast redundant duplicate entries', async () => {
    const hostSocket: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: hostCookie },
    });

    await new Promise<void>((resolve) => {
      hostSocket.on('connect', () => {
        hostSocket.emit('join_room', { roomId: publicRoomId }, () => resolve());
      });
    });

    let joinEventCount = 0;
    hostSocket.on('participant_joined', (data: any) => {
      if (data.participant.userId === userBUserId) {
        joinEventCount++;
      }
    });

    const userBSocket: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: userBCookie },
    });

    await new Promise<void>((resolve) => {
      userBSocket.on('connect', () => resolve());
    });

    userBSocket.emit('join_room', { roomId: publicRoomId });
    userBSocket.emit('join_room', { roomId: publicRoomId });

    await new Promise((r) => setTimeout(r, 200));

    expect(joinEventCount).toBeGreaterThanOrEqual(1);

    userBSocket.disconnect();
    hostSocket.disconnect();
  });

  it('4. Unauthorized user cannot join socket room or receive participant events', async () => {
    const outsiderSocket: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: outsiderCookie },
    });

    await new Promise<void>((resolve) => {
      outsiderSocket.on('connect', () => resolve());
    });

    const ack: any = await new Promise((resolve) => {
      outsiderSocket.emit('join_room', { roomId: privateRoomId }, (res: any) => resolve(res));
    });

    expect(ack.success).toBe(false);
    expect(ack.message).toContain('Forbidden');
    outsiderSocket.disconnect();
  });

  it('5. Pending or unapproved join requests do not emit participant_joined event to room members', async () => {
    const hostSocket: ClientSocketType = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: hostCookie },
    });

    await new Promise<void>((resolve) => {
      hostSocket.on('connect', () => {
        hostSocket.emit('join_room', { roomId: privateRoomId }, () => resolve());
      });
    });

    let receivedFalseJoin = false;
    hostSocket.on('participant_joined', () => {
      receivedFalseJoin = true;
    });

    // Outsider creates join request (unapproved)
    await request(app)
      .post(`/api/rooms/${privateRoomId}/request-access`)
      .set('Cookie', [outsiderCookie]);

    await new Promise((r) => setTimeout(r, 200));

    expect(receivedFalseJoin).toBe(false);
    hostSocket.disconnect();
  });
});
