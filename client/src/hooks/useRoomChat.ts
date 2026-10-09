import { useEffect, useState, useCallback, useRef } from 'react';
import { socket } from '../socket';
import { ChatMessage } from '../types';

export interface UseRoomChatOptions {
  roomId: string | undefined;
  isMember: boolean;
}

export const useRoomChat = ({ roomId, isMember }: UseRoomChatOptions) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load chat history from socket
  const loadHistory = useCallback(() => {
    if (!roomId || !isMember) return;
    setIsLoadingHistory(true);
    setChatError(null);

    socket.emit('chat_get_history', { roomId, limit: 50 }, (res: { success: boolean; history?: ChatMessage[]; message?: string }) => {
      setIsLoadingHistory(false);
      if (res && res.success && res.history) {
        setMessages(res.history);
      } else if (res && res.message) {
        setChatError(res.message);
      }
    });
  }, [roomId, isMember]);

  // Socket listeners for real-time messages
  useEffect(() => {
    if (!roomId || !isMember) return;

    if (!socket.connected) {
      socket.connect();
    }

    loadHistory();

    const onNewMessage = (res: { success: boolean; message: ChatMessage }) => {
      if (res.success && res.message) {
        setMessages((prev) => {
          // Avoid duplicate messages
          if (prev.some((m) => m.id === res.message.id)) {
            return prev;
          }
          return [...prev, res.message];
        });
      }
    };

    const onChatHistory = (res: { success: boolean; history: ChatMessage[] }) => {
      if (res.success && res.history) {
        setMessages(res.history);
      }
    };

    const onMessageError = (res: { success: boolean; message: string }) => {
      if (res && res.message) {
        setChatError(res.message);
      }
    };

    socket.on('chat_new_message', onNewMessage);
    socket.on('chat_history', onChatHistory);
    socket.on('chat_message_error', onMessageError);

    return () => {
      socket.off('chat_new_message', onNewMessage);
      socket.off('chat_history', onChatHistory);
      socket.off('chat_message_error', onMessageError);
    };
  }, [roomId, isMember, loadHistory]);

  const sendMessage = useCallback(
    (content: string): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!roomId || !content.trim()) {
          resolve(false);
          return;
        }

        setChatError(null);
        socket.emit(
          'chat_send_message',
          { roomId, content: content.trim() },
          (res: { success: boolean; message?: ChatMessage; messageError?: string }) => {
            if (res && res.success && res.message) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === res.message!.id)) return prev;
                return [...prev, res.message!];
              });
              resolve(true);
            } else {
              setChatError(res?.messageError || 'Failed to send message');
              resolve(false);
            }
          }
        );
      });
    },
    [roomId]
  );

  return {
    messages,
    isLoadingHistory,
    chatError,
    sendMessage,
    loadHistory,
    messagesEndRef,
  };
};
