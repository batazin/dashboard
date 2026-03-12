const { io } = require('socket.io-client');

console.log('Testing Socket.IO connection to localhost:3001...');

const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('✅ SUCCESS: Connected to Socket.IO server!');
  console.log('Socket ID:', socket.id);
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (error) => {
  console.error('❌ ERROR: Connection failed:', error.message);
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

setTimeout(() => {
  console.error('⏰ TIMEOUT: No connection after 5 seconds');
  socket.disconnect();
  process.exit(1);
}, 5000);