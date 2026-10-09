import request from 'supertest';
import { app, server } from '../index';
import { prisma } from '../config/prisma';

const TEST_PORT = 5059;

describe('Moderator Role Capabilities & Authorization Test Suite', () => {
  let serverInstance: ReturnType<typeof server.listen>;

  const hostUser = {
    username: `modhost_${Date.now()}`,
    email: `modhost_${Date.now()}@example.com`,
    password: 'HostPassword123!',
  };

  const participantUser = {
    username: `modpart_${Date.now()}`,
    email: `modpart_${Date.now()}@example.com`,
    password: 'PartPassword123!',
  };

  const outsiderUser = {
    username: `modoutsider_${Date.now()}`,
    email: `modoutsider_${Date.now()}@example.com`,
    password: 'OutsiderPassword123!',
  };

  let hostCookie: string;
  let partCookie: string;
  let outsiderCookie: string;

  let hostUserId: string;
  let partUserId: string;
  let outsiderUserId: string;

  let testRoomId: string;
  let testInviteCode: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      serverInstance = server.listen(TEST_PORT, () => resolve());
    });

    // Register host user
    const resHost = await request(app).post('/api/auth/signup').send(hostUser);
    hostCookie = resHost.headers['set-cookie'][0];
    hostUserId = resHost.body.data.id;

    // Register participant user
    const resPart = await request(app).post('/api/auth/signup').send(participantUser);
    partCookie = resPart.headers['set-cookie'][0];
    partUserId = resPart.body.data.id;

    // Register outsider user
    const resOutsider = await request(app).post('/api/auth/signup').send(outsiderUser);
    outsiderCookie = resOutsider.headers['set-cookie'][0];
    outsiderUserId = resOutsider.body.data.id;

    // Host creates room
    const roomRes = await request(app)
      .post('/api/rooms')
      .set('Cookie', [hostCookie])
      .send({
        title: 'Moderator Role Test Room',
        description: 'Testing moderator capabilities',
        isPrivate: false,
      });

    testRoomId = roomRes.body.data.id;
    testInviteCode = roomRes.body.data.code;

    // Participant joins room
    await request(app)
      .post('/api/rooms/join')
      .set('Cookie', [partCookie])
      .send({ code: testInviteCode });
  });

  afterAll(async () => {
    await prisma.roomParticipant.deleteMany({
      where: { user: { email: { contains: '@example.com' } } },
    });
    await prisma.joinRequest.deleteMany({
      where: { roomId: testRoomId },
    });
    await prisma.room.deleteMany({
      where: { id: testRoomId },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@example.com' } },
    });
    await prisma.$disconnect();
    serverInstance.close();
  });

  it('1. Participant playback actions (play/pause/seek/video change) are rejected by server', async () => {
    // Participant attempts video update via HTTP (rejected 403)
    const resVideo = await request(app)
      .patch(`/api/rooms/${testRoomId}/video`)
      .set('Cookie', [partCookie])
      .send({ videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

    expect(resVideo.status).toBe(403);
    expect(resVideo.body.success).toBe(false);
  });

  it('2. Participant cannot assign or modify roles (403)', async () => {
    const resRole = await request(app)
      .patch(`/api/rooms/${testRoomId}/participants/${hostUserId}/role`)
      .set('Cookie', [partCookie])
      .send({ role: 'PARTICIPANT' });

    expect(resRole.status).toBe(403);
    expect(resRole.body.success).toBe(false);
  });

  it('3. Host promotes Participant to MODERATOR (200)', async () => {
    const res = await request(app)
      .patch(`/api/rooms/${testRoomId}/participants/${partUserId}/role`)
      .set('Cookie', [hostCookie])
      .send({ role: 'MODERATOR' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify DB role changed to MODERATOR
    const dbParticipant = await prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId: testRoomId, userId: partUserId } },
    });
    expect(dbParticipant?.role).toBe('MODERATOR');
  });

  it('4. Moderator CAN change YouTube video (200)', async () => {
    const resVideo = await request(app)
      .patch(`/api/rooms/${testRoomId}/video`)
      .set('Cookie', [partCookie]) // partCookie is now a MODERATOR
      .send({ videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

    expect(resVideo.status).toBe(200);
    expect(resVideo.body.success).toBe(true);
    expect(resVideo.body.data.currentVideoUrl).toContain('dQw4w9WgXcQ');
  });

  it('5. Moderator CANNOT assign roles (403)', async () => {
    const resRole = await request(app)
      .patch(`/api/rooms/${testRoomId}/participants/${outsiderUserId}/role`)
      .set('Cookie', [partCookie])
      .send({ role: 'MODERATOR' });

    expect(resRole.status).toBe(403);
    expect(resRole.body.success).toBe(false);
  });

  it('6. Moderator CANNOT delete room (403)', async () => {
    const resDelete = await request(app)
      .delete(`/api/rooms/${testRoomId}`)
      .set('Cookie', [partCookie]);

    expect(resDelete.status).toBe(403);
    expect(resDelete.body.success).toBe(false);
  });

  it('7. Host demotes Moderator to PARTICIPANT (200)', async () => {
    const resDemote = await request(app)
      .patch(`/api/rooms/${testRoomId}/participants/${partUserId}/role`)
      .set('Cookie', [hostCookie])
      .send({ role: 'PARTICIPANT' });

    expect(resDemote.status).toBe(200);
    expect(resDemote.body.success).toBe(true);

    // Verify DB role changed back to PARTICIPANT
    const dbParticipant = await prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId: testRoomId, userId: partUserId } },
    });
    expect(dbParticipant?.role).toBe('PARTICIPANT');
  });

  it('8. Demoted user is immediately rejected on privileged actions (403)', async () => {
    const resVideo = await request(app)
      .patch(`/api/rooms/${testRoomId}/video`)
      .set('Cookie', [partCookie])
      .send({ videoUrl: 'https://www.youtube.com/watch?v=L_LUpnjgPso' });

    expect(resVideo.status).toBe(403);
    expect(resVideo.body.success).toBe(false);
  });

  it('9. Role spoofing attempt in request body is ignored and rejected', async () => {
    // Outsider tries to access video update with spoofed role in body
    const resSpoof = await request(app)
      .patch(`/api/rooms/${testRoomId}/video`)
      .set('Cookie', [outsiderCookie])
      .send({ videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', currentUserRole: 'HOST' });

    expect(resSpoof.status).toBe(403);
    expect(resSpoof.body.success).toBe(false);
  });
});
