import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cookie from 'cookie';
import signature from 'cookie-signature';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { UserSessionData } from '../middleware/auth';
import { Store } from 'express-session';
import { prisma } from '../config/prisma';
import { Role } from '@prisma/client';
import { playbackStateService } from '../services/playbackStateService';
import { createChatMessage, getChatHistory } from '../services/chatService';
import { createJoinRequest, decideJoinRequest } from '../services/approvalService';
import { updateParticipantRole, getRoomParticipants } from '../services/roomService';

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: UserSessionData;
  };
}

const ALLOWED_REACTION_EMOJIS = ['😂', '❤️', '👍', '😮', '🎉', '🔥'];
const socketReactionTimestamps = new Map<string, number[]>();

export const initSocket = (httpServer: HttpServer, sessionStore?: Store): SocketIOServer => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Socket.IO Handshake Authentication Middleware
  io.use((socket: Socket, next) => {
    try {
      const rawCookieHeader = socket.request.headers.cookie;
      if (!rawCookieHeader) {
        return next(new Error('Unauthorized: Missing authentication cookies'));
      }

      const parsedCookies = cookie.parse(rawCookieHeader);
      const rawSessionCookie = parsedCookies['watchparty_sid'];

      if (!rawSessionCookie) {
        return next(new Error('Unauthorized: Missing session cookie'));
      }

      // Unsign session cookie (remove 's:' prefix and verify signature)
      const unsignedSid = rawSessionCookie.startsWith('s:')
        ? signature.unsign(rawSessionCookie.slice(2), env.SESSION_SECRET)
        : rawSessionCookie;

      if (!unsignedSid) {
        return next(new Error('Unauthorized: Invalid session signature'));
      }

      if (sessionStore) {
        sessionStore.get(unsignedSid, (err, sessionData) => {
          if (err || !sessionData || !sessionData.user) {
            return next(new Error('Unauthorized: Invalid or expired session'));
          }
          // Attach server-verified user identity to socket
          socket.data.user = sessionData.user;
          return next();
        });
      } else {
        return next(new Error('Unauthorized: Session store offline'));
      }
    } catch {
      return next(new Error('Unauthorized: Socket authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as AuthenticatedSocket).data.user;
    logger.info(`Authenticated Socket connected: ${socket.id} (user: ${user?.username} / ${user?.userId})`);

    // Authorize room join with database membership & approval check
    socket.on('join_room', async (data: { roomId: string }, ackCallback?: (response: unknown) => void) => {
      try {
        if (!user || !user.userId) {
          socket.emit('room_error', { message: 'Authentication required' });
          if (ackCallback) ackCallback({ success: false, message: 'Authentication required' });
          return;
        }

        const roomIdInput = data?.roomId;
        if (!roomIdInput) {
          socket.emit('room_error', { message: 'Room ID is required' });
          if (ackCallback) ackCallback({ success: false, message: 'Room ID is required' });
          return;
        }

        // Find room by ID or code
        const room = await prisma.room.findFirst({
          where: {
            OR: [{ id: roomIdInput }, { code: roomIdInput }, { inviteCode: roomIdInput }],
          },
        });

        if (!room) {
          socket.emit('room_error', { message: 'Room not found' });
          if (ackCallback) ackCallback({ success: false, message: 'Room not found' });
          return;
        }

        // Verify membership and approval in database
        const isHost = room.hostId === user.userId;
        const participant = await prisma.roomParticipant.findUnique({
          where: {
            roomId_userId: {
              roomId: room.id,
              userId: user.userId,
            },
          },
        });

        if (!isHost && (!participant || !participant.isApproved)) {
          logger.warn(`Unauthorized socket room join attempt: User ${user.username} for Room ${room.id}`);
          const errMsg = !participant
            ? 'Forbidden: Not a room member'
            : 'Forbidden: Your join request is pending approval';
          socket.emit('room_error', { message: errMsg });
          if (ackCallback) ackCallback({ success: false, message: errMsg });
          return;
        }

        // Leave previous rooms if any
        socket.rooms.forEach((r) => {
          if (r !== socket.id) socket.leave(r);
        });

        socket.join(room.id);
        logger.info(`Authorized Socket ${socket.id} (${user.username}) joined room ${room.id}`);

        // Fetch latest authoritative playback snapshot
        const snapshot = await playbackStateService.getSnapshot(room.id);

        socket.emit('playback_snapshot', {
          success: true,
          state: snapshot,
        });

        const fullParticipant = await prisma.roomParticipant.findFirst({
          where: {
            roomId: room.id,
            userId: user.userId,
          },
          include: {
            user: { select: { id: true, username: true, email: true } },
          },
        });

        const safeParticipant = fullParticipant ? {
          id: fullParticipant.id,
          roomId: fullParticipant.roomId,
          userId: fullParticipant.userId,
          role: fullParticipant.role,
          isApproved: fullParticipant.isApproved,
          joinedAt: fullParticipant.joinedAt,
          user: fullParticipant.user,
        } : {
          id: `${room.id}_${user.userId}`,
          roomId: room.id,
          userId: user.userId,
          role: isHost ? Role.HOST : Role.PARTICIPANT,
          isApproved: true,
          joinedAt: new Date(),
          user: { id: user.userId, username: user.username, email: user.email },
        };

        io.to(room.id).emit('participant_joined', {
          success: true,
          roomId: room.id,
          participant: safeParticipant,
        });

        io.to(room.id).emit('user_joined', {
          socketId: socket.id,
          user: { id: user.userId, username: user.username },
          roomId: room.id,
        });

        if (ackCallback) {
          ackCallback({
            success: true,
            message: 'Joined socket room successfully',
            room: { id: room.id, title: room.title },
            state: snapshot,
          });
        }
      } catch (err: unknown) {
        logger.error('Error during socket room join:', err instanceof Error ? err.message : String(err));
        socket.emit('room_error', { message: 'Internal socket room error' });
        if (ackCallback) ackCallback({ success: false, message: 'Internal socket room error' });
      }
    });

    // Request playback snapshot
    socket.on('request_playback_snapshot', async (data: { roomId: string }) => {
      try {
        if (!user?.userId || !data?.roomId) return;
        const room = await prisma.room.findFirst({
          where: { OR: [{ id: data.roomId }, { code: data.roomId }, { inviteCode: data.roomId }] },
        });
        if (!room) return;
        const isHost = room.hostId === user.userId;
        const participant = await prisma.roomParticipant.findUnique({
          where: { roomId_userId: { roomId: room.id, userId: user.userId } },
        });
        if (room.isPrivate && !isHost && (!participant || !participant.isApproved)) {
          socket.emit('playback_error', { success: false, message: 'Forbidden: Private room video access requires host approval' });
          return;
        }
        const snapshot = await playbackStateService.getSnapshot(room.id);
        socket.emit('playback_snapshot', { success: true, state: snapshot });
      } catch (err: unknown) {
        logger.error('Error fetching playback snapshot:', err instanceof Error ? err.message : String(err));
      }
    });

    // Playback permission checker
    const verifyPlaybackPermission = async (roomId: string, userId: string) => {
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) return { isAuthorized: false, room: null };

      if (room.hostId === userId) return { isAuthorized: true, room };

      const participant = await prisma.roomParticipant.findUnique({
        where: {
          roomId_userId: {
            roomId: room.id,
            userId,
          },
        },
      });

      const isAuthorized = participant?.role === Role.MODERATOR;
      return { isAuthorized, room };
    };

    // Playback Commands (Host & Moderator)
    socket.on('host_playback_play', async (data: { roomId: string; position?: number }, ackCallback?: (res: unknown) => void) => {
      try {
        if (!user?.userId || !data?.roomId) return;
        const { isAuthorized, room } = await verifyPlaybackPermission(data.roomId, user.userId);
        if (!room || !isAuthorized) {
          const errRes = { success: false, message: 'Only room host or moderator can control video playback' };
          socket.emit('playback_error', errRes);
          if (ackCallback) ackCallback(errRes);
          return;
        }

        const newState = await playbackStateService.updatePlaybackState(
          room.id,
          user.userId,
          user.username,
          'PLAY',
          { position: data.position }
        );

        io.to(room.id).emit('playback_state_updated', { success: true, state: newState });
        if (ackCallback) ackCallback({ success: true, state: newState });
      } catch (err: unknown) {
        const errRes = { success: false, message: err instanceof Error ? err.message : 'Play command error' };
        socket.emit('playback_error', errRes);
        if (ackCallback) ackCallback(errRes);
      }
    });

    socket.on('host_playback_pause', async (data: { roomId: string; position?: number }, ackCallback?: (res: unknown) => void) => {
      try {
        if (!user?.userId || !data?.roomId) return;
        const { isAuthorized, room } = await verifyPlaybackPermission(data.roomId, user.userId);
        if (!room || !isAuthorized) {
          const errRes = { success: false, message: 'Only room host or moderator can control video playback' };
          socket.emit('playback_error', errRes);
          if (ackCallback) ackCallback(errRes);
          return;
        }

        const newState = await playbackStateService.updatePlaybackState(
          room.id,
          user.userId,
          user.username,
          'PAUSE',
          { position: data.position }
        );

        io.to(room.id).emit('playback_state_updated', { success: true, state: newState });
        if (ackCallback) ackCallback({ success: true, state: newState });
      } catch (err: unknown) {
        const errRes = { success: false, message: err instanceof Error ? err.message : 'Pause command error' };
        socket.emit('playback_error', errRes);
        if (ackCallback) ackCallback(errRes);
      }
    });

    socket.on('host_playback_seek', async (data: { roomId: string; position: number }, ackCallback?: (res: unknown) => void) => {
      try {
        if (!user?.userId || !data?.roomId) return;
        if (typeof data.position !== 'number' || data.position < 0) {
          const errRes = { success: false, message: 'Invalid seek position' };
          socket.emit('playback_error', errRes);
          if (ackCallback) ackCallback(errRes);
          return;
        }

        const { isAuthorized, room } = await verifyPlaybackPermission(data.roomId, user.userId);
        if (!room || !isAuthorized) {
          const errRes = { success: false, message: 'Only room host or moderator can control video playback' };
          socket.emit('playback_error', errRes);
          if (ackCallback) ackCallback(errRes);
          return;
        }

        const newState = await playbackStateService.updatePlaybackState(
          room.id,
          user.userId,
          user.username,
          'SEEK',
          { position: data.position }
        );

        io.to(room.id).emit('playback_state_updated', { success: true, state: newState });
        if (ackCallback) ackCallback({ success: true, state: newState });
      } catch (err: unknown) {
        const errRes = { success: false, message: err instanceof Error ? err.message : 'Seek command error' };
        socket.emit('playback_error', errRes);
        if (ackCallback) ackCallback(errRes);
      }
    });

    // Update Participant Role Command (Host Only)
    socket.on('update_participant_role', async (data: { roomId: string; targetUserId: string; newRole: Role }, ackCallback?: (res: unknown) => void) => {
      try {
        if (!user?.userId || !data?.roomId || !data?.targetUserId || !data?.newRole) {
          const errRes = { success: false, message: 'Missing parameters for role update' };
          socket.emit('role_error', errRes);
          if (ackCallback) ackCallback(errRes);
          return;
        }

        const updatedRoom = await updateParticipantRole(data.roomId, user.userId, data.targetUserId, data.newRole);
        const updatedParticipants = await getRoomParticipants(data.roomId, user.userId);

        io.to(updatedRoom.id).emit('participant_role_updated', {
          success: true,
          roomId: updatedRoom.id,
          targetUserId: data.targetUserId,
          newRole: data.newRole,
          participants: updatedParticipants,
        });

        if (ackCallback) ackCallback({ success: true, room: updatedRoom, participants: updatedParticipants });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Error updating participant role';
        const errRes = { success: false, message: errMsg };
        socket.emit('role_error', errRes);
        if (ackCallback) ackCallback(errRes);
      }
    });

    // --- PHASE 7 FEATURE A: PERSISTENT REAL-TIME CHAT ---
    socket.on('chat_send_message', async (data: { roomId: string; content: string }, ackCallback?: (res: unknown) => void) => {
      try {
        if (!user?.userId || !data?.roomId) {
          const errRes = { success: false, message: 'Authentication and Room ID required' };
          socket.emit('chat_message_error', errRes);
          if (ackCallback) ackCallback(errRes);
          return;
        }

        const messageResponse = await createChatMessage(data.roomId, user.userId, data.content);

        // Broadcast saved message to room members
        io.to(messageResponse.roomId).emit('chat_new_message', {
          success: true,
          message: messageResponse,
        });

        if (ackCallback) {
          ackCallback({ success: true, message: messageResponse });
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Error sending message';
        const errRes = { success: false, message: errMsg };
        socket.emit('chat_message_error', errRes);
        if (ackCallback) ackCallback(errRes);
      }
    });

    socket.on('chat_get_history', async (data: { roomId: string; limit?: number }, ackCallback?: (res: unknown) => void) => {
      try {
        if (!user?.userId || !data?.roomId) {
          if (ackCallback) ackCallback({ success: false, message: 'Authentication and Room ID required' });
          return;
        }

        const history = await getChatHistory(data.roomId, user.userId, data.limit || 50);

        socket.emit('chat_history', {
          success: true,
          roomId: data.roomId,
          history,
        });

        if (ackCallback) {
          ackCallback({ success: true, history });
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Error fetching chat history';
        socket.emit('chat_message_error', { success: false, message: errMsg });
        if (ackCallback) ackCallback({ success: false, message: errMsg });
      }
    });

    // --- PHASE 7 FEATURE B: REAL-TIME EMOJI REACTIONS ---
    socket.on('reaction_send', async (data: { roomId: string; emoji: string }, ackCallback?: (res: unknown) => void) => {
      try {
        if (!user?.userId || !data?.roomId || !data?.emoji) {
          if (ackCallback) ackCallback({ success: false, message: 'Missing reaction parameters' });
          return;
        }

        if (!ALLOWED_REACTION_EMOJIS.includes(data.emoji)) {
          const errRes = { success: false, message: 'Unsupported emoji reaction' };
          socket.emit('reaction_error', errRes);
          if (ackCallback) ackCallback(errRes);
          return;
        }

        // Verify membership & approval
        const room = await prisma.room.findFirst({
          where: { OR: [{ id: data.roomId }, { code: data.roomId }] },
        });

        if (!room) {
          if (ackCallback) ackCallback({ success: false, message: 'Room not found' });
          return;
        }

        const isHost = room.hostId === user.userId;
        const participant = await prisma.roomParticipant.findUnique({
          where: { roomId_userId: { roomId: room.id, userId: user.userId } },
        });

        if (!isHost && (!participant || !participant.isApproved)) {
          const errRes = { success: false, message: 'Forbidden: Only room members can send reactions' };
          socket.emit('reaction_error', errRes);
          if (ackCallback) ackCallback(errRes);
          return;
        }

        // Basic Rate Limiting: max 5 reactions per 3 seconds
        const now = Date.now();
        const timestamps = socketReactionTimestamps.get(socket.id) || [];
        const recentTimestamps = timestamps.filter((t) => now - t < 3000);

        if (recentTimestamps.length >= 5) {
          const errRes = { success: false, message: 'Rate limit exceeded: Please wait before sending more reactions' };
          socket.emit('reaction_error', errRes);
          if (ackCallback) ackCallback(errRes);
          return;
        }

        recentTimestamps.push(now);
        socketReactionTimestamps.set(socket.id, recentTimestamps);

        const reactionPayload = {
          id: Math.random().toString(36).substring(2, 9),
          roomId: room.id,
          emoji: data.emoji,
          sender: {
            id: user.userId,
            username: user.username,
          },
          timestamp: now,
        };

        io.to(room.id).emit('reaction_new', {
          success: true,
          reaction: reactionPayload,
        });

        if (ackCallback) ackCallback({ success: true, reaction: reactionPayload });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Error sending reaction';
        if (ackCallback) ackCallback({ success: false, message: errMsg });
      }
    });

    // --- PHASE 7 FEATURE C: PARTICIPANT APPROVAL WORKFLOW ---
    socket.on('room_request_join', async (data: { roomId: string }, ackCallback?: (res: unknown) => void) => {
      try {
        if (!user?.userId || !data?.roomId) {
          if (ackCallback) ackCallback({ success: false, message: 'Missing parameters' });
          return;
        }

        const requestResult = await createJoinRequest(data.roomId, user.userId);

        // Notify room host/moderators of new pending request
        io.to(requestResult.roomId).emit('room_join_request_new', {
          success: true,
          request: requestResult,
        });

        if (ackCallback) ackCallback({ success: true, request: requestResult });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Error requesting room join';
        if (ackCallback) ackCallback({ success: false, message: errMsg });
      }
    });

    socket.on('room_decide_join_request', async (data: { requestId: string; decision: 'APPROVE' | 'REJECT' }, ackCallback?: (res: unknown) => void) => {
      try {
        if (!user?.userId || !data?.requestId || !data?.decision) {
          if (ackCallback) ackCallback({ success: false, message: 'Missing parameters' });
          return;
        }

        const result = await decideJoinRequest(data.requestId, user.userId, data.decision);

        if (data.decision === 'APPROVE') {
          const approvedParticipant = await prisma.roomParticipant.findFirst({
            where: { roomId: result.roomId, userId: result.userId },
            include: { user: { select: { id: true, username: true, email: true } } },
          });

          if (approvedParticipant) {
            io.to(result.roomId).emit('participant_joined', {
              success: true,
              roomId: result.roomId,
              participant: {
                id: approvedParticipant.id,
                roomId: approvedParticipant.roomId,
                userId: approvedParticipant.userId,
                role: approvedParticipant.role,
                isApproved: approvedParticipant.isApproved,
                joinedAt: approvedParticipant.joinedAt,
                user: approvedParticipant.user,
              },
            });
          }
        }

        // Notify room members/requester of decision
        io.to(result.roomId).emit('room_join_request_status', {
          success: true,
          request: result,
        });

        if (ackCallback) ackCallback({ success: true, request: result });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Error deciding join request';
        if (ackCallback) ackCallback({ success: false, message: errMsg });
      }
    });

    socket.on('leave_room', (data: { roomId: string }) => {
      if (data?.roomId && user?.userId) {
        socket.leave(data.roomId);
        io.to(data.roomId).emit('participant_left', {
          success: true,
          roomId: data.roomId,
          userId: user.userId,
          username: user.username,
        });
        logger.info(`User ${user.username} (Socket ${socket.id}) left room ${data.roomId}`);
      }
    });

    socket.on('disconnect', (reason) => {
      socketReactionTimestamps.delete(socket.id);
      logger.info(`Socket disconnected: ${socket.id} (reason: ${reason})`);
    });
  });

  return io;
};
