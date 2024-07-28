require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const http = require('http');
const { Storage } = require('@google-cloud/storage');
const { listFiles, loadPlayCounts, savePlayCounts, getPlayCounts, incrementPlayCount } = require('./audio');
const { bucketName } = require('./config');
const setupWebSocket = require('./websocket');

const app = express();
const server = http.createServer(app);

const storage = new Storage();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(cors());

const upload = multer({ dest: '/tmp/uploads/' });

app.get('/audio/:filename', async (req, res) => {
    const { filename } = req.params;
    const file = storage.bucket(bucketName).file(filename);

    const [metadata] = await file.getMetadata();
    const fileSize = metadata.size;

    const range = req.headers.range;
    if (!range) {
        res.status(416).send('Range not found');
        return;
    }

    const CHUNK_SIZE = 10 ** 6; // 1MB
    const start = Number(range.replace(/\D/g, ''));
    const end = Math.min(start + CHUNK_SIZE, fileSize - 1);

    const contentLength = end - start + 1;
    const headers = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': contentLength,
        'Content-Type': 'audio/mpeg',
    };

    res.writeHead(206, headers);

    const readStream = file.createReadStream({ start, end });

    readStream.on('data', (chunk) => {
        console.log('Sending chunk of size:', chunk.length);
        res.write(chunk);
    });

    readStream.on('end', () => {
        res.end();
    });

    readStream.on('error', (err) => {
        console.error('Error streaming audio file:', err);
        res.status(500).send('Error streaming audio file');
    });
});

app.post('/play/:filename', async (req, res) => {
    const { filename } = req.params;
    const newCount = incrementPlayCount(filename);
    await savePlayCounts();
    res.json({ playCount: newCount });
});

app.get('/playcounts', (req, res) => {
    res.json(getPlayCounts());
});

app.post('/upload', upload.single('file'), async (req, res) => {
    const filePath = req.file.path;
    const fileName = req.file.originalname;

    try {
        await storage.bucket(bucketName).upload(filePath, {
            destination: fileName,
        });
        console.log(`${fileName} uploaded to ${bucketName}.`);
        res.status(200).send('File uploaded successfully.');
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).send('Error uploading file.');
    }
});

app.get('/', async (req, res) => {
    await loadPlayCounts();
    const audioFiles = await listFiles();
    res.render('index', { audioFiles, playCounts: getPlayCounts() });
});

app.get('/streaming', (req, res) => {
    res.render('streaming');
});

app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).send('Internal Server Error');
});

setupWebSocket(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;