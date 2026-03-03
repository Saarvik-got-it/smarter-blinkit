/**
 * Live Storeboard — Socket.io event handlers
 * Broadcasts real-time sales data to dashboards
 */

module.exports = function storeboardSocket(io) {
    io.on('connection', (socket) => {
        console.log(`📡 Socket connected: ${socket.id}`);

        socket.on('joinStoreboard', () => {
            socket.join('storeboard');
            console.log(`🏪 Socket ${socket.id} joined storeboard room`);
        });

        socket.on('disconnect', () => {
            console.log(`❌ Socket disconnected: ${socket.id}`);
        });
    });

    // Helper: broadcast to all storeboard viewers
    io.broadcastSale = (data) => io.to('storeboard').emit('saleUpdate', data);
};
