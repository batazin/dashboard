const http = require('http');
const { Server } = require('socket.io');

const port = process.env.SOCKET_PORT ? parseInt(process.env.SOCKET_PORT, 10) : 3001;

const server = http.createServer();
// allow dev origins: localhost and 127.0.0.1; also allow override via SOCKET_ORIGINS
const allowedOriginsInput = process.env.SOCKET_ORIGINS
  ? process.env.SOCKET_ORIGINS.split(',')
  : ["http://localhost:3000", "http://127.0.0.1:3000"]

// Support both http and https variants for common local hosts
const allowedOrigins = Array.from(
  new Set(
    allowedOriginsInput.flatMap((origin) => [origin, origin.replace('http://', 'https://')])
  )
)

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

console.log('Socket.IO allowed origins:', allowedOrigins);
console.info('Socket server ready. Start it with: npm run dev:socket (or npm run dev:all)')

const connectedUsers = new Map();

// Express-like listener para receber notificações do servidor
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id, 'from', socket.handshake.address)
  console.log('Socket handshake origin:', socket.handshake.headers.origin)

  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`);
    connectedUsers.set(socket.id, userId);
    console.log(`User ${userId} subscribed to notifications`);
  });

  socket.on('join-order', (orderId, userId) => {
    socket.join(`order-${orderId}`);
    connectedUsers.set(socket.id, userId);
    console.log(`User ${userId} joined order-${orderId}`);
    socket.to(`order-${orderId}`).emit('user-joined', { userId, timestamp: new Date().toISOString() });
  });

  socket.on('leave-order', (orderId) => {
    socket.leave(`order-${orderId}`);
    const userId = connectedUsers.get(socket.id);
    connectedUsers.delete(socket.id);
    socket.to(`order-${orderId}`).emit('user-left', { userId, timestamp: new Date().toISOString() });
  });

  socket.on('send-message', (data) => {
    try {
      console.log('Received send-message from client for order:', data.orderId, 'message id:', data.message?.id)
      // Broadcast to other sockets in the room (exclude the sender) to avoid duplicate
      // when the API route also emits the message server-side.
      socket.to(`order-${data.orderId}`).emit('new-message', data.message);
      socket.to(`order-${data.orderId}`).emit('new-notification', {
        type: 'NEW_MESSAGE',
        orderId: data.orderId,
        message: `Nova mensagem de ${data.message.userName || data.message?.user?.name || 'Usuário'}`,
        timestamp: new Date().toISOString(),
      });
      // If message contains a recipient user id, also notify that user specifically
      if (data.recipientUserId) {
        console.log('Also emitting notification to user room (excluding sender):', data.recipientUserId)
        // Use socket.broadcast.to so the originating socket does not receive
        // the notification (prevents sender from seeing their own notification).
        socket.broadcast.to(`user-${data.recipientUserId}`).emit('notification-received', {
          notification: {
            type: 'NEW_MESSAGE',
            title: 'Nova mensagem',
            message: `Nova mensagem de ${data.message.userName || data.message?.user?.name || 'Usuário'}`,
            orderId: data.orderId,
            createdAt: new Date().toISOString(),
            actorId: data.message?.userId || data.message?.user?.id || null,
          },
          timestamp: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error('send-message handler error', err);
    }
  });

  socket.on('typing-start', (data) => {
    socket.to(`order-${data.orderId}`).emit('user-typing', { userName: data.userName, isTyping: true });
  });
  socket.on('typing-stop', (data) => {
    socket.to(`order-${data.orderId}`).emit('user-typing', { userName: data.userName, isTyping: false });
  });

  socket.on('status-updated', (data) => {
    io.to(`order-${data.orderId}`).emit('order-status-changed', {
      orderId: data.orderId,
      status: data.status,
      updatedBy: data.updatedBy,
      updatedByName: data.updatedByName,
      timestamp: new Date().toISOString(),
    });
  });

  // Listener para notificações vindo do servidor (API)
  socket.on('new-notification', (data) => {
    console.log('Received new-notification event for user:', data.userId);
    // Broadcast to the target user's room, excluding the emitter socket so
    // the sender doesn't receive their own notification when the event
    // originated from a client socket.
    socket.broadcast.to(`user-${data.userId}`).emit('notification-received', {
      notification: data.notification,
      timestamp: new Date().toISOString(),
    });
    // If the order is being viewed, also notify the order room (exclude sender)
    if (data.notification.orderId) {
      socket.broadcast.to(`order-${data.notification.orderId}`).emit('new-notification', data.notification);
    }
  });

  socket.on('disconnect', () => {
    const userId = connectedUsers.get(socket.id);
    connectedUsers.delete(socket.id);
    console.log('Socket disconnected', socket.id, userId);
  });
});

server.listen(port, () => {
  console.log(`Socket.IO server listening on port ${port}`);
});

// Simple healthcheck endpoint so we can confirm server is running
server.on('request', async (req, res) => {
  if (req.url === '/ping' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('pong');
    return
  }

  // POST /emit-notification - allow other server components to ask socket-server to emit
  if (req.url === '/emit-notification' && req.method === 'POST') {
    try {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk.toString()
      })
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          const { userId, notification } = parsed
          if (!userId || !notification) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'userId and notification are required' }))
            return
          }

          console.log('/emit-notification received for user:', userId)
      try {
        const room = io.sockets.adapter.rooms.get(`user-${userId}`)
        const socketsInRoom = room ? room.size : 0
        console.log(`/emit-notification: user-${userId} sockets in room:`, socketsInRoom)
      } catch (e) {
        console.warn('Could not inspect room membership for user:', userId, e)
      }
      // Emit only to the specific user's room. We intentionally do NOT emit
      // to the order room from this HTTP endpoint because that would notify
      // all viewers of the order (including the sender). Order-level
      // notifications are handled via socket-originated events which use
      // broadcast semantics to exclude the emitter.
      io.to(`user-${userId}`).emit('notification-received', { notification, timestamp: new Date().toISOString() })

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        } catch (err) {
          console.error('Failed to parse /emit-notification body', err)
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid body' }))
        }
      })
    } catch (err) {
      console.error('Error handling /emit-notification', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'internal' }))
    }
    return
  }
  // POST /emit-message - allow server to broadcast a new-message to an order room
  if (req.url === '/emit-message' && req.method === 'POST') {
    try {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk.toString()
      })
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          const { orderId, message } = parsed
          if (!orderId || !message) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'orderId and message are required' }))
            return
          }

          console.log('/emit-message received for order:', orderId)
          io.to(`order-${orderId}`).emit('new-message', message)

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        } catch (err) {
          console.error('Failed to parse /emit-message body', err)
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid body' }))
        }
      })
    } catch (err) {
      console.error('Error handling /emit-message', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'internal' }))
    }
    return
  }
});

// Process errors log
server.on('error', (err) => {
  console.error('Socket.IO server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception in socket-server:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection in socket-server:', reason);
});
