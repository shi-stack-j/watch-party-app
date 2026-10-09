import { prisma } from '../config/prisma';

export interface HealthStatus {
  status: string;
  uptimeSeconds: number;
  timestamp: string;
  database: 'connected' | 'disconnected';
  environment: string;
}

export const checkHealth = async (): Promise<HealthStatus> => {
  let dbStatus: 'connected' | 'disconnected' = 'disconnected';
  try {
    // Ping DB with raw query
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  return {
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: dbStatus,
    environment: process.env.NODE_ENV || 'development',
  };
};
