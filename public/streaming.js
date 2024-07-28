document.addEventListener('DOMContentLoaded', function() {
    const socket = io();

    const startBroadcastBtn = document.getElementById('start-broadcast');
    const stopBroadcastBtn = document.getElementById('stop-broadcast');
    let mediaRecorder;
    let broadcastStream;

    startBroadcastBtn.addEventListener('click', async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        broadcastStream = stream;

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                socket.emit('audio-stream', event.data);
            }
        };

        mediaRecorder.start(100);

        startBroadcastBtn.style.display = 'none';
        stopBroadcastBtn.style.display = 'inline-block';
    });

    stopBroadcastBtn.addEventListener('click', () => {
        mediaRecorder.stop();
        broadcastStream.getTracks().forEach(track => track.stop());

        startBroadcastBtn.style.display = 'inline-block';
        stopBroadcastBtn.style.display = 'none';
    });

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioElement = document.createElement('audio');
    audioElement.controls = true;
    document.body.appendChild(audioElement);
    const sourceNode = audioContext.createMediaElementSource(audioElement);
    sourceNode.connect(audioContext.destination);

    socket.on('audio-stream', (data) => {
        const audioBlob = new Blob([data], { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        audioElement.src = audioUrl;
        audioElement.play();
    });
});