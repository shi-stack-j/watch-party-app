import { prisma } from '../config/prisma';
import { generateUniqueInviteCode } from '../utils/inviteCode';
import { parseYouTubeUrl } from '../utils/youtubeUrl';
import { AppError } from '../middleware/errorHandler';
import { Role } from '@prisma/client';
import { playbackStateService } from './playbackStateService';

export interface SafeRoomResponse {
  id: string;
  title: string;
  name: string;
  description: string | null;
  code: string;
  inviteCode: string;
  hostId: string;
  isPrivate: boolean;
  currentVideoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  host?: {
    id: string;
    username: string;
    email: string;
  };
  currentUserRole?: Role;
  _count?: {
    participants: number;
  };
}

export const createRoom = async (
  hostId: string,
  title: string,
  description?: string,
  isPrivate = false
): Promise<SafeRoomResponse> => {
  const inviteCode = await generateUniqueInviteCode();
  const roomTitle = title.trim();

  // Transaction: Create room & Host participant
  const newRoom = await prisma.$transaction(async (tx) => {
    const room = await tx.room.create({
      data: {
        title: roomTitle,
        name: roomTitle,
        description: description ? description.trim() : null,
        code: inviteCode,
        inviteCode: inviteCode,
        hostId,
        isPrivate,
      },
      include: {
        host: {
          select: { id: true, username: true, email: true },
        },
        _count: {
          select: { participants: true },
        },
      },
    });

    await tx.roomParticipant.create({
      data: {
        roomId: room.id,
        userId: hostId,
        role: Role.HOST,
        isApproved: true,
      },
    });

    return room;
  });

  return {
    ...newRoom,
    currentUserRole: Role.HOST,
    _count: {
      participants: (newRoom._count?.participants || 0) + 1,
    },
  };
};

export const getUserRooms = async (userId: string): Promise<SafeRoomResponse[]> => {
  const rooms = await prisma.room.findMany({
    where: {
      OR: [
        { hostId: userId },
        { participants: { some: { userId } } },
      ],
    },
    include: {
      host: {
        select: { id: true, username: true, email: true },
      },
      participants: {
        where: { userId },
        select: { role: true },
      },
      _count: {
        select: { participants: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rooms.map((room) => ({
    id: room.id,
    title: room.title,
    name: room.name,
    description: room.description,
    code: room.code,
    inviteCode: room.inviteCode,
    hostId: room.hostId,
    isPrivate: room.isPrivate,
    currentVideoUrl: room.currentVideoUrl,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    host: room.host,
    currentUserRole: room.participants[0]?.role || (room.hostId === userId ? Role.HOST : Role.PARTICIPANT),
    _count: room._count,
  }));
};

export const getRoomDetails = async (
  idOrCode: string,
  userId: string
): Promise<SafeRoomResponse> => {
  const room = await prisma.room.findFirst({
    where: {
      OR: [{ id: idOrCode }, { code: idOrCode }, { inviteCode: idOrCode }],
    },
    include: {
      host: {
        select: { id: true, username: true, email: true },
      },
      participants: {
        where: { userId },
        select: { role: true, isApproved: true },
      },
      _count: {
        select: { participants: true },
      },
    },
  });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  const membership = room.participants[0];
  const isHost = room.hostId === userId;

  // Check access authorization
  if (room.isPrivate && !isHost && !membership) {
    throw new AppError('This watch room is private. You must join via invite code.', 403);
  }

  return {
    id: room.id,
    title: room.title,
    name: room.name,
    description: room.description,
    code: room.code,
    inviteCode: room.inviteCode,
    hostId: room.hostId,
    isPrivate: room.isPrivate,
    currentVideoUrl: room.currentVideoUrl,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    host: room.host,
    currentUserRole: membership?.role || (isHost ? Role.HOST : Role.PARTICIPANT),
    _count: room._count,
  };
};

export const updateRoomVideo = async (
  roomId: string,
  hostId: string,
  videoInput: string
): Promise<SafeRoomResponse> => {
  const parseResult = parseYouTubeUrl(videoInput);
  if (!parseResult.isValid || !parseResult.normalizedUrl || !parseResult.videoId) {
    throw new AppError(parseResult.error || 'Invalid YouTube URL', 400);
  }

  const room = await prisma.room.findFirst({
    where: {
      OR: [{ id: roomId }, { code: roomId }, { inviteCode: roomId }],
    },
    include: {
      host: { select: { username: true } },
    },
  });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  const isHost = room.hostId === hostId;
  const participant = await prisma.roomParticipant.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId: hostId,
      },
    },
  });

  const isModerator = participant?.role === Role.MODERATOR;

  if (!isHost && !isModerator) {
    throw new AppError('Requires Host or Moderator permission to change the video', 403);
  }

  await prisma.room.update({
    where: { id: room.id },
    data: {
      currentVideoUrl: parseResult.normalizedUrl,
    },
  });

  // Update in-memory playback state with new video ID
  await playbackStateService.updatePlaybackState(
    room.id,
    hostId,
    room.host?.username || 'Host',
    'CHANGE_VIDEO',
    { videoId: parseResult.videoId }
  );

  return getRoomDetails(room.id, hostId);
};

export const updateParticipantRole = async (
  roomId: string,
  hostId: string,
  targetUserId: string,
  newRole: Role
): Promise<SafeRoomResponse> => {
  if (newRole !== Role.MODERATOR && newRole !== Role.PARTICIPANT) {
    throw new AppError('Invalid role assignment. Can only assign MODERATOR or PARTICIPANT.', 400);
  }

  const room = await prisma.room.findFirst({
    where: {
      OR: [{ id: roomId }, { code: roomId }, { inviteCode: roomId }],
    },
  });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  if (room.hostId !== hostId) {
    throw new AppError('Only the room host can change participant roles', 403);
  }

  if (targetUserId === room.hostId) {
    throw new AppError('Host role privileges cannot be modified', 400);
  }

  const targetParticipant = await prisma.roomParticipant.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId: targetUserId,
      },
    },
  });

  if (!targetParticipant) {
    throw new AppError('Target participant is not a member of this room', 404);
  }

  await prisma.roomParticipant.update({
    where: {
      id: targetParticipant.id,
    },
    data: {
      role: newRole,
    },
  });

  return getRoomDetails(room.id, hostId);
};

export const joinRoomByCode = async (code: string, userId: string): Promise<SafeRoomResponse> => {
  const normalizedCode = code.trim().toUpperCase();

  const room = await prisma.room.findFirst({
    where: {
      OR: [{ code: normalizedCode }, { inviteCode: normalizedCode }],
    },
  });

  if (!room) {
    throw new AppError('Invalid or expired room invite code', 404);
  }

  // Check existing membership
  const existingMembership = await prisma.roomParticipant.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId,
      },
    },
  });

  if (!existingMembership) {
    const role = room.hostId === userId ? Role.HOST : Role.PARTICIPANT;
    await prisma.roomParticipant.create({
      data: {
        roomId: room.id,
        userId,
        role,
        isApproved: !room.isPrivate || room.hostId === userId,
      },
    });
  }

  return getRoomDetails(room.id, userId);
};

export const leaveRoom = async (roomId: string, userId: string): Promise<void> => {
  const room = await prisma.room.findFirst({
    where: {
      OR: [{ id: roomId }, { code: roomId }, { inviteCode: roomId }],
    },
  });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  if (room.hostId === userId) {
    throw new AppError('As the host, you cannot leave without deleting the room. Please delete the room to close it.', 400);
  }

  const membership = await prisma.roomParticipant.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId,
      },
    },
  });

  if (!membership) {
    throw new AppError('You are not a member of this room', 400);
  }

  await prisma.roomParticipant.delete({
    where: {
      id: membership.id,
    },
  });
};

export const deleteRoom = async (roomId: string, hostId: string): Promise<void> => {
  const room = await prisma.room.findFirst({
    where: {
      OR: [{ id: roomId }, { code: roomId }, { inviteCode: roomId }],
    },
  });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  if (room.hostId !== hostId) {
    throw new AppError('Only the room host can delete this room', 403);
  }

  playbackStateService.removeState(room.id);

  await prisma.room.delete({
    where: { id: room.id },
  });
};

export const getRoomParticipants = async (roomId: string, userId: string) => {
  const room = await prisma.room.findFirst({
    where: {
      OR: [{ id: roomId }, { code: roomId }, { inviteCode: roomId }],
    },
  });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  const isHost = room.hostId === userId;
  const isMember = await prisma.roomParticipant.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId,
      },
    },
  });

  if (room.isPrivate && !isHost && !isMember) {
    throw new AppError('Access denied', 403);
  }

  const participants = await prisma.roomParticipant.findMany({
    where: { roomId: room.id },
    include: {
      user: {
        select: { id: true, username: true, email: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });

  return participants.map((p) => ({
    id: p.id,
    roomId: p.roomId,
    userId: p.userId,
    role: p.role,
    isApproved: p.isApproved,
    joinedAt: p.joinedAt,
    user: p.user,
  }));
};
