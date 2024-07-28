const socketIo = require('socket.io');

module.exports = function (server) {
    const io = socketIo(server);

    io.on('connection', (socket) => {
        console.log('New client connected');

        socket.on('audio-stream', (data) => {
            console.log('Received audio stream data on server'); // Log received data on server
            socket.broadcast.emit('audio-stream', data);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected');
        });
    });
};