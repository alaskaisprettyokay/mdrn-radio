require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
const cors = require('cors');

const app = express();

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_BASE64 is not set");
}
if (!process.env.BUCKET_NAME) {
    throw new Error("BUCKET_NAME is not set");
}

const serviceAccountBase64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
const serviceAccount = Buffer.from(serviceAccountBase64, 'base64');
if (!serviceAccount) {
    throw new Error("Failed to decode GOOGLE_APPLICATION_CREDENTIALS_BASE64");
}

const keyFilePath = path.join('/tmp', 'service-account-key.json');
fs.writeFileSync(keyFilePath, serviceAccount);
process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilePath;

const bucketName = process.env.BUCKET_NAME;
const storage = new Storage();
const playCountsFile = 'playcounts.json';
let audioFiles = [];
let playCounts = {};

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(cors());

const upload = multer({ dest: '/tmp/uploads/' });

async function listFiles() {
    try {
        audioFiles = [];
        const [files] = await storage.bucket(bucketName).getFiles();
        files.forEach(file => {
            if (file.name !== playCountsFile) {
                audioFiles.push(file.name);
                if (!playCounts[file.name]) {
                    playCounts[file.name] = 0;
                }
            }
        });
    } catch (error) {
        console.error('Error fetching files from bucket:', error);
    }
}

async function loadPlayCounts() {
    try {
        const file = storage.bucket(bucketName).file(playCountsFile);
        const [exists] = await file.exists();
        if (exists) {
            const [contents] = await file.download();
            playCounts = JSON.parse(contents.toString());
        } else {
            playCounts = {};
        }
    } catch (error) {
        console.error('Error loading play counts:', error);
    }
}

async function savePlayCounts() {
    try {
        const file = storage.bucket(bucketName).file(playCountsFile);
        await file.save(JSON.stringify(playCounts), {
            contentType: 'application/json'
        });
    } catch (error) {
        console.error('Error saving play counts:', error);
    }
}

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

    const readStream = file.createReadStream({
        start,
        end,
    });

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
    if (playCounts[filename] !== undefined) {
        playCounts[filename] += 1;
        await savePlayCounts();
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

app.get('/playcounts', (req, res) => {
    res.json(playCounts);
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
    await listFiles();
    res.render('index', { audioFiles, playCounts });
});

app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).send('Internal Server Error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;