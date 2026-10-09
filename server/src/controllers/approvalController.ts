import { Request, Response, NextFunction } from 'express';
import {
  createJoinRequest,
  getPendingRequests,
  decideJoinRequest,
  getUserRequestStatus,
} from '../services/approvalService';
import { sendSuccess, sendError } from '../utils/apiResponse';

import { getParamString } from '../utils/params';

export const handleCreateJoinRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    const roomId = getParamString(req.params.roomId);
    const result = await createJoinRequest(roomId, userId);

    return sendSuccess(res, 'Join request submitted successfully', result, 201);
  } catch (error) {
    return next(error);
  }
};

export const handleGetPendingRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    const roomId = getParamString(req.params.roomId);
    const requests = await getPendingRequests(roomId, userId);

    return sendSuccess(res, 'Pending join requests retrieved', requests, 200);
  } catch (error) {
    return next(error);
  }
};

export const handleDecideJoinRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    const requestId = getParamString(req.params.requestId);
    const { action } = req.body;

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return sendError(res, "Action must be 'APPROVE' or 'REJECT'", undefined, 400);
    }

    const result = await decideJoinRequest(requestId, userId, action);

    return sendSuccess(
      res,
      `Join request ${action.toLowerCase()}d successfully`,
      result,
      200
    );
  } catch (error) {
    return next(error);
  }
};

export const handleGetUserRequestStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    const roomId = getParamString(req.params.roomId);
    const status = await getUserRequestStatus(roomId, userId);

    return sendSuccess(res, 'User request status retrieved', status, 200);
  } catch (error) {
    return next(error);
  }
};
