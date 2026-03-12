const { io } = require('socket.io-client');

console.log('Testing Socket.IO connection...');

// Wait for server to be ready
setTimeout(() => {
  const socket = io('http://localhost:3000', {
    path: '/socket.io',
    addTrailingSlash: false,
  });

  socket.on('connect', () => {
    console.log('Connected to Socket.IO server:', socket.id);
    socket.disconnect();
    process.exit(0);
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    process.exit(1);
  });

  setTimeout(() => {
    console.error('Connection timeout');
    process.exit(1);
  }, 5000);
}, 2000);