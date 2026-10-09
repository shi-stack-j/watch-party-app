export interface RoomPlaybackState {
  roomId: string;
  videoId: string | null;
  isPlaying: boolean;
  position: number; // In seconds
  timestamp: number; // Date.now() server time
  version: number; // Monotonically increasing sequence number
  updatedBy: {
    userId: string;
    username: string;
  };
}

export interface PlaybackCommandPayload {
  roomId: string;
  position?: number;
  videoId?: string;
}

export interface PlaybackSocketResponse {
  success: boolean;
  message?: string;
  state?: RoomPlaybackState;
}
