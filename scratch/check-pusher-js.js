const PusherClient = require('pusher-js');
console.log('PusherClient keys:', Object.keys(PusherClient));
console.log('PusherClient type:', typeof PusherClient);
if (typeof PusherClient === 'function') console.log('PusherClient is a function');
