import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';

export const socket: Socket = io(SOCKET_URL || undefined, {
  autoConnect: false,
  withCredentials: true,
});

