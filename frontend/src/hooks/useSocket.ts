import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { env } from '../config/env';
import { useAuth } from '../context/AuthContext';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/socket';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketResult {
  socket: AppSocket | null;
  connected: boolean;
}

// Low-level: owns exactly one socket.io-client connection for the lifetime
// of a valid token. Anything trip-specific (rooms, presence, live state)
// belongs in useTrip, which consumes this.
export function useSocket(): UseSocketResult {
  const { token } = useAuth();
  const socketRef = useRef<AppSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socket: AppSocket = io(env.apiUrl, { auth: { token } });
    socketRef.current = socket;

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token]);

  return { socket: socketRef.current, connected };
}
