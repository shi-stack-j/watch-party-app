import { api } from './api';
import { ApiResponse, User, LoginPayload, RegisterPayload } from '../types';

export const loginUser = async (payload: LoginPayload): Promise<ApiResponse<User>> => {
  const response = await api.post<ApiResponse<User>>('/auth/login', payload);
  return response.data;
};

export const registerUser = async (payload: RegisterPayload): Promise<ApiResponse<User>> => {
  const response = await api.post<ApiResponse<User>>('/auth/register', payload);
  return response.data;
};

export const getCurrentUser = async (): Promise<ApiResponse<User>> => {
  const response = await api.get<ApiResponse<User>>('/auth/me');
  return response.data;
};

export const logoutUser = async (): Promise<ApiResponse<null>> => {
  const response = await api.post<ApiResponse<null>>('/auth/logout');
  return response.data;
};
