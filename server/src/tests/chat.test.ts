import request from 'supertest';
import { io as ClientSocket } from 'socket.io-client';
import { app, server } from '../index';
import { prisma } from '../config/prisma';

const TEST_PORT = 5060;

describe('Phase 7 Feature A — Persistent Real-Time Chat Test Suite', () => {
  let serverInstance: ReturnType<typeof server.listen>;

  const hostUser = {
    username: `chathost_${Date.now()}`,
    email: `chathost_${Date.now()}@example.com`,
    password: 'HostPassword123!',
  };

  const memberUser = {
    username: `chatmember_${Date.now()}`,
    email: `chatmember_${Date.now()}@example.com`,
    password: 'MemberPassword123!',
  };

  const nonMemberUser = {
    username: `chatnonmember_${Date.now()}`,
    email: `chatnonmember_${Date.now()}@example.com`,
    password: 'NonMemberPassword123!',
  };

  let hostCookie: string;
  let memberCookie: string;
  let nonMemberCookie: string;
  let roomId: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      serverInstance = server.listen(TEST_PORT, () => resolve());
    });

    const resHost = await request(app).post('/api/auth/signup').send(hostUser);
    hostCookie = resHost.headers['set-cookie'][0];

    const resMember = await request(app).post('/api/auth/signup').send(memberUser);
    memberCookie = resMember.headers['set-cookie'][0];

    const resNonMember = await request(app).post('/api/auth/signup').send(nonMemberUser);
    nonMemberCookie = resNonMember.headers['set-cookie'][0];

    const roomRes = await request(app)
      .post('/api/rooms')
      .set('Cookie', hostCookie)
      .send({ title: 'Chat Test Room' });
    roomId = roomRes.body.data.id;

    await request(app)
      .post('/api/rooms/join')
      .set('Cookie', memberCookie)
      .send({ code: roomRes.body.data.code });
  });

  afterAll(async () => {
    await prisma.chatMessage.deleteMany({
      where: { room: { title: 'Chat Test Room' } },
    });
    await prisma.roomParticipant.deleteMany({
      where: { user: { email: { contains: '@example.com' } } },
    });
    await prisma.room.deleteMany({
      where: { title: 'Chat Test Room' },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@example.com' } },
    });
    await prisma.$disconnect();
    serverInstance.close();
  });

  it('1. Authenticated member can send a valid chat message', (done) => {
    const socket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: memberCookie },
    });

    socket.on('connect', () => {
      socket.emit('join_room', { roomId }, () => {
        socket.emit(
          'chat_send_message',
          { roomId, content: 'Hello watch party!' },
          (res: any) => {
            try {
              expect(res.success).toBe(true);
              expect(res.message).toBeDefined();
              expect(res.message.content).toBe('Hello watch party!');
              expect(res.message.senderName).toBe(memberUser.username);
              socket.disconnect();
              done();
            } catch (err) {
              socket.disconnect();
              done(err);
            }
          }
        );
      });
    });
  });

  it('2. Sent message is persisted in MySQL database and returned in history', async () => {
    const dbMessages = await prisma.chatMessage.findMany({
      where: { roomId },
    });
    expect(dbMessages.length).toBeGreaterThanOrEqual(1);
    expect(dbMessages[0].content).toBe('Hello watch party!');
  });

  it('3. Empty and oversized messages (>1000 chars) are rejected', (done) => {
    const socket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: memberCookie },
    });

    socket.on('connect', () => {
      socket.emit('join_room', { roomId }, () => {
        socket.emit('chat_send_message', { roomId, content: '   ' }, (resEmpty: any) => {
          try {
            expect(resEmpty.success).toBe(false);
            expect(resEmpty.message).toContain('cannot be empty');

            const longContent = 'a'.repeat(1001);
            socket.emit('chat_send_message', { roomId, content: longContent }, (resLong: any) => {
              expect(resLong.success).toBe(false);
              expect(resLong.message).toContain('exceeds maximum allowed limit');
              socket.disconnect();
              done();
            });
          } catch (err) {
            socket.disconnect();
            done(err);
          }
        });
      });
    });
  });

  it('4. Non-member cannot send or read chat messages', (done) => {
    const socket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: nonMemberCookie },
    });

    socket.on('connect', () => {
      socket.emit('chat_send_message', { roomId, content: 'Unauthorized message' }, (res: any) => {
        try {
          expect(res.success).toBe(false);
          expect(res.message).toContain('Forbidden');

          socket.emit('chat_get_history', { roomId }, (resHist: any) => {
            expect(resHist.success).toBe(false);
            expect(resHist.message).toContain('Forbidden');
            socket.disconnect();
            done();
          });
        } catch (err) {
          socket.disconnect();
          done(err);
        }
      });
    });
  });
});
