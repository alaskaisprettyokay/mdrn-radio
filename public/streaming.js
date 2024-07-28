document.addEventListener('DOMContentLoaded', function() {
    const socket = io();

    const startBroadcastBtn = document.getElementById('start-broadcast');
    const stopBroadcastBtn = document.getElementById('stop-broadcast');
    const audioSourceSelect = document.getElementById('audio-source');
    const audioFileInput = document.getElementById('audio-file');
    const broadcastNameInput = document.getElementById('broadcast-name');
    const listenerAudio = document.getElementById('listener-audio');
    const listenBtn = document.getElementById('listen-btn');
    const broadcastList = document.getElementById('broadcast-list');
    let mediaRecorder;
    let broadcastStream;
    let audioContext, sourceNode;
    let currentBroadcast;

    audioSourceSelect.addEventListener('change', () => {
        if (audioSourceSelect.value === 'file') {
            audioFileInput.style.display = 'block';
        } else {
            audioFileInput.style.display = 'none';
        }
    });

    startBroadcastBtn.addEventListener('click', async () => {
        const broadcastName = broadcastNameInput.value.trim();
        if (!broadcastName) {
            alert('Please enter a broadcast name.');
            return;
        }

        if (audioSourceSelect.value === 'microphone') {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            startBroadcast(stream, broadcastName);
        } else if (audioSourceSelect.value === 'file') {
            const file = audioFileInput.files[0];
            if (file) {
                const fileURL = URL.createObjectURL(file);
                const audio = new Audio(fileURL);
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                sourceNode = audioContext.createMediaElementSource(audio);
                const destination = audioContext.createMediaStreamDestination();
                sourceNode.connect(destination);
                startBroadcast(destination.stream, broadcastName);
                audio.play();
            }
        }
    });

    function startBroadcast(stream, broadcastName) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        broadcastStream = stream;
        currentBroadcast = broadcastName;

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                socket.emit('audio-stream', { name: broadcastName, data: event.data });
            }
        };

        mediaRecorder.start(100);

        startBroadcastBtn.style.display = 'none';
        stopBroadcastBtn.style.display = 'inline-block';
        socket.emit('new-broadcast', broadcastName);
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
        socket.emit('end-broadcast', currentBroadcast);
        currentBroadcast = null;
    });

    socket.on('broadcast-list', (broadcasts) => {
        broadcastList.innerHTML = '';
        broadcasts.forEach(broadcast => {
            const li = document.createElement('li');
            li.textContent = broadcast;
            li.addEventListener('click', () => {
                listenBtn.style.display = 'inline-block';
                listenBtn.dataset.broadcast = broadcast;
            });
            broadcastList.appendChild(li);
        });
    });

    listenBtn.addEventListener('click', () => {
        const broadcastName = listenBtn.dataset.broadcast;
        if (broadcastName) {
            socket.emit('join-broadcast', broadcastName);
        }
    });

    socket.on('audio-stream', (data) => {
        const audioBlob = new Blob([data], { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        listenerAudio.src = audioUrl;
        listenerAudio.play().catch(error => {
            console.error('Error playing audio:', error);
        });
    });

    socket.on('broadcast-ended', (broadcastName) => {
        if (listenBtn.dataset.broadcast === broadcastName) {
            listenBtn.style.display = 'none';
            listenerAudio.pause();
            listenerAudio.src = '';
            alert(`Broadcast "${broadcastName}" has ended.`);
        }
    });

    socket.emit('get-broadcast-list');