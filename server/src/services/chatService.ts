import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

export interface ChatMessageResponse {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  timestamp: string;
  createdAt: Date;
}

export const createChatMessage = async (
  roomId: string,
  senderId: string,
  content: string
): Promise<ChatMessageResponse> => {
  const trimmed = content ? content.trim() : '';
  if (!trimmed) {
    throw new AppError('Message content cannot be empty', 400);
  }

  if (trimmed.length > 1000) {
    throw new AppError('Message length exceeds maximum allowed limit of 1000 characters', 400);
  }

  // Find room and verify user database membership
  const room = await prisma.room.findFirst({
    where: {
      OR: [{ id: roomId }, { code: roomId }, { inviteCode: roomId }],
    },
  });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  const isHost = room.hostId === senderId;
  const participant = await prisma.roomParticipant.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId: senderId,
      },
    },
    include: {
      user: { select: { username: true } },
    },
  });

  if (!isHost && (!participant || !participant.isApproved)) {
    throw new AppError('Forbidden: You must be an approved room member to send messages', 403);
  }

  const user = participant?.user || (await prisma.user.findUnique({ where: { id: senderId } }));
  if (!user) {
    throw new AppError('Sender user not found', 404);
  }

  const savedMessage = await prisma.chatMessage.create({
    data: {
      roomId: room.id,
      senderId,
      content: trimmed,
    },
    include: {
      sender: { select: { username: true } },
    },
  });

  const role = isHost ? 'HOST' : participant?.role || 'PARTICIPANT';

  return {
    id: savedMessage.id,
    roomId: room.id,
    senderId: savedMessage.senderId,
    senderName: savedMessage.sender.username,
    senderRole: role,
    content: savedMessage.content,
    timestamp: savedMessage.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: savedMessage.createdAt,
  };
};

export const getChatHistory = async (
  roomId: string,
  userId: string,
  limit = 50
): Promise<ChatMessageResponse[]> => {
  const room = await prisma.room.findFirst({
    where: {
      OR: [{ id: roomId }, { code: roomId }, { inviteCode: roomId }],
    },
  });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  const isHost = room.hostId === userId;
  const participant = await prisma.roomParticipant.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId,
      },
    },
  });

  if (!isHost && (!participant || !participant.isApproved)) {
    throw new AppError('Forbidden: Access denied to room chat history', 403);
  }

  // Fetch recent messages
  const rawMessages = await prisma.chatMessage.findMany({
    where: { roomId: room.id },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          participants: {
            where: { roomId: room.id },
            select: { role: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Reverse to chronological order
  const chronological = rawMessages.reverse();

  return chronological.map((msg) => {
    const isSenderHost = room.hostId === msg.senderId;
    const senderRole = isSenderHost
      ? 'HOST'
      : msg.sender.participants[0]?.role || 'PARTICIPANT';

    return {
      id: msg.id,
      roomId: room.id,
      senderId: msg.senderId,
      senderName: msg.sender.username,
      senderRole,
      content: msg.content,
      timestamp: msg.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: msg.createdAt,
    };
  });
};
