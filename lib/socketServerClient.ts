import { io as ioClient, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const getSocket = () => {
  if (socket && socket.connected) return socket;
  const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL || 'http://localhost:3001';
  try {
    socket = ioClient(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      autoConnect: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 2000,
    });

    socket.on('connect', () => {
      console.info('[server-socket-client] Connected to socket server as client', socket?.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('[server-socket-client] connect_error', err?.message || err);
    });

    socket.on('disconnect', (reason) => {
      console.info('[server-socket-client] disconnected', reason);
    });
  } catch (err) {
    console.warn('[server-socket-client] Failed to create socket client', err);
  }

  return socket;
};

export async function emitMessage(orderId: string, message: any) {
  try {
    const s = getSocket();
    if (s && s.connected) {
      s.emit('send-message', { orderId, message });
      return true;
    }
  } catch (err) {
    console.warn('[server-socket-client] emitMessage failed', err);
  }
  return false;
}

export async function emitNotification(userId: string, notification: any) {
  try {
    const s = getSocket();
    if (s && s.connected) {
      s.emit('new-notification', { userId, notification });
      return true;
    }
  } catch (err) {
    console.warn('[server-socket-client] emitNotification failed', err);
  }
  return false;
}
