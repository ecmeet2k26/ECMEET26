const User = require('../models/User');

let io;
const userSockets = new Map(); // userId -> Set(socketIds)

module.exports = {
  init: (server) => {
    const { Server } = require('socket.io');
    io = new Server(server, {
      cors: {
        origin: "*", 
        methods: ["GET", "POST", "PATCH", "DELETE", "PUT"]
      }
    });

    io.on('connection', (socket) => {
      console.log('🔌 New connection:', socket.id);

      socket.on('identify', async (userId) => {
        if (!userId) return;
        socket.userId = userId;
        
        // Add to tracking
        if (!userSockets.has(userId)) {
          userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);

        // Update DB
        await User.findByIdAndUpdate(userId, { isOnline: true });
        io.emit('user-status-changed', { userId, status: 'online' });
        console.log(`👤 User ${userId} is now ONLINE`);
      });

      socket.on('disconnect', async () => {
        const userId = socket.userId;
        if (userId && userSockets.has(userId)) {
          const sockets = userSockets.get(userId);
          sockets.delete(socket.id);
          
          if (sockets.size === 0) {
            userSockets.delete(userId);
            // Truly offline only if NO more tabs are open
            await User.findByIdAndUpdate(userId, { isOnline: false, lastLogin: new Date() });
            io.emit('user-status-changed', { userId, status: 'offline' });
            console.log(`👤 User ${userId} is now OFFLINE`);
          }
        }
        console.log('🔌 Client disconnected:', socket.id);
      });
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io not initialized!');
    }
    return io;
  }
};
