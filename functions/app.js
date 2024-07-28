// functions/app.js
const { Storage } = require('@google-cloud/storage');
const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Decode the base64-encoded service account key
const serviceAccount = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64');
const keyFilePath = path.join(__dirname, 'service-account-key.json');
fs.writeFileSync(keyFilePath, serviceAccount);

// Set the path to the service account key file
process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilePath;

// Create a client
const storage = new Storage();

const bucketName = 'mdrn-zuvillage-test'; // Replace with your actual bucket name
const playCountsFile = 'playcounts.json';
let audioFiles = [];
let playCounts = {};

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Set up Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Fetch list of files in the bucket
async function listFiles() {
    try {
        // Reset the audioFiles array
        audioFiles = [];
        
        const [files] = await storage.bucket(bucketName).getFiles();
        files.forEach(file => {
            if (file.name !== playCountsFile) {
                audioFiles.push(file.name);
                // Initialize play count if not already set
                if (!playCounts[file.name]) {
                    playCounts[file.name] = 0;
                }
            }
        });
    } catch (error) {
        console.error('Error fetching files from bucket:', error);
    }
}

// Load play counts from the JSON file in the bucket
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

// Save play counts to the JSON file in the bucket
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

// Proxy route to serve audio files
app.get('/audio/:filename', async (req, res) => {
    const { filename } = req.params;
    const fileUrl = `https://storage.googleapis.com/${bucketName}/${filename}`;
    const fileExt = path.extname(filename).toLowerCase();
    const mimeTypes = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.flac': 'audio/flac',
    };

    try {
        const response = await axios({
            url: fileUrl,
            method: 'GET',
            responseType: 'stream'
        });

        res.setHeader('Content-Type', mimeTypes[fileExt] || 'application/octet-stream');
        response.data.pipe(res);
    } catch (error) {
        console.error('Error fetching audio file:', error);
        res.status(500).send('Error fetching audio file');
    }
});

// Endpoint to increment play count
app.post('/play/:filename', async (req, res) => {
    const { filename } = req.params;
    if (playCounts[filename] !== undefined) {
        playCounts[filename] += 1;
        await savePlayCounts();  // Save play counts to the bucket
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// Endpoint to get play counts
app.get('/playcounts', (req, res) => {
    res.json(playCounts);
});

// Upload endpoint
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

module.exports.handler = serverless(app);
