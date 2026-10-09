import { prisma } from '../config/prisma';
import { parseYouTubeUrl } from '../utils/youtubeUrl';
import { RoomPlaybackState } from '../types/playback';
import { logger } from '../utils/logger';

class PlaybackStateService {
  private activeStates = new Map<string, RoomPlaybackState>();

  /**
   * Retrieves or initializes the authoritative playback state for a room.
   */
  public async getOrCreatePlaybackState(roomId: string): Promise<RoomPlaybackState> {
    const existing = this.activeStates.get(roomId);
    if (existing) {
      return existing;
    }

    // Initialize state from database room record
    const room = await prisma.room.findFirst({
      where: {
        OR: [{ id: roomId }, { code: roomId }, { inviteCode: roomId }],
      },
      include: {
        host: { select: { username: true } },
      },
    });

    let videoId: string | null = null;
    if (room?.currentVideoUrl) {
      const parsed = parseYouTubeUrl(room.currentVideoUrl);
      if (parsed.isValid && parsed.videoId) {
        videoId = parsed.videoId;
      }
    }

    const initialState: RoomPlaybackState = {
      roomId: room ? room.id : roomId,
      videoId,
      isPlaying: false,
      position: 0,
      timestamp: Date.now(),
      version: 1,
      updatedBy: {
        userId: room ? room.hostId : 'system',
        username: room?.host?.username || 'Host',
      },
    };

    if (room) {
      this.activeStates.set(room.id, initialState);
    }

    return initialState;
  }

  /**
   * Updates room playback state with host authorization and version incrementing.
   */
  public async updatePlaybackState(
    roomId: string,
    userId: string,
    username: string,
    action: 'PLAY' | 'PAUSE' | 'SEEK' | 'CHANGE_VIDEO',
    payload: { position?: number; videoId?: string }
  ): Promise<RoomPlaybackState> {
    const currentState = await this.getOrCreatePlaybackState(roomId);
    const newVersion = currentState.version + 1;
    const now = Date.now();

    let isPlaying = currentState.isPlaying;
    let position = currentState.position;
    let videoId = currentState.videoId;

    if (action === 'PLAY') {
      isPlaying = true;
      if (typeof payload.position === 'number' && payload.position >= 0) {
        position = payload.position;
      } else {
        // Calculate estimated position before playing
        position = this.calculateEstimatedPosition(currentState);
      }
    } else if (action === 'PAUSE') {
      isPlaying = false;
      if (typeof payload.position === 'number' && payload.position >= 0) {
        position = payload.position;
      } else {
        position = this.calculateEstimatedPosition(currentState);
      }
    } else if (action === 'SEEK') {
      if (typeof payload.position !== 'number' || payload.position < 0) {
        throw new Error('Invalid seek position');
      }
      position = payload.position;
    } else if (action === 'CHANGE_VIDEO') {
      if (payload.videoId) {
        videoId = payload.videoId;
      }
      position = 0;
      isPlaying = true;
    }

    const newState: RoomPlaybackState = {
      roomId: currentState.roomId,
      videoId,
      isPlaying,
      position,
      timestamp: now,
      version: newVersion,
      updatedBy: { userId, username },
    };

    this.activeStates.set(currentState.roomId, newState);
    logger.info(
      `Playback state updated for Room ${currentState.roomId}: [v${newVersion}] ${action} | video=${videoId} | pos=${position.toFixed(
        2
      )}s | playing=${isPlaying}`
    );

    return newState;
  }

  /**
   * Calculates current estimated playback position based on server time elapsed.
   */
  public calculateEstimatedPosition(state: RoomPlaybackState): number {
    if (!state.isPlaying) {
      return state.position;
    }
    const elapsedSeconds = (Date.now() - state.timestamp) / 1000;
    return Math.max(0, state.position + elapsedSeconds);
  }

  /**
   * Returns authoritative snapshot with calculated position.
   */
  public async getSnapshot(roomId: string): Promise<RoomPlaybackState> {
    const state = await this.getOrCreatePlaybackState(roomId);
    const currentPosition = this.calculateEstimatedPosition(state);
    return {
      ...state,
      position: currentPosition,
    };
  }

  /**
   * Cleans up room state when room deleted.
   */
  public removeState(roomId: string): void {
    this.activeStates.delete(roomId);
  }
}

export const playbackStateService = new PlaybackStateService();
