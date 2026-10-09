import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Lock, Loader2, Play } from 'lucide-react';

export interface YouTubePlayerRef {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
}

export interface YouTubePlayerProps {
  videoId: string | null;
  onReady?: () => void;
  onStateChange?: (state: number, currentTime: number) => void;
  onError?: (errorCode: number) => void;
  disabled?: boolean;
}

export const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(
  ({ videoId, onReady, onStateChange, onError }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YT.Player | null>(null);
    const elementIdRef = useRef<string>(`yt-player-${Math.random().toString(36).substring(2, 9)}`);

    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isApiReady, setIsApiReady] = useState<boolean>(false);
    const [playerError, setPlayerError] = useState<string | null>(null);

    // Keep callback props in refs so changing parent function references don't re-trigger player initialization
    const onReadyRef = useRef(onReady);
    const onStateChangeRef = useRef(onStateChange);
    const onErrorRef = useRef(onError);

    useEffect(() => {
      onReadyRef.current = onReady;
      onStateChangeRef.current = onStateChange;
      onErrorRef.current = onError;
    });

    // Expose control methods via ref for Socket.IO synchronization
    useImperativeHandle(ref, () => ({
      playVideo: () => {
        if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
          try {
            playerRef.current.playVideo();
          } catch {
            // ignore
          }
        }
      },
      pauseVideo: () => {
        if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
          try {
            playerRef.current.pauseVideo();
          } catch {
            // ignore
          }
        }
      },
      seekTo: (seconds: number) => {
        if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
          try {
            playerRef.current.seekTo(seconds, true);
          } catch {
            // ignore
          }
        }
      },
      getCurrentTime: () => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          try {
            return playerRef.current.getCurrentTime();
          } catch {
            return 0;
          }
        }
        return 0;
      },
      getPlayerState: () => {
        if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
          try {
            return playerRef.current.getPlayerState();
          } catch {
            return -1;
          }
        }
        return -1;
      },
    }));

    // 1. Load YouTube IFrame API script once
    useEffect(() => {
      let isMounted = true;

      if (window.YT && window.YT.Player) {
        setIsApiReady(true);
        return;
      }

      const existingScript = document.getElementById('youtube-iframe-api');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        if (firstScriptTag && firstScriptTag.parentNode) {
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
          document.head.appendChild(tag);
        }
      }

      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (previousCallback) previousCallback();
        if (isMounted) setIsApiReady(true);
      };

      return () => {
        isMounted = false;
      };
    }, []);

    // 2. Initialize or update YT.Player instance when API is ready and videoId is supplied
    useEffect(() => {
      if (!isApiReady || !containerRef.current) return;

      // If player instance already exists and videoId changed, load new video without destroying player
      if (playerRef.current) {
        if (videoId && typeof playerRef.current.loadVideoById === 'function') {
          try {
            setIsLoading(true);
            setPlayerError(null);
            playerRef.current.loadVideoById(videoId);
          } catch {
            // fallback to recreation if loadVideoById fails
          }
        }
        return;
      }

      if (!videoId) return;

      setIsLoading(true);
      setPlayerError(null);

      try {
        const player = new window.YT!.Player(elementIdRef.current, {
          height: '100%',
          width: '100%',
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              setIsLoading(false);
              if (onReadyRef.current) onReadyRef.current();
            },
            onStateChange: (event) => {
              const state = event.data;
              // Clear loading spinner when video enters playing (1), paused (2), buffering (3), or ended (0)
              if (state === 1 || state === 2 || state === 3 || state === 0) {
                setIsLoading(false);
              }
              const currentTime = player.getCurrentTime ? player.getCurrentTime() : 0;
              if (onStateChangeRef.current) onStateChangeRef.current(state, currentTime);
            },
            onError: (event) => {
              setIsLoading(false);
              const errCode = event.data;
              let errMsg = 'Playback error occurred';
              if (errCode === 2) errMsg = 'Invalid YouTube video ID parameter';
              if (errCode === 5) errMsg = 'HTML5 player playback error';
              if (errCode === 100) errMsg = 'Video not found or has been removed';
              if (errCode === 101 || errCode === 150) {
                errMsg = 'The video uploader does not allow this video to be played in embedded players';
              }
              setPlayerError(errMsg);
              if (onErrorRef.current) onErrorRef.current(errCode);
            },
          },
        });

        playerRef.current = player;
      } catch (err: unknown) {
        setIsLoading(false);
        setPlayerError(err instanceof Error ? err.message : 'Failed to initialize YouTube player');
      }

      return () => {
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch {
            // ignore destroy errors
          }
          playerRef.current = null;
        }
      };
    }, [isApiReady, videoId]);

    if (!videoId) {
      return (
        <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-950 text-slate-400">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
            <Play className="w-10 h-10 text-slate-500 ml-1" />
          </div>
          <h3 className="text-base font-bold text-slate-200">No Video Loaded</h3>
          <p className="text-xs text-slate-500 max-w-xs">
            Enter a YouTube video URL below to start watching synchronously.
          </p>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full min-h-[300px] bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* Loading Spinner Overlay */}
        {isLoading && !playerError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90 text-indigo-400 space-y-2">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Loading YouTube player...</p>
          </div>
        )}

        {/* Error Overlay */}
        {playerError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 space-y-3">
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
              <Lock className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-bold text-rose-300">Video Unavailable</h4>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">{playerError}</p>
          </div>
        )}

        {/* Player IFrame Container */}
        <div ref={containerRef} className="w-full h-full">
          <div id={elementIdRef.current} className="w-full h-full" />
        </div>
      </div>
    );
  }
);

YouTubePlayer.displayName = 'YouTubePlayer';
