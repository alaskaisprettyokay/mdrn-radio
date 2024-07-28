document.addEventListener('DOMContentLoaded', function() {
    const socket = io();

    const startBroadcastBtn = document.getElementById('start-broadcast');
    const stopBroadcastBtn = document.getElementById('stop-broadcast');
    const audioSourceSelect = document.getElementById('audio-source');
    const audioFileInput = document.getElementById('audio-file');
    const listenerAudio = document.getElementById('listener-audio');
    let mediaRecorder;
    let broadcastStream;
    let audioContext, sourceNode;

    audioSourceSelect.addEventListener('change', () => {
        if (audioSourceSelect.value === 'file') {
            audioFileInput.style.display = 'block';
        } else {
            audioFileInput.style.display = 'none';
        }
    });

    startBroadcastBtn.addEventListener('click', async () => {
        if (audioSourceSelect.value === 'microphone') {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            startBroadcast(stream);
        } else if (audioSourceSelect.value === 'file') {
            const file = audioFileInput.files[0];
            if (file) {
                const fileStream = await file.arrayBuffer();
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const audioBuffer = await audioContext.decodeAudioData(fileStream);
                sourceNode = audioContext.createBufferSource();
                sourceNode.buffer = audioBuffer;
                const destination = audioContext.createMediaStreamDestination();
                sourceNode.connect(destination);
                startBroadcast(destination.stream);
                sourceNode.start();
            }
        }
    });

    function startBroadcast(stream) {
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
    }

    stopBroadcastBtn.addEventListener('click', () => {
        mediaRecorder.stop();
        if (broadcastStream) {
            broadcastStream.getTracks().forEach(track => track.stop());
        }
        if (sourceNode) {
            sourceNode.stop();
        }

        startBroadcastBtn.style.display = 'inline-block';
        stopBroadcastBtn.style.display = 'none';
    });

    const audioContextListener = new (window.AudioContext || window.webkitAudioContext)();
    const sourceNodeListener = audioContextListener.createMediaElementSource(listenerAudio);
    sourceNodeListener.connect(audioContextListener.destination);

    socket.on('audio-stream', (data) => {
        const audioBlob = new Blob([data], { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        listenerAudio.src = audioUrl;
        listenerAudio.play();
    });
});