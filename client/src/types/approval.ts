export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface JoinRequest {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  userEmail: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  decidedBy?: string | null;
}
