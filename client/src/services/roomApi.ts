import { api } from './api';
import { ApiResponse, Room, RoomParticipant, UserRole, CreateRoomPayload, JoinRoomPayload } from '../types';

export const getRooms = async (): Promise<ApiResponse<Room[]>> => {
  const response = await api.get<ApiResponse<Room[]>>('/rooms');
  return response.data;
};

export const getRoomByIdOrCode = async (idOrCode: string): Promise<ApiResponse<Room>> => {
  const response = await api.get<ApiResponse<Room>>(`/rooms/${idOrCode}`);
  return response.data;
};

export const createRoom = async (payload: CreateRoomPayload): Promise<ApiResponse<Room>> => {
  const response = await api.post<ApiResponse<Room>>('/rooms', payload);
  return response.data;
};

export const joinRoom = async (payload: JoinRoomPayload): Promise<ApiResponse<Room>> => {
  const response = await api.post<ApiResponse<Room>>('/rooms/join', payload);
  return response.data;
};

export const updateRoomVideo = async (roomId: string, videoUrl: string): Promise<ApiResponse<Room>> => {
  const response = await api.patch<ApiResponse<Room>>(`/rooms/${roomId}/video`, { videoUrl });
  return response.data;
};

export const updateParticipantRole = async (
  roomId: string,
  targetUserId: string,
  role: UserRole
): Promise<ApiResponse<Room>> => {
  const response = await api.patch<ApiResponse<Room>>(`/rooms/${roomId}/participants/${targetUserId}/role`, {
    role,
  });
  return response.data;
};

export const leaveRoom = async (roomId: string): Promise<ApiResponse<null>> => {
  const response = await api.post<ApiResponse<null>>(`/rooms/${roomId}/leave`);
  return response.data;
};

export const deleteRoom = async (roomId: string): Promise<ApiResponse<null>> => {
  const response = await api.delete<ApiResponse<null>>(`/rooms/${roomId}`);
  return response.data;
};

export const getRoomParticipants = async (roomId: string): Promise<ApiResponse<RoomParticipant[]>> => {
  const response = await api.get<ApiResponse<RoomParticipant[]>>(`/rooms/${roomId}/participants`);
  return response.data;
};
