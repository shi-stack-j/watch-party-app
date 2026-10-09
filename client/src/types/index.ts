export type UserRole = 'HOST' | 'MODERATOR' | 'PARTICIPANT';

export interface User {
  id: string;
  email: string;
  username: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Room {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  hostId: string;
  host?: Partial<User>;
  currentVideoUrl?: string | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    participants?: number;
  };
}

export interface RoomParticipant {
  id: string;
  roomId: string;
  userId: string;
  role: UserRole;
  isApproved: boolean;
  joinedAt: string;
  user?: Partial<User>;
}

export interface ApprovalRequest {
  id: string;
  userId: string;
  username: string;
  actionType: 'JOIN_ROOM' | 'CONTROL_PLAYBACK' | 'MODERATOR_PROMOTION';
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  timestamp: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface HealthCheckData {
  status: string;
  uptimeSeconds: number;
  timestamp: string;
  database: 'connected' | 'disconnected';
  environment: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface CreateRoomPayload {
  title: string;
  description?: string;
  isPrivate?: boolean;
}

export interface JoinRoomPayload {
  code: string;
}

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
}
