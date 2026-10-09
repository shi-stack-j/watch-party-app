import request from 'supertest';
import { io as ClientSocket } from 'socket.io-client';
import { app, server } from '../index';
import { prisma } from '../config/prisma';
import { playbackStateService } from '../services/playbackStateService';

const TEST_PORT = 5058;

describe('Phase 6 Real-Time Playback Synchronization Test Suite', () => {
  let serverInstance: ReturnType<typeof server.listen>;

  const hostUser = {
    username: `pbhost_${Date.now()}`,
    email: `pbhost_${Date.now()}@example.com`,
    password: 'HostPassword123!',
  };

  const participantUser = {
    username: `pbpart_${Date.now()}`,
    email: `pbpart_${Date.now()}@example.com`,
    password: 'PartPassword123!',
  };

  const nonMemberUser = {
    username: `pbnonmember_${Date.now()}`,
    email: `pbnonmember_${Date.now()}@example.com`,
    password: 'NonMemberPassword123!',
  };

  let hostCookie: string;
  let partCookie: string;
  let nonMemberCookie: string;

  let roomId: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      serverInstance = server.listen(TEST_PORT, () => resolve());
    });

    // Register test users
    const resHost = await request(app).post('/api/auth/signup').send(hostUser);
    hostCookie = resHost.headers['set-cookie'][0];

    const resPart = await request(app).post('/api/auth/signup').send(participantUser);
    partCookie = resPart.headers['set-cookie'][0];

    const resNonMember = await request(app).post('/api/auth/signup').send(nonMemberUser);
    nonMemberCookie = resNonMember.headers['set-cookie'][0];

    // Create room with host
    const roomRes = await request(app)
      .post('/api/rooms')
      .set('Cookie', hostCookie)
      .send({ title: 'Playback Sync Room' });
    roomId = roomRes.body.data.id;

    // Set initial room video
    await request(app)
      .patch(`/api/rooms/${roomId}/video`)
      .set('Cookie', hostCookie)
      .send({ videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

    // Join room with participant
    await request(app)
      .post('/api/rooms/join')
      .set('Cookie', partCookie)
      .send({ code: roomRes.body.data.code });
  });

  afterAll(async () => {
    await prisma.roomParticipant.deleteMany({
      where: { user: { email: { contains: '@example.com' } } },
    });
    await prisma.room.deleteMany({
      where: { title: { startsWith: 'Playback Sync Room' } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@example.com' } },
    });
    await prisma.$disconnect();
    serverInstance.close();
  });

  it('1. Unauthenticated sockets rejected', (done) => {
    const unauthSocket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
    });

    unauthSocket.on('connect_error', (err) => {
      try {
        expect(err.message).toContain('Unauthorized');
        unauthSocket.disconnect();
        done();
      } catch (e) {
        unauthSocket.disconnect();
        done(e);
      }
    });
  });

  it('2. Non-member cannot join a playback room', (done) => {
    const socket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: nonMemberCookie },
    });

    socket.on('connect', () => {
      socket.emit('join_room', { roomId }, (response: any) => {
        try {
          expect(response.success).toBe(false);
          expect(response.message).toContain('Not a room member');
          socket.disconnect();
          done();
        } catch (e) {
          socket.disconnect();
          done(e);
        }
      });
    });
  });

  it('3. Authorized participant join succeeds and receives initial snapshot', (done) => {
    const partSocket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: partCookie },
    });

    partSocket.on('connect', () => {
      partSocket.emit('join_room', { roomId }, (response: any) => {
        try {
          expect(response.success).toBe(true);
          expect(response.state).toBeDefined();
          expect(response.state.roomId).toBe(roomId);
          expect(response.state.videoId).toBe('dQw4w9WgXcQ');
          partSocket.disconnect();
          done();
        } catch (e) {
          partSocket.disconnect();
          done(e);
        }
      });
    });
  });

  it('4. Participant play/pause/seek commands are rejected', (done) => {
    const partSocket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: partCookie },
    });

    partSocket.on('connect', () => {
      partSocket.emit('join_room', { roomId }, () => {
        partSocket.emit('host_playback_play', { roomId, position: 10 }, (resPlay: any) => {
          try {
            expect(resPlay.success).toBe(false);
            expect(resPlay.message).toContain('host or moderator');

            partSocket.emit('host_playback_pause', { roomId, position: 10 }, (resPause: any) => {
              expect(resPause.success).toBe(false);
              expect(resPause.message).toContain('host or moderator');

              partSocket.emit('host_playback_seek', { roomId, position: 20 }, (resSeek: any) => {
                expect(resSeek.success).toBe(false);
                expect(resSeek.message).toContain('host or moderator');

                partSocket.disconnect();
                done();
              });
            });
          } catch (e) {
            partSocket.disconnect();
            done(e);
          }
        });
      });
    });
  });

  it('5. Invalid seek values are rejected', (done) => {
    const hostSocket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: hostCookie },
    });

    hostSocket.on('connect', () => {
      hostSocket.emit('join_room', { roomId }, () => {
        hostSocket.emit('host_playback_seek', { roomId, position: -10 }, (res: any) => {
          try {
            expect(res.success).toBe(false);
            expect(res.message).toContain('Invalid seek position');

            hostSocket.emit('host_playback_seek', { roomId, position: 'invalid' }, (res2: any) => {
              expect(res2.success).toBe(false);

              hostSocket.disconnect();
              done();
            });
          } catch (e) {
            hostSocket.disconnect();
            done(e);
          }
        });
      });
    });
  });

  it('6. Authorized host play/pause/seek accepted and broadcast to room members', (done) => {
    const partSocket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: partCookie },
    });

    const hostSocket = ClientSocket(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      extraHeaders: { cookie: hostCookie },
      autoConnect: false,
    });

    let updatesReceived = 0;

    partSocket.on('connect', () => {
      partSocket.emit('join_room', { roomId }, () => {
        hostSocket.connect();
      });
    });

    hostSocket.on('connect', () => {
      hostSocket.emit('join_room', { roomId }, () => {
        hostSocket.emit('host_playback_play', { roomId, position: 5.5 });
      });
    });

    partSocket.on('playback_state_updated', (res: any) => {
      updatesReceived++;
      try {
        if (updatesReceived === 1) {
          expect(res.success).toBe(true);
          expect(res.state.isPlaying).toBe(true);
          expect(res.state.position).toBe(5.5);

          hostSocket.emit('host_playback_pause', { roomId, position: 12.0 });
        } else if (updatesReceived === 2) {
          expect(res.state.isPlaying).toBe(false);
          expect(res.state.position).toBe(12.0);

          hostSocket.emit('host_playback_seek', { roomId, position: 45.0 });
        } else if (updatesReceived === 3) {
          expect(res.state.position).toBe(45.0);

          hostSocket.disconnect();
          partSocket.disconnect();
          done();
        }
      } catch (e) {
        hostSocket.disconnect();
        partSocket.disconnect();
        done(e);
      }
    });
  });

  it('7. Late join receives latest snapshot and reconnecting client recovers current state', async () => {
    await playbackStateService.updatePlaybackState(roomId, 'host-id', 'Host', 'PLAY', {
      position: 100,
    });

    await new Promise<void>((resolve, reject) => {
      const lateSocket = ClientSocket(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
        extraHeaders: { cookie: partCookie },
      });

      lateSocket.on('connect', () => {
        lateSocket.emit('join_room', { roomId }, (response: any) => {
          try {
            expect(response.success).toBe(true);
            expect(response.state.isPlaying).toBe(true);
            expect(response.state.position).toBeGreaterThanOrEqual(100);
            lateSocket.disconnect();
            resolve();
          } catch (err) {
            lateSocket.disconnect();
            reject(err);
          }
        });
      });
    });
  });

  it('8. Changing room video resets or updates playback state correctly', async () => {
    const updateRes = await request(app)
      .patch(`/api/rooms/${roomId}/video`)
      .set('Cookie', hostCookie)
      .send({ videoUrl: 'https://www.youtube.com/watch?v=L_LUpnjgPso' });

    expect(updateRes.status).toBe(200);

    const snapshot = await playbackStateService.getSnapshot(roomId);
    expect(snapshot).toBeDefined();
    expect(snapshot?.videoId).toBe('L_LUpnjgPso');
    expect(snapshot?.position).toBeLessThan(1);
  });
});
