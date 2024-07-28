document.addEventListener('DOMContentLoaded', function() {
    const socket = io();

    const startBroadcastBtn = document.getElementById('start-broadcast');
    const stopBroadcastBtn = document.getElementById('stop-broadcast');
    const audioSourceSelect = document.getElementById('audio-source');
    const audioFileInput = document.getElementById('audio-file');
    const listenerAudio = document.getElementById('listener-audio');
    const listenBtn = document.getElementById('listen-btn');
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
                const fileURL = URL.createObjectURL(file);
                const audio = new Audio(fileURL);
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                sourceNode = audioContext.createMediaElementSource(audio);
                const destination = audioContext.createMediaStreamDestination();
                sourceNode.connect(destination);
                startBroadcast(destination.stream);
                audio.play();
            }
        }
    });

    function startBroadcast(stream) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        broadcastStream = stream;

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                console.log('Broadcasting data: ', event.data.size);
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
            sourceNode.mediaElement.pause();
            sourceNode.disconnect();
        }

        startBroadcastBtn.style.display = 'inline-block';
        stopBroadcastBtn.style.display = 'none';
    });

    const audioContextListener = new (window.AudioContext || window.webkitAudioContext)();
    const sourceNodeListener = audioContextListener.createMediaElementSource(listenerAudio);
    sourceNodeListener.connect(audioContextListener.destination);

    socket.on('audio-stream', (data) => {
        const audioBlob = new Blob([data], { type: 'audio/webm' });
        console.log('Received audio data: ', audioBlob.size);
        const audioUrl = URL.createObjectURL(audioBlob);
        listenerAudio.src = audioUrl;
    });

    listenBtn.addEventListener('click', () => {
        listenerAudio.play().catch(error => {
            console.error('Error playing audio:', error);
        });
    });

    listenerAudio.addEventListener('play', () => {
        if (audioContextListener.state === 'suspended') {
            audioContextListener.resume();
        }
    });
});