import { api } from './api';
import { ApiResponse } from '../types';
import { JoinRequest } from '../types/approval';

export const requestRoomAccess = async (roomId: string): Promise<ApiResponse<JoinRequest>> => {
  const response = await api.post<ApiResponse<JoinRequest>>(`/rooms/${roomId}/request-access`);
  return response.data;
};

export const getPendingRequests = async (roomId: string): Promise<ApiResponse<JoinRequest[]>> => {
  const response = await api.get<ApiResponse<JoinRequest[]>>(`/rooms/${roomId}/requests`);
  return response.data;
};

export const getUserRequestStatus = async (roomId: string): Promise<ApiResponse<JoinRequest | null>> => {
  const response = await api.get<ApiResponse<JoinRequest | null>>(`/rooms/${roomId}/request-status`);
  return response.data;
};

export const decideJoinRequest = async (
  requestId: string,
  action: 'APPROVE' | 'REJECT'
): Promise<ApiResponse<JoinRequest>> => {
  const response = await api.patch<ApiResponse<JoinRequest>>(`/rooms/requests/${requestId}`, {
    action,
  });
  return response.data;
};
