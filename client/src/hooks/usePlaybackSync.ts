import { useEffect, useState, useRef, useCallback } from 'react';
import { socket } from '../socket';
import { RoomPlaybackState } from '../types/playback';
import { YouTubePlayerRef } from '../components/YouTubePlayer';

export interface UsePlaybackSyncOptions {
  roomId: string | undefined;
  isHost: boolean;
  canControlPlayback?: boolean;
  playerRef: React.RefObject<YouTubePlayerRef | null>;
  onVideoIdChange?: (videoId: string) => void;
}

const DRIFT_THRESHOLD_SECONDS = 2.0;

export const usePlaybackSync = ({
  roomId,
  isHost,
  canControlPlayback: canControlProp,
  playerRef,
  onVideoIdChange,
}: UsePlaybackSyncOptions) => {
  const canControlPlayback = canControlProp ?? isHost;
  const [playbackState, setPlaybackState] = useState<RoomPlaybackState | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);

  const isRemoteUpdateRef = useRef<boolean>(false);
  const lastAppliedVersionRef = useRef<number>(0);

  // Apply authoritative server state snapshot to player
  const applyAuthoritativeState = useCallback(
    (state: RoomPlaybackState) => {
      if (!state || state.version <= lastAppliedVersionRef.current) return;
      lastAppliedVersionRef.current = state.version;
      setPlaybackState(state);

      if (state.videoId && onVideoIdChange) {
        onVideoIdChange(state.videoId);
      }

      const player = playerRef.current;
      if (!player) return;

      isRemoteUpdateRef.current = true;

      // Calculate expected current position
      let expectedPosition = state.position;
      if (state.isPlaying) {
        const elapsedSeconds = Math.max(0, (Date.now() - state.timestamp) / 1000);
        expectedPosition = state.position + elapsedSeconds;
      }

      const currentTime = player.getCurrentTime();
      const drift = Math.abs(currentTime - expectedPosition);

      if (state.isPlaying) {
        if (drift > DRIFT_THRESHOLD_SECONDS || player.getPlayerState() !== 1) {
          player.seekTo(expectedPosition);
          try {
            player.playVideo();
          } catch {
            setAutoplayBlocked(true);
          }
        }
      } else {
        if (drift > 0.5 || player.getPlayerState() !== 2) {
          player.seekTo(state.position);
          player.pauseVideo();
        }
      }

      setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 500);
    },
    [playerRef, onVideoIdChange]
  );

  // Subscribe to room socket events
  useEffect(() => {
    if (!roomId) return;

    if (!socket.connected) {
      socket.connect();
    }

    const joinData = { roomId };
    socket.emit('join_room', joinData, (response: { success: boolean; state?: RoomPlaybackState }) => {
      if (response && response.success && response.state) {
        applyAuthoritativeState(response.state);
      }
    });

    const onPlaybackSnapshot = (res: { success: boolean; state: RoomPlaybackState }) => {
      if (res.success && res.state) {
        applyAuthoritativeState(res.state);
      }
    };

    const onPlaybackStateUpdated = (res: { success: boolean; state: RoomPlaybackState }) => {
      if (res.success && res.state) {
        applyAuthoritativeState(res.state);
      }
    };

    socket.on('playback_snapshot', onPlaybackSnapshot);
    socket.on('playback_state_updated', onPlaybackStateUpdated);

    return () => {
      socket.off('playback_snapshot', onPlaybackSnapshot);
      socket.off('playback_state_updated', onPlaybackStateUpdated);
      socket.emit('leave_room', { roomId });
    };
  }, [roomId, applyAuthoritativeState]);

  // Host & Moderator Action Emitters
  const emitHostPlay = useCallback(
    (position?: number) => {
      if (!canControlPlayback || !roomId || isRemoteUpdateRef.current) return;
      const currentPos = position ?? playerRef.current?.getCurrentTime() ?? 0;
      socket.emit('host_playback_play', { roomId, position: currentPos });
    },
    [canControlPlayback, roomId, playerRef]
  );

  const emitHostPause = useCallback(
    (position?: number) => {
      if (!canControlPlayback || !roomId || isRemoteUpdateRef.current) return;
      const currentPos = position ?? playerRef.current?.getCurrentTime() ?? 0;
      socket.emit('host_playback_pause', { roomId, position: currentPos });
    },
    [canControlPlayback, roomId, playerRef]
  );

  const emitHostSeek = useCallback(
    (position: number) => {
      if (!canControlPlayback || !roomId || isRemoteUpdateRef.current) return;
      socket.emit('host_playback_seek', { roomId, position });
    },
    [canControlPlayback, roomId]
  );

  return {
    playbackState,
    autoplayBlocked,
    isRemoteUpdateRef,
    emitHostPlay,
    emitHostPause,
    emitHostSeek,
    dismissAutoplayNotice: () => setAutoplayBlocked(false),
  };
};
