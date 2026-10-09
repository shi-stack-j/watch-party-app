import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export const sendSuccess = <T>(res: Response, message: string, data?: T, statusCode = 200) => {
  const responsePayload: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  return res.status(statusCode).json(responsePayload);
};

export const sendError = (res: Response, message: string, error?: string, statusCode = 400) => {
  const responsePayload: ApiResponse = {
    success: false,
    message,
    ...(error ? { error } : {}),
  };
  return res.status(statusCode).json(responsePayload);
};
