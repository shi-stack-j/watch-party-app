import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Share2,
  LogOut,
  Trash2,
  Copy,
  Check,
  Volume2,
  Users,
  MessageSquare,
  Send,
  Shield,
  Clock,
  Youtube,
  Radio,
  AlertCircle,
  Play,
  Pause,
  Loader2,
  UserCheck,
} from 'lucide-react';
import { UserRole, RoomParticipant, Room } from '../types';
import { JoinRequest } from '../types/approval';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getRoomByIdOrCode, leaveRoom, deleteRoom, getRoomParticipants, updateRoomVideo, updateParticipantRole } from '../services/roomApi';
import {
  requestRoomAccess,
  getPendingRequests,
  getUserRequestStatus,
  decideJoinRequest,
} from '../services/approvalApi';
import { parseYouTubeUrl } from '../utils/youtubeUrl';
import { YouTubePlayer, YouTubePlayerRef } from '../components/YouTubePlayer';
import { usePlaybackSync } from '../hooks/usePlaybackSync';
import { useRoomChat } from '../hooks/useRoomChat';
import { useRoomReactions } from '../hooks/useRoomReactions';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { RoleBadge } from '../components/ui/RoleBadge';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { socket } from '../socket';

export const WatchRoomPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active User Role & Membership Status
  const [userRole, setUserRole] = useState<UserRole>('PARTICIPANT');
  const [isMember, setIsMember] = useState<boolean>(false);
  const [userRequest, setUserRequest] = useState<JoinRequest | null>(null);
  const [isRequestingAccess, setIsRequestingAccess] = useState<boolean>(false);

  const [isCopied, setIsCopied] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Video State
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isUpdatingVideo, setIsUpdatingVideo] = useState(false);

  // Participants & Approval Requests State
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  // YouTube Player Imperative Ref
  const playerRef = useRef<YouTubePlayerRef | null>(null);

  const isHost = Boolean(room && user && (room.hostId === user.id || userRole === 'HOST'));
  const isModerator = userRole === 'MODERATOR';
  const canManageApprovals = isHost || isModerator;
  const canControlPlayback = isHost || isModerator;
  const canChangeVideo = isHost || isModerator;

  // Real-Time Room Chat Hook
  const {
    messages,
    isLoadingHistory,
    chatError,
    sendMessage,
    messagesEndRef,
  } = useRoomChat({ roomId: room?.id, isMember });

  // Real-Time Emoji Reactions Hook
  const { activeReactions, reactionError, sendReaction } = useRoomReactions({
    roomId: room?.id,
    isMember,
  });

  const handleVideoIdChange = useCallback((newVideoId: string) => {
    setCurrentVideoId(newVideoId);
  }, []);

  // Playback Synchronization
  const {
    autoplayBlocked,
    isRemoteUpdateRef,
    emitHostPlay,
    emitHostPause,
    emitHostSeek,
    dismissAutoplayNotice,
  } = usePlaybackSync({
    roomId: room?.id,
    isHost,
    canControlPlayback,
    playerRef,
    onVideoIdChange: handleVideoIdChange,
  });

  const hasShownReadyToastRef = useRef(false);
  const handlePlayerReady = useCallback(() => {
    if (!hasShownReadyToastRef.current) {
      addToast('YouTube player ready', 'info');
      hasShownReadyToastRef.current = true;
    }
  }, [addToast]);

  const handlePlayerStateChange = useCallback(
    (state: number, currentTime: number) => {
      if (!canControlPlayback || isRemoteUpdateRef.current) return;
      if (state === 1) {
        emitHostPlay(currentTime);
      } else if (state === 2) {
        emitHostPause(currentTime);
      }
    },
    [canControlPlayback, isRemoteUpdateRef, emitHostPlay, emitHostPause]
  );

  // Fetch initial room data, membership, and join request status
  const fetchRoomData = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError(null);
    try {
      const roomRes = await getRoomByIdOrCode(roomId);
      if (roomRes.success && roomRes.data) {
        setRoom(roomRes.data);

        if (roomRes.data.currentVideoUrl) {
          const parsed = parseYouTubeUrl(roomRes.data.currentVideoUrl);
          if (parsed.isValid && parsed.videoId) {
            setCurrentVideoId(parsed.videoId);
          }
        }

        const hostStatus = user && roomRes.data.hostId === user.id;
        if (hostStatus) {
          setUserRole('HOST');
          setIsMember(true);
        }

        // Fetch participants list
        const partRes = await getRoomParticipants(roomRes.data.id);
        if (partRes.success && partRes.data) {
          setParticipants(partRes.data);
          const currentMember = partRes.data.find((p) => p.userId === user?.id);
          if (currentMember) {
            setUserRole(currentMember.role);
            setIsMember(Boolean(currentMember.isApproved || hostStatus));
          } else if (hostStatus) {
            setIsMember(true);
          }
        }

        // Check user request status if not host/approved member
        if (!hostStatus && user) {
          const statusRes = await getUserRequestStatus(roomRes.data.id);
          if (statusRes.success && statusRes.data) {
            setUserRequest(statusRes.data);
          }
        }

        // Fetch pending requests for Host/Moderator
        if (hostStatus || userRole === 'MODERATOR') {
          const reqRes = await getPendingRequests(roomRes.data.id);
          if (reqRes.success && reqRes.data) {
            setPendingRequests(reqRes.data);
          }
        }
      } else {
        setError(roomRes.message || 'Room not found or access denied');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to load watch room details');
      }
    } finally {
      setLoading(false);
    }
  }, [roomId, user, userRole]);

  useEffect(() => {
    fetchRoomData();
  }, [fetchRoomData]);

  // Real-Time Participant Sync & Room Event Listeners
  useEffect(() => {
    if (!room) return;

    const onParticipantJoined = (data: {
      success: boolean;
      roomId: string;
      participant: RoomParticipant;
    }) => {
      if (data.success && data.roomId === room.id && data.participant) {
        setParticipants((prev) => {
          const exists = prev.some((p) => p.userId === data.participant.userId);
          if (exists) {
            return prev.map((p) => (p.userId === data.participant.userId ? data.participant : p));
          }
          return [...prev, data.participant];
        });
      }
    };

    const onParticipantLeft = (data: {
      success: boolean;
      roomId: string;
      userId: string;
      username?: string;
    }) => {
      if (data.success && data.roomId === room.id && data.userId) {
        setParticipants((prev) => prev.filter((p) => p.userId !== data.userId));
      }
    };

    const onParticipantRoleUpdated = (data: {
      success: boolean;
      roomId: string;
      targetUserId: string;
      newRole: UserRole;
      participants?: RoomParticipant[];
    }) => {
      if (data.success && data.roomId === room.id) {
        if (data.participants) {
          setParticipants(data.participants);
        } else {
          getRoomParticipants(room.id).then((res) => {
            if (res.success && res.data) setParticipants(res.data);
          });
        }

        if (data.targetUserId === user?.id) {
          setUserRole(data.newRole);
          addToast(
            data.newRole === 'MODERATOR'
              ? 'You have been promoted to Moderator!'
              : 'Your role was changed to Participant.',
            data.newRole === 'MODERATOR' ? 'success' : 'info'
          );
        }
      }
    };

    const onNewJoinRequest = (data: { success: boolean; request: JoinRequest }) => {
      if (data.success && data.request && data.request.roomId === room.id && canManageApprovals) {
        setPendingRequests((prev) => {
          if (prev.some((r) => r.id === data.request.id)) return prev;
          return [...prev, data.request];
        });
        addToast(`New join request from ${data.request.username}`, 'info');
      }
    };

    const onRequestStatusUpdated = (data: { success: boolean; request: JoinRequest }) => {
      if (data.success && data.request && data.request.roomId === room.id) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== data.request.id));
        getRoomParticipants(room.id).then((res) => {
          if (res.success && res.data) setParticipants(res.data);
        });
      }
    };

    socket.on('participant_joined', onParticipantJoined);
    socket.on('participant_left', onParticipantLeft);
    socket.on('participant_role_updated', onParticipantRoleUpdated);
    socket.on('room_join_request_new', onNewJoinRequest);
    socket.on('room_join_request_status', onRequestStatusUpdated);

    return () => {
      socket.off('participant_joined', onParticipantJoined);
      socket.off('participant_left', onParticipantLeft);
      socket.off('participant_role_updated', onParticipantRoleUpdated);
      socket.off('room_join_request_new', onNewJoinRequest);
      socket.off('room_join_request_status', onRequestStatusUpdated);
    };
  }, [room, user, canManageApprovals, addToast]);

  // Host Role Assignment Handler
  const handleToggleParticipantRole = async (targetParticipant: RoomParticipant) => {
    if (!room || !isHost) return;
    const newRole: UserRole = targetParticipant.role === 'MODERATOR' ? 'PARTICIPANT' : 'MODERATOR';
    try {
      const response = await updateParticipantRole(room.id, targetParticipant.userId, newRole);
      if (response.success) {
        socket.emit('update_participant_role', {
          roomId: room.id,
          targetUserId: targetParticipant.userId,
          newRole,
        });
        addToast(
          `Updated ${targetParticipant.user?.username || 'user'}'s role to ${newRole}`,
          'success'
        );
        const partRes = await getRoomParticipants(room.id);
        if (partRes.success && partRes.data) {
          setParticipants(partRes.data);
        }
      } else {
        addToast(response.message || 'Failed to update participant role', 'error');
      }
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error updating role', 'error');
    }
  };

  // Copy invitation link
  const handleCopyLink = () => {
    const codeToCopy = room?.code || roomId;
    const inviteUrl = `${window.location.origin}/room/${codeToCopy}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteUrl);
      setIsCopied(true);
      addToast('Room invite link copied to clipboard!', 'success');
      setTimeout(() => setIsCopied(false), 2500);
    } else {
      addToast(`Invite Code: ${codeToCopy}`, 'info', 'Share Code');
    }
  };

  // Video URL submit handler (Host only)
  const handleLoadVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setVideoError(null);

    const input = videoUrlInput.trim();
    const parseResult = parseYouTubeUrl(input);

    if (!parseResult.isValid || !parseResult.videoId) {
      setVideoError(parseResult.error || 'Invalid YouTube URL or ID format');
      return;
    }

    if (!room) return;

    setIsUpdatingVideo(true);
    try {
      const response = await updateRoomVideo(room.id, input);
      if (response.success && response.data) {
        setRoom(response.data);
        setCurrentVideoId(parseResult.videoId);
        setVideoUrlInput('');
        addToast('Room video updated successfully!', 'success');
      } else {
        setVideoError(response.message || 'Failed to update room video');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setVideoError(err.message);
      } else {
        setVideoError('Error updating room video');
      }
    } finally {
      setIsUpdatingVideo(false);
    }
  };

  // Request Access Handler (for non-member/pending users)
  const handleRequestAccess = async () => {
    if (!room) return;
    setIsRequestingAccess(true);
    try {
      const response = await requestRoomAccess(room.id);
      if (response.success && response.data) {
        setUserRequest(response.data);
        addToast('Access request submitted to room host', 'success');
      } else {
        addToast(response.message || 'Failed to submit access request', 'error');
      }
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error requesting access', 'error');
    } finally {
      setIsRequestingAccess(false);
    }
  };

  // Approve / Reject Request Handler (Host / Moderator)
  const handleDecideRequest = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const response = await decideJoinRequest(requestId, action);
      if (response.success) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
        addToast(`Join request ${action.toLowerCase()}d successfully`, 'success');
        // Refresh participants
        if (room) {
          const partRes = await getRoomParticipants(room.id);
          if (partRes.success && partRes.data) {
            setParticipants(partRes.data);
          }
        }
      } else {
        addToast(response.message || 'Failed to update request', 'error');
      }
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error updating request', 'error');
    }
  };

  // Leave Room Handler
  const handleConfirmLeave = async () => {
    if (!room) return;
    try {
      const response = await leaveRoom(room.id);
      if (response.success) {
        addToast('Left watch room', 'info');
        navigate('/dashboard');
      } else {
        addToast(response.message || 'Unable to leave room', 'error');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        addToast(err.message, 'error');
      }
    } finally {
      setIsLeaveDialogOpen(false);
    }
  };

  // Delete Room Handler (Host only)
  const handleConfirmDelete = async () => {
    if (!room) return;
    try {
      const response = await deleteRoom(room.id);
      if (response.success) {
        addToast('Room deleted successfully', 'success');
        navigate('/dashboard');
      } else {
        addToast(response.message || 'Unable to delete room', 'error');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        addToast(err.message, 'error');
      }
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  // Send message handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSendingChat) return;

    setIsSendingChat(true);
    const sent = await sendMessage(chatInput.trim());
    setIsSendingChat(false);

    if (sent) {
      setChatInput('');
    }
  };

  if (loading) {
    return <LoadingIndicator message="Loading watch room details..." />;
  }

  if (error || !room) {
    return (
      <div className="py-12 max-w-lg mx-auto text-center space-y-4">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 flex items-center justify-center space-x-2">
          <AlertCircle className="w-5 h-5 text-rose-400" />
          <span>{error || 'Room unavailable'}</span>
        </div>
        <Button variant="secondary" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Room Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-3 flex-wrap gap-y-1">
            <h1 className="text-xl font-bold text-slate-100">{room.title}</h1>
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>CODE: {room.code}</span>
            </span>
            <RoleBadge role={userRole} size="sm" />
          </div>
          <p className="text-xs text-slate-400">
            Host: <span className="text-slate-300 font-semibold">{room.host?.username || 'User'}</span>
            {room.description && ` • ${room.description}`}
          </p>
        </div>

        <div className="flex items-center space-x-3 flex-wrap gap-2 w-full md:w-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyLink}
            leftIcon={isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          >
            {isCopied ? 'Copied' : 'Invite Link'}
          </Button>

          {isHost ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Delete Room
            </Button>
          ) : isMember ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsLeaveDialogOpen(true)}
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Leave Room
            </Button>
          ) : null}
        </div>
      </div>

      {/* Non-Member / Access Request Banner */}
      {!isMember && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-3 text-slate-200">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-300">Room Access Restricted</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                This is a private watch room. You must be approved by the host or moderator before accessing live playback, chat, and reactions.
              </p>
              {userRequest ? (
                <div className="pt-2 flex items-center space-x-2 text-xs font-medium">
                  <span className="text-slate-400">Request Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      userRequest.status === 'PENDING'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : userRequest.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {userRequest.status}
                  </span>
                  {userRequest.status === 'PENDING' && (
                    <span className="text-[11px] text-slate-400 animate-pulse">Waiting for host approval...</span>
                  )}
                </div>
              ) : (
                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleRequestAccess}
                    isLoading={isRequestingAccess}
                    leftIcon={<UserCheck className="w-4 h-4" />}
                  >
                    Submit Request to Join
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Video Player + Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Video Player & Controls */}
        <div className="lg:col-span-2 space-y-4">
          {/* 16:9 YouTube Player Container */}
          <div className="aspect-video bg-slate-950 rounded-2xl border border-slate-800 relative overflow-hidden flex flex-col justify-between shadow-2xl group">
            {/* Real-Time Floating Reactions Overlay */}
            <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
              {activeReactions.map((r) => (
                <div
                  key={r.id}
                  className="absolute bottom-12 left-1/2 transform -translate-x-1/2 flex flex-col items-center animate-bounce"
                  style={{ animationDuration: '1.5s' }}
                >
                  <span className="text-4xl drop-shadow-lg">{r.emoji}</span>
                  <span className="text-[10px] font-bold bg-slate-900/90 text-slate-200 px-1.5 py-0.5 rounded-md border border-slate-700 mt-1 shadow-md">
                    {r.senderName}
                  </span>
                </div>
              ))}
            </div>

            {/* Autoplay Blocked Notice Overlay */}
            {autoplayBlocked && (
              <div className="absolute inset-0 z-40 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-400 animate-pulse" />
                <h4 className="text-sm font-bold text-slate-100">Autoplay Blocked by Browser</h4>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Your browser prevented automatic playback. Click below to synchronize and start watching.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    dismissAutoplayNotice();
                    playerRef.current?.playVideo();
                  }}
                >
                  Click to Unmute & Play
                </Button>
              </div>
            )}

            {/* Official YouTube IFrame Player */}
            <YouTubePlayer
              ref={playerRef}
              videoId={currentVideoId}
              onReady={handlePlayerReady}
              onStateChange={handlePlayerStateChange}
            />

            {/* Player Info Bar */}
            <div className="bg-slate-900/90 border-t border-slate-800 p-3 flex items-center justify-between text-xs text-slate-300 z-20 flex-wrap gap-2">
              <div className="flex items-center space-x-3">
                <Volume2 className="w-4 h-4 text-slate-400" />
                <span className="text-[11px] text-slate-400">YouTube Sync Engine</span>
              </div>

              {/* Host / Moderator Control Quick Actions */}
              {canControlPlayback && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="px-2 py-1 text-[11px]"
                    onClick={() => emitHostPlay()}
                  >
                    <Play className="w-3 h-3 mr-1 text-emerald-400 fill-emerald-400" /> Play
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="px-2 py-1 text-[11px]"
                    onClick={() => emitHostPause()}
                  >
                    <Pause className="w-3 h-3 mr-1 text-amber-400 fill-amber-400" /> Pause
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="px-2 py-1 text-[11px]"
                    onClick={() => {
                      const cur = playerRef.current?.getCurrentTime() ?? 0;
                      emitHostSeek(Math.max(0, cur - 10));
                    }}
                  >
                    -10s
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="px-2 py-1 text-[11px]"
                    onClick={() => {
                      const cur = playerRef.current?.getCurrentTime() ?? 0;
                      emitHostSeek(cur + 10);
                    }}
                  >
                    +10s
                  </Button>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <RoleBadge role={userRole} size="sm" />
              </div>
            </div>
          </div>

          {/* YouTube Video Input Bar (Host & Moderator) */}
          {canChangeVideo ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                <Share2 className="w-4 h-4 text-indigo-400" />
                <span>Change Room Video URL</span>
              </h3>

              <form onSubmit={handleLoadVideo} className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ or video ID"
                    value={videoUrlInput}
                    onChange={(e) => setVideoUrlInput(e.target.value)}
                    error={videoError || undefined}
                    disabled={isUpdatingVideo}
                    leftIcon={<Youtube className="w-4 h-4 text-rose-500" />}
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isUpdatingVideo}
                >
                  Update Video
                </Button>
              </form>
            </div>
          ) : (
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-400">
              Only the room host or moderator can change the current room video.
            </div>
          )}

          {/* Real-Time Emoji Reaction Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Live Reactions:</span>
              {reactionError && <span className="text-[10px] text-rose-400">{reactionError}</span>}
            </div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-2">
              {['😂', '❤️', '👍', '😮', '🎉', '🔥'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  disabled={!isMember}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition text-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isMember ? `Send ${emoji} reaction` : 'Must be an approved room member'}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Approval Requests Queue (Visible for Host & Moderator) */}
          {canManageApprovals && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <span>Pending Approval Requests</span>
                </h3>
                <span className="text-xs text-slate-500">
                  {pendingRequests.length} pending
                </span>
              </div>

              {pendingRequests.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-3">No pending join requests.</p>
              ) : (
                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                    >
                      <div className="space-y-0.5">
                        <p className="font-semibold text-slate-200">
                          {req.username} <span className="font-normal text-slate-400">({req.userEmail})</span>
                        </p>
                        <p className="text-[10px] text-slate-500 flex items-center space-x-1">
                          <Clock className="w-3 h-3 inline" />
                          <span>{new Date(req.createdAt).toLocaleTimeString()}</span>
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDecideRequest(req.id, 'REJECT')}
                          className="px-2.5 py-1 text-xs"
                        >
                          Reject
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleDecideRequest(req.id, 'APPROVE')}
                          className="px-2.5 py-1 text-xs"
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right 1 Column: Participants & Chat Panels */}
        <div className="space-y-6 flex flex-col justify-between">
          {/* Participants Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Participants ({participants.length})</span>
              </h3>
            </div>

            <ul className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
              {participants.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-bold flex items-center justify-center text-xs">
                      {p.user?.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200">{p.user?.username}</p>
                      <span className="text-[10px] text-emerald-400">
                        {p.isApproved ? 'Approved Member' : 'Pending Approval'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RoleBadge role={p.role} size="sm" />
                    {isHost && p.userId !== room.hostId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className={`text-[10px] px-2 py-0.5 ${
                          p.role === 'MODERATOR'
                            ? 'text-amber-400 border-amber-500/30 hover:bg-amber-500/10'
                            : 'text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10'
                        }`}
                        onClick={() => handleToggleParticipantRole(p)}
                      >
                        {p.role === 'MODERATOR' ? 'Demote' : 'Promote'}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Persistent Real-Time Chat Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 flex-1 flex flex-col justify-between min-h-[380px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span>Live Party Chat</span>
              </h3>
              {isLoadingHistory ? (
                <span className="text-[10px] text-indigo-400 flex items-center space-x-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading history...</span>
                </span>
              ) : (
                <span className="text-[10px] text-emerald-400 font-mono">Live Sync</span>
              )}
            </div>

            {/* Error Message */}
            {chatError && (
              <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">
                {chatError}
              </div>
            )}

            {/* Messages List */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] custom-scrollbar pr-1">
              {!isMember ? (
                <div className="text-xs text-slate-500 text-center py-12 space-y-1">
                  <Shield className="w-6 h-6 text-slate-600 mx-auto" />
                  <p>Room chat is restricted to approved members.</p>
                </div>
              ) : messages.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  No chat messages yet. Type below to chat with room members.
                </p>
              ) : (
                messages.map((m) => {
                  const isMe = m.senderId === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={`p-2.5 rounded-xl space-y-1 text-xs border ${
                        isMe
                          ? 'bg-indigo-600/20 border-indigo-500/40 ml-4'
                          : 'bg-slate-950/80 border-slate-800/80 mr-4'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className={`font-bold ${isMe ? 'text-indigo-300' : 'text-slate-200'}`}>
                            {isMe ? 'You' : m.senderName}
                          </span>
                          <RoleBadge role={m.senderRole as UserRole} size="sm" />
                        </div>
                        <span className="text-[10px] text-slate-500">{m.timestamp}</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Form */}
            <form onSubmit={handleSendMessage} className="pt-2 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                placeholder={isMember ? 'Type a message...' : 'Approval required to chat'}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={!isMember || isSendingChat}
                className="flex-1 bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-indigo-500 text-slate-100 placeholder-slate-500 text-xs rounded-lg px-3 py-2 transition focus:outline-none disabled:opacity-50"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="px-3"
                disabled={!isMember || isSendingChat || !chatInput.trim()}
                isLoading={isSendingChat}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Leave Room Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isLeaveDialogOpen}
        onClose={() => setIsLeaveDialogOpen(false)}
        onConfirm={handleConfirmLeave}
        title="Leave Watch Party"
        message="Are you sure you want to leave this watch room?"
        confirmText="Leave Room"
      />

      {/* Delete Room Confirmation Dialog (Host Only) */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Watch Room"
        message="Are you sure you want to delete this watch room? This action will close the room for all participants."
        confirmText="Delete Room"
      />
    </div>
  );
};
