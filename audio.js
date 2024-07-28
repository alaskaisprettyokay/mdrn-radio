const { Storage } = require('@google-cloud/storage');

const bucketName = process.env.BUCKET_NAME;
const storage = new Storage();
const playCountsFile = 'playcounts.json';
let playCounts = {};

async function listFiles() {
    const [files] = await storage.bucket(bucketName).getFiles();
    return files.filter(file => file.name !== playCountsFile).map(file => file.name);
}

async function loadPlayCounts() {
    const file = storage.bucket(bucketName).file(playCountsFile);
    const [exists] = await file.exists();
    if (exists) {
        const [contents] = await file.download();
        playCounts = JSON.parse(contents.toString());
    } else {
        playCounts = {};
    }
    return playCounts;
}

async function savePlayCounts() {
    const file = storage.bucket(bucketName).file(playCountsFile);
    await file.save(JSON.stringify(playCounts), {
        contentType: 'application/json'
    });
}

function getPlayCounts() {
    return playCounts;
}

function incrementPlayCount(filename) {
    if (playCounts[filename] !== undefined) {
        playCounts[filename] += 1;
    } else {
        playCounts[filename] = 1;
    }
    return playCounts[filename];
}

module.exports = {
    listFiles,
    loadPlayCounts,
    savePlayCounts,
    getPlayCounts,
    incrementPlayCount
};