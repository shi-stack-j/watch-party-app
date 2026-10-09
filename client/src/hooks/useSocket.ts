import { useEffect, useState } from 'react';
import { socket } from '../socket';

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);

  useEffect(() => {
    socket.connect();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, []);

  return { socket, isConnected };
};
