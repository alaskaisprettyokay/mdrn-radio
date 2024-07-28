document.addEventListener('DOMContentLoaded', function() {
    const audioItems = document.querySelectorAll('.audio-item');
    const audioPlayer = document.getElementById('audio-player');
    const audioSource = document.getElementById('audio-source');
    const nowPlayingTitle = document.getElementById('now-playing-title');
    const visualizerCanvas = document.getElementById('visualizer');
    const visualizerCtx = visualizerCanvas.getContext('2d');
    const backgroundCanvas = document.getElementById('background-canvas');
    const backgroundCtx = backgroundCanvas.getContext('2d');
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaElementSource(audioPlayer);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const uploadBtn = document.getElementById('upload-btn');
    const modal = document.getElementById('upload-modal');
    const closeModal = document.querySelector('.close');
    const uploadForm = document.getElementById('upload-form');
    const connectWalletBtn = document.getElementById('connect-wallet-btn');
    const mainContent = document.getElementById('main-content');
    const tempoSlider = document.getElementById('tempo-slider');
    const tempoValue = document.getElementById('tempo-value');

    uploadBtn.addEventListener('click', () => {
        modal.style.display = 'block';
    });

    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(uploadForm);
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
            });
            if (response.ok) {
                alert('File uploaded successfully.');
                modal.style.display = 'none';
            } else {
                alert('File upload failed.');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Error uploading file.');
        }
    });

    function resizeCanvas() {
        backgroundCanvas.width = window.innerWidth;
        backgroundCanvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function draw() {
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        visualizerCtx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        visualizerCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

        const barWidth = (visualizerCanvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i];
            visualizerCtx.fillStyle = `rgb(${barHeight + 100}, 20, 120)`;
            visualizerCtx.fillRect(x, visualizerCanvas.height - barHeight / 2, barWidth, barHeight / 2);
            x += barWidth + 1;
        }

        backgroundCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);

        const bgBarWidth = backgroundCanvas.width / bufferLength;
        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i];
            backgroundCtx.fillStyle = `rgba(${barHeight + 50}, ${100 - barHeight}, ${barHeight + 150}, 0.3)`;
            backgroundCtx.fillRect(i * bgBarWidth, backgroundCanvas.height - barHeight, bgBarWidth, barHeight);
        }
    }

    connectWalletBtn.addEventListener('click', async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                if (accounts.length > 0) {
                    mainContent.style.display = 'block';
                    uploadBtn.style.display = 'inline-block';
                    connectWalletBtn.style.display = 'none';
                    console.log('Wallet connected:', accounts[0]);
                } else {
                    alert('No accounts found.');
                }
            } catch (error) {
                console.error('Error connecting wallet:', error);
                alert('Error connecting wallet.');
            }
        } else {
            alert('MetaMask is not installed. Please install it to use this app.');
        }
    });

    audioItems.forEach(item => {
        item.addEventListener('click', function() {
            audioSource.src = item.getAttribute('data-src');
            nowPlayingTitle.textContent = item.getAttribute('data-title');
            audioPlayer.load();
            audioPlayer.play();
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            draw();

            fetch(`/play/${item.getAttribute('data-title')}`, {
                method: 'POST'
            }).then(() => {
                const playCountElement = item.querySelector('.play-count');
                const currentCount = parseInt(playCountElement.textContent.split(': ')[1]);
                playCountElement.textContent = `Plays: ${currentCount + 1}`;
            });
        });
    });

    tempoSlider.addEventListener('input', function() {
        const speed = parseFloat(tempoSlider.value);
        audioPlayer.playbackRate = speed;
        tempoValue.textContent = `${speed.toFixed(1)}x`;
    });
});