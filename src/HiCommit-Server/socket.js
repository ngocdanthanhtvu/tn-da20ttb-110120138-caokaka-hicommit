const { Server } = require('socket.io');
const { isAllowedOrigin } = require('./configs/cors');

let io;

function initializeSocket(server) {

  io = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io has not been initialized!");
  }
  return io;
}

module.exports = { initializeSocket, getIO };
