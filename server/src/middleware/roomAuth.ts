import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { sendError } from '../utils/apiResponse';
import { Role } from '@prisma/client';

export interface RoomAuthenticatedRequest extends Request {
  room?: {
    id: string;
    title: string;
    code: string;
    hostId: string;
    isPrivate: boolean;
  };
  membership?: {
    id: string;
    role: Role;
    isApproved: boolean;
  };
}

import { getParamString } from '../utils/params';

export const requireRoomMember = async (
  req: RoomAuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    const roomId = getParamString(req.params.roomId) || getParamString(req.body.roomId);
    if (!roomId) {
      return sendError(res, 'Room ID is required', undefined, 400);
    }

    // Find room by ID or code
    const room = await prisma.room.findFirst({
      where: {
        OR: [{ id: roomId }, { code: roomId }, { inviteCode: roomId }],
      },
    });

    if (!room) {
      return sendError(res, 'Room not found', undefined, 404);
    }

    // Check membership
    const participant = await prisma.roomParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId,
        },
      },
    });

    if (!participant) {
      return sendError(res, 'You are not a participant of this room', undefined, 403);
    }

    req.room = {
      id: room.id,
      title: room.title,
      code: room.code,
      hostId: room.hostId,
      isPrivate: room.isPrivate,
    };
    req.membership = {
      id: participant.id,
      role: participant.role,
      isApproved: participant.isApproved,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireRoomHost = async (
  req: RoomAuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    const roomId = getParamString(req.params.roomId) || getParamString(req.body.roomId);
    if (!roomId) {
      return sendError(res, 'Room ID is required', undefined, 400);
    }

    const room = await prisma.room.findFirst({
      where: {
        OR: [{ id: roomId }, { code: roomId }, { inviteCode: roomId }],
      },
    });

    if (!room) {
      return sendError(res, 'Room not found', undefined, 404);
    }

    if (room.hostId !== userId) {
      return sendError(res, 'Only the room host can perform this action', undefined, 403);
    }

    req.room = {
      id: room.id,
      title: room.title,
      code: room.code,
      hostId: room.hostId,
      isPrivate: room.isPrivate,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireRoomModeratorOrHost = async (
  req: RoomAuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    const roomId = getParamString(req.params.roomId) || getParamString(req.body.roomId);
    if (!roomId) {
      return sendError(res, 'Room ID is required', undefined, 400);
    }

    const room = await prisma.room.findFirst({
      where: {
        OR: [{ id: roomId }, { code: roomId }, { inviteCode: roomId }],
      },
    });

    if (!room) {
      return sendError(res, 'Room not found', undefined, 404);
    }

    const participant = await prisma.roomParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId,
        },
      },
    });

    if (!participant || (participant.role !== Role.HOST && participant.role !== Role.MODERATOR)) {
      return sendError(res, 'Requires Host or Moderator permission', undefined, 403);
    }

    req.room = {
      id: room.id,
      title: room.title,
      code: room.code,
      hostId: room.hostId,
      isPrivate: room.isPrivate,
    };
    req.membership = {
      id: participant.id,
      role: participant.role,
      isApproved: participant.isApproved,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};
