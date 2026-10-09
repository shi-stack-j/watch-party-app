import request from 'supertest';
import { io as ClientSocket } from 'socket.io-client';
import { app, server } from '../index';
import { prisma } from '../config/prisma';

const TEST_PORT = 5062;

describe('Phase 7 Feature B — Real-Time Emoji Reactions Test Suite', () => {
  let serverInstance: ReturnType<typeof server.listen>;

  const hostUser = {
    username: `reacthost_${Date.now()}`,
    email: `reacthost_${Date.now()}@example.com`,
    password: 'HostPassword123!',
  };

  const memberUser = {
    username: `reactmember_${Date.now()}`,
    email: `reactmember_${Date.now()}@example.com`,
    password: 'MemberPassword123!',
  };

  const nonMemberUser = {
    username: `reactnonmember_${Date.now()}`,
    email: `reactnonmember_${Date.now()}@example.com`,
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
      .send({ title: 'Reaction Test Room' });
    roomId = roomRes.body.data.id;

    await request(app)
      .post('/api/rooms/join')
      .set('Cookie', memberCookie)
      .send({ code: roomRes.body.data.code });
  });

  afterAll(async () => {
    await prisma.roomParticipant.deleteMany({
      where: { user: { email: { contains: '@example.com' } } },
    });
    await prisma.room.deleteMany({
      where: { title: 'Reaction Test Room' },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@example.com' } },
    });
    await prisma.$disconnect();
    serverInstance.close();
  });

  it('1. Valid room member can send an allowed emoji reaction', (done) => {
    const socket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: memberCookie },
    });

    socket.on('connect', () => {
      socket.emit('join_room', { roomId }, () => {
        socket.emit('reaction_send', { roomId, emoji: '🔥' }, (res: any) => {
          try {
            expect(res.success).toBe(true);
            expect(res.reaction).toBeDefined();
            expect(res.reaction.emoji).toBe('🔥');
            expect(res.reaction.sender.username).toBe(memberUser.username);
            socket.disconnect();
            done();
          } catch (err) {
            socket.disconnect();
            done(err);
          }
        });
      });
    });
  });

  it('2. Unsupported emoji or invalid payloads are rejected', (done) => {
    const socket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: memberCookie },
    });

    socket.on('connect', () => {
      socket.emit('join_room', { roomId }, () => {
        socket.emit('reaction_send', { roomId, emoji: '😈' }, (res: any) => {
          try {
            expect(res.success).toBe(false);
            expect(res.message).toContain('Unsupported emoji');
            socket.disconnect();
            done();
          } catch (err) {
            socket.disconnect();
            done(err);
          }
        });
      });
    });
  });

  it('3. Non-member cannot send reactions', (done) => {
    const socket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: nonMemberCookie },
    });

    socket.on('connect', () => {
      socket.emit('reaction_send', { roomId, emoji: '❤️' }, (res: any) => {
        try {
          expect(res.success).toBe(false);
          expect(res.message).toContain('Forbidden');
          socket.disconnect();
          done();
        } catch (err) {
          socket.disconnect();
          done(err);
        }
      });
    });
  });
});
