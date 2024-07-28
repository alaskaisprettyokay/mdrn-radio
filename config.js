const fs = require('fs');
const path = require('path');

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

module.exports = {
    bucketName: process.env.BUCKET_NAME,
};