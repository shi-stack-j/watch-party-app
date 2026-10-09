import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import {
  createRoom,
  getUserRooms,
  getRoomDetails,
  updateRoomVideo,
  updateParticipantRole,
  joinRoomByCode,
  leaveRoom,
  deleteRoom,
  getRoomParticipants,
} from '../services/roomService';
import { sendSuccess, sendError } from '../utils/apiResponse';

import { getParamString } from '../utils/params';

export const handleCreateRoom = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    const { title, description, isPrivate } = req.body;
    const room = await createRoom(userId, title, description, isPrivate);

    return sendSuccess(res, 'Room created successfully', room, 201);
  } catch (error) {
    return next(error);
  }
};

export const handleGetRooms = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    const rooms = await getUserRooms(userId);
    return sendSuccess(res, 'Rooms retrieved successfully', rooms, 200);
  } catch (error) {
    return next(error);
  }
};

export const handleGetRoomById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    const roomId = getParamString(req.params.roomId);
    const room = await getRoomDetails(roomId, userId);

    return sendSuccess(res, 'Room details retrieved', room, 200);
  } catch (error) {
    return next(error);
  }
};

export const handleUpdateVideo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    const roomId = getParamString(req.params.roomId);
    const { videoUrl, videoId } = req.body;
    const videoInput = videoUrl || videoId || '';

    if (!videoInput) {
      return sendError(res, 'Video URL or video ID is required', undefined, 400);
    }

    const room = await updateRoomVideo(roomId, userId, videoInput);
    return sendSuccess(res, 'Room video updated successfully', room, 200);
  } catch (error) {
    return next(error);
  }
};

export const handleJoinRoom = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    const { code } = req.body;
    const room = await joinRoomByCode(code, userId);

    return sendSuccess(res, 'Joined room successfully', room, 200);
  } catch (error) {
    return next(error);
  }
};

export const handleLeaveRoom = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    const roomId = getParamString(req.params.roomId);
    await leaveRoom(roomId, userId);

    return sendSuccess(res, 'Left room successfully', null, 200);
  } catch (error) {
    return next(error);
  }
};

export const handleDeleteRoom = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    const roomId = getParamString(req.params.roomId);
    await deleteRoom(roomId, userId);

    return sendSuccess(res, 'Room deleted successfully', null, 200);
  } catch (error) {
    return next(error);
  }
};

export const handleGetParticipants = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    const roomId = getParamString(req.params.roomId);
    const participants = await getRoomParticipants(roomId, userId);

    return sendSuccess(res, 'Participants list retrieved', participants, 200);
  } catch (error) {
    return next(error);
  }
};

export const handleUpdateParticipantRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    const roomId = getParamString(req.params.roomId);
    const targetUserId = getParamString(req.params.targetUserId);
    const { role } = req.body;

    if (!role || (role !== Role.MODERATOR && role !== Role.PARTICIPANT)) {
      return sendError(res, "Role must be 'MODERATOR' or 'PARTICIPANT'", undefined, 400);
    }

    const updatedRoom = await updateParticipantRole(roomId, userId, targetUserId, role as Role);
    return sendSuccess(res, 'Participant role updated successfully', updatedRoom, 200);
  } catch (error) {
    return next(error);
  }
};
