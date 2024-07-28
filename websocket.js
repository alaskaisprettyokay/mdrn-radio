const socketIo = require('socket.io');

module.exports = function (server) {
    const io = socketIo(server);
    const broadcasts = {};

    io.on('connection', (socket) => {
        console.log('New client connected');

        // Send the current broadcast list to the new client
        socket.emit('broadcast-list', Object.keys(broadcasts));

        socket.on('new-broadcast', (broadcastName) => {
            broadcasts[broadcastName] = socket.id;
            io.emit('broadcast-list', Object.keys(broadcasts)); // Update all clients
        });

        socket.on('end-broadcast', (broadcastName) => {
            delete broadcasts[broadcastName];
            io.emit('broadcast-list', Object.keys(broadcasts)); // Update all clients
            io.emit('broadcast-ended', broadcastName);
        });

        socket.on('audio-stream', ({ name, data }) => {
            socket.broadcast.emit('audio-stream', data);
        });

        socket.on('join-broadcast', (broadcastName) => {
            socket.join(broadcasts[broadcastName]);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected');
            for (const [name, id] of Object.entries(broadcasts)) {
                if (id === socket.id) {
                    delete broadcasts[name];
                    io.emit('broadcast-list', Object.keys(broadcasts)); // Update all clients
                    io.emit('broadcast-ended', name);
                }
            }
        });
    });
};