export interface RoomPlaybackState {
  roomId: string;
  videoId: string | null;
  isPlaying: boolean;
  position: number;
  timestamp: number;
  version: number;
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
