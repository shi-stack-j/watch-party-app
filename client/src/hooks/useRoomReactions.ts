import { useEffect, useState, useCallback } from 'react';
import { socket } from '../socket';

export interface ActiveReaction {
  id: string;
  emoji: string;
  senderName: string;
}

export interface UseRoomReactionsOptions {
  roomId: string | undefined;
  isMember: boolean;
}

export const useRoomReactions = ({ roomId, isMember }: UseRoomReactionsOptions) => {
  const [activeReactions, setActiveReactions] = useState<ActiveReaction[]>([]);
  const [reactionError, setReactionError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !isMember) return;

    const onNewReaction = (res: {
      success: boolean;
      reaction: {
        id: string;
        roomId: string;
        emoji: string;
        sender: { id: string; username: string };
        timestamp: number;
      };
    }) => {
      if (res.success && res.reaction) {
        const { id, emoji, sender } = res.reaction;
        const newReaction: ActiveReaction = {
          id,
          emoji,
          senderName: sender.username,
        };

        setActiveReactions((prev) => [...prev, newReaction]);

        // Auto remove after 2 seconds
        setTimeout(() => {
          setActiveReactions((prev) => prev.filter((r) => r.id !== id));
        }, 2000);
      }
    };

    const onError = (res: { success: boolean; message: string }) => {
      if (res && res.message) {
        setReactionError(res.message);
      }
    };

    socket.on('reaction_new', onNewReaction);
    socket.on('reaction_error', onError);

    return () => {
      socket.off('reaction_new', onNewReaction);
      socket.off('reaction_error', onError);
    };
  }, [roomId, isMember]);

  const sendReaction = useCallback(
    (emoji: string) => {
      if (!roomId || !isMember) return;
      setReactionError(null);
      socket.emit('reaction_send', { roomId, emoji }, (res: { success: boolean; message?: string }) => {
        if (res && !res.success && res.message) {
          setReactionError(res.message);
        }
      });
    },
    [roomId, isMember]
  );

  return {
    activeReactions,
    reactionError,
    sendReaction,
  };
};
