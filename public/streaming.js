document.addEventListener('DOMContentLoaded', function() {
    const socket = new WebSocket('ws://localhost:3000');
    const startBroadcastBtn = document.getElementById('start-broadcast');
    const stopBroadcastBtn = document.getElementById('stop-broadcast');
    const audioSourceSelect = document.getElementById('audio-source');
    const audioFileInput = document.getElementById('audio-file');
    const broadcastNameInput = document.getElementById('broadcast-name');
    const listenerAudio = document.getElementById('listener-audio');
    const listenBtn = document.getElementById('listen-btn');
    const broadcastList = document.getElementById('broadcast-list');
    let peerConnection;
    let broadcastStream;
    let audioContext, sourceNode;
    let currentBroadcast;

    const configuration = {
        iceServers: [
            {
                urls: 'stun:stun.l.google.com:19302'
            }
        ]
    };

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
            } else {
                alert('Please select a file to broadcast.');
            }
        }
    });

    function startBroadcast(stream, broadcastName) {
        broadcastStream = stream;
        currentBroadcast = broadcastName;

        peerConnection = new RTCPeerConnection(configuration);
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
            }
        };

        peerConnection.onnegotiationneeded = async () => {
            try {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                socket.send(JSON.stringify({ type: 'offer', sdp: peerConnection.localDescription }));
            } catch (err) {
                console.error('Error creating offer:', err);
            }
        };

        startBroadcastBtn.style.display = 'none';
        stopBroadcastBtn.style.display = 'inline-block';
    }

    stopBroadcastBtn.addEventListener('click', () => {
        peerConnection.close();
        if (broadcastStream) {
            broadcastStream.getTracks().forEach(track => track.stop());
        }
        if (sourceNode) {
            sourceNode.mediaElement.pause();
            sourceNode.disconnect();
        }

        startBroadcastBtn.style.display = 'inline-block';
        stopBroadcastBtn.style.display = 'none';
        socket.send(JSON.stringify({ type: 'end', name: currentBroadcast }));
        currentBroadcast = null;
    });

    socket.onmessage = async event => {
        const message = JSON.parse(event.data);
        if (message.type === 'offer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.send(JSON.stringify({ type: 'answer', sdp: peerConnection.localDescription }));
        } else if (message.type === 'answer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));
        } else if (message.type === 'candidate') {
            await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
        } else if (message.type === 'broadcast-list') {
            broadcastList.innerHTML = '';
            message.broadcasts.forEach(broadcast => {
                const li = document.createElement('li');
                li.textContent = broadcast;
                li.addEventListener('click', () => {
                    listenBtn.style.display = 'inline-block';
                    listenBtn.dataset.broadcast = broadcast;
                });
                broadcastList.appendChild(li);
            });
        } else if (message.type === 'end') {
            if (listenBtn.dataset.broadcast === message.name) {
                listenBtn.style.display = 'none';
                listenerAudio.pause();
                listenerAudio.src = '';
                alert(`Broadcast "${message.name}" has ended.`);
            }
        }
    };

    listenBtn.addEventListener('click', () => {
        const broadcastName = listenBtn.dataset.broadcast;
        if (broadcastName) {
            peerConnection = new RTCPeerConnection(configuration);

            peerConnection.onicecandidate = event => {
                if (event.candidate) {
                    socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
                }
            };

            peerConnection.ontrack = event => {
                listenerAudio.srcObject = event.streams[0];
                listenerAudio.play();
            };

            socket.send(JSON.stringify({ type: 'join', name: broadcastName }));
        }
    });

    // Request the broadcast list when the client connects
    socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'get-broadcast-list' }));
    };
});