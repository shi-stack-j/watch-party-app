import request from 'supertest';
import { app, server } from '../index';
import { prisma } from '../config/prisma';

const TEST_PORT = 5057;

describe('Phase 5 Backend Video Persistence Test Suite', () => {
  let serverInstance: ReturnType<typeof server.listen>;

  const videoHostUser = {
    username: `videohost_${Date.now()}`,
    email: `videohost_${Date.now()}@example.com`,
    password: 'Password123!',
  };

  const videoParticipantUser = {
    username: `videopart_${Date.now()}`,
    email: `videopart_${Date.now()}@example.com`,
    password: 'Password123!',
  };

  let hostCookie: string;
  let partCookie: string;
  let testRoomId: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      serverInstance = server.listen(TEST_PORT, () => resolve());
    });

    // Register host user
    const resHost = await request(app).post('/api/auth/signup').send(videoHostUser);
    hostCookie = resHost.headers['set-cookie'][0];

    // Register participant user
    const resPart = await request(app).post('/api/auth/signup').send(videoParticipantUser);
    partCookie = resPart.headers['set-cookie'][0];

    // Create room by host
    const roomRes = await request(app)
      .post('/api/rooms')
      .set('Cookie', [hostCookie])
      .send({ title: 'Video Sync Test Room' });

    testRoomId = roomRes.body.data.id;

    // Join participant to room
    await request(app)
      .post('/api/rooms/join')
      .set('Cookie', [partCookie])
      .send({ code: roomRes.body.data.code });
  });

  afterAll(async () => {
    await prisma.roomParticipant.deleteMany({
      where: { user: { email: { contains: '@example.com' } } },
    });
    await prisma.room.deleteMany({
      where: { title: { startsWith: 'Video Sync' } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@example.com' } },
    });
    await prisma.$disconnect();
    serverInstance.close();
  });

  it('1. Unauthenticated video update rejected (401)', async () => {
    const res = await request(app)
      .patch(`/api/rooms/${testRoomId}/video`)
      .send({ videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('2. Non-host video update rejected (403)', async () => {
    const res = await request(app)
      .patch(`/api/rooms/${testRoomId}/video`)
      .set('Cookie', [partCookie])
      .send({ videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('3. Invalid YouTube URL rejected (400)', async () => {
    const res = await request(app)
      .patch(`/api/rooms/${testRoomId}/video`)
      .set('Cookie', [hostCookie])
      .send({ videoUrl: 'https://vimeo.com/999999' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Only valid YouTube URLs are supported');
  });

  it('4. Host can update room video (200)', async () => {
    const targetUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const res = await request(app)
      .patch(`/api/rooms/${testRoomId}/video`)
      .set('Cookie', [hostCookie])
      .send({ videoUrl: targetUrl });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.currentVideoUrl).toBe(targetUrl);
  });

  it('5. Saved video appears in subsequent room detail queries for members (200)', async () => {
    const res = await request(app)
      .get(`/api/rooms/${testRoomId}`)
      .set('Cookie', [partCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.currentVideoUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
});
