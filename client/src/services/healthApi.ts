import { api } from './api';
import { ApiResponse, HealthCheckData } from '../types';

export const getHealthStatus = async (): Promise<ApiResponse<HealthCheckData>> => {
  const response = await api.get<ApiResponse<HealthCheckData>>('/health');
  return response.data;
};
