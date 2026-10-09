import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { RequestStatus, Role } from '@prisma/client';

export interface JoinRequestResponse {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  userEmail: string;
  status: RequestStatus;
  createdAt: Date;
  updatedAt: Date;
  decidedBy?: string | null;
}

export const createJoinRequest = async (
  roomId: string,
  userId: string
): Promise<JoinRequestResponse> => {
  const room = await prisma.room.findFirst({
    where: {
      OR: [{ id: roomId }, { code: roomId }, { inviteCode: roomId }],
    },
  });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  // Host doesn't need to request access
  if (room.hostId === userId) {
    throw new AppError('As room host, you already have full access', 400);
  }

  // Check if user is already an approved participant
  const existingParticipant = await prisma.roomParticipant.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId,
      },
    },
  });

  if (existingParticipant && existingParticipant.isApproved) {
    throw new AppError('You are already an approved member of this room', 400);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check for existing JoinRequest
  const existingRequest = await prisma.joinRequest.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId,
      },
    },
  });

  let requestRecord;
  if (existingRequest) {
    if (existingRequest.status === RequestStatus.PENDING) {
      requestRecord = existingRequest;
    } else {
      // Re-open request as pending
      requestRecord = await prisma.joinRequest.update({
        where: { id: existingRequest.id },
        data: {
          status: RequestStatus.PENDING,
          decidedBy: null,
        },
      });
    }
  } else {
    requestRecord = await prisma.joinRequest.create({
      data: {
        roomId: room.id,
        userId,
        status: RequestStatus.PENDING,
      },
    });
  }

  // Upsert unapproved RoomParticipant record so participant exists in pending state
  if (!existingParticipant) {
    await prisma.roomParticipant.create({
      data: {
        roomId: room.id,
        userId,
        role: Role.PARTICIPANT,
        isApproved: false,
      },
    });
  }

  return {
    id: requestRecord.id,
    roomId: room.id,
    userId: user.id,
    username: user.username,
    userEmail: user.email,
    status: requestRecord.status,
    createdAt: requestRecord.createdAt,
    updatedAt: requestRecord.updatedAt,
    decidedBy: requestRecord.decidedBy,
  };
};

export const getPendingRequests = async (
  roomId: string,
  deciderId: string
): Promise<JoinRequestResponse[]> => {
  const room = await prisma.room.findFirst({
    where: {
      OR: [{ id: roomId }, { code: roomId }, { inviteCode: roomId }],
    },
  });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  // Verify decider is Host or Moderator
  const isHost = room.hostId === deciderId;
  const deciderMember = await prisma.roomParticipant.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId: deciderId,
      },
    },
  });

  const isModerator = deciderMember?.role === Role.MODERATOR;

  if (!isHost && !isModerator) {
    throw new AppError('Forbidden: Only host or moderator can view join requests', 403);
  }

  const requests = await prisma.joinRequest.findMany({
    where: {
      roomId: room.id,
      status: RequestStatus.PENDING,
    },
    include: {
      user: {
        select: { id: true, username: true, email: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return requests.map((r) => ({
    id: r.id,
    roomId: room.id,
    userId: r.user.id,
    username: r.user.username,
    userEmail: r.user.email,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    decidedBy: r.decidedBy,
  }));
};

export const decideJoinRequest = async (
  requestId: string,
  deciderId: string,
  decision: 'APPROVE' | 'REJECT'
): Promise<JoinRequestResponse> => {
  const joinRequest = await prisma.joinRequest.findUnique({
    where: { id: requestId },
    include: {
      room: true,
      user: { select: { id: true, username: true, email: true } },
    },
  });

  if (!joinRequest) {
    throw new AppError('Join request not found', 404);
  }

  const room = joinRequest.room;
  const isHost = room.hostId === deciderId;
  const deciderMember = await prisma.roomParticipant.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId: deciderId,
      },
    },
  });

  const isModerator = deciderMember?.role === Role.MODERATOR;

  if (!isHost && !isModerator) {
    throw new AppError('Forbidden: Only host or moderator can decide join requests', 403);
  }

  const newStatus = decision === 'APPROVE' ? RequestStatus.APPROVED : RequestStatus.REJECTED;

  const updatedRequest = await prisma.joinRequest.update({
    where: { id: requestId },
    data: {
      status: newStatus,
      decidedBy: deciderId,
    },
  });

  if (decision === 'APPROVE') {
    await prisma.roomParticipant.upsert({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: joinRequest.userId,
        },
      },
      update: {
        isApproved: true,
      },
      create: {
        roomId: room.id,
        userId: joinRequest.userId,
        role: Role.PARTICIPANT,
        isApproved: true,
      },
    });
  } else {
    // Delete unapproved participant record if present
    await prisma.roomParticipant.deleteMany({
      where: {
        roomId: room.id,
        userId: joinRequest.userId,
      },
    });
  }

  return {
    id: updatedRequest.id,
    roomId: room.id,
    userId: joinRequest.user.id,
    username: joinRequest.user.username,
    userEmail: joinRequest.user.email,
    status: updatedRequest.status,
    createdAt: updatedRequest.createdAt,
    updatedAt: updatedRequest.updatedAt,
    decidedBy: updatedRequest.decidedBy,
  };
};

export const getUserRequestStatus = async (
  roomId: string,
  userId: string
): Promise<JoinRequestResponse | null> => {
  const room = await prisma.room.findFirst({
    where: {
      OR: [{ id: roomId }, { code: roomId }, { inviteCode: roomId }],
    },
  });

  if (!room) return null;

  const request = await prisma.joinRequest.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId,
      },
    },
    include: {
      user: { select: { id: true, username: true, email: true } },
    },
  });

  if (!request) return null;

  return {
    id: request.id,
    roomId: room.id,
    userId: request.user.id,
    username: request.user.username,
    userEmail: request.user.email,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    decidedBy: request.decidedBy,
  };
};
