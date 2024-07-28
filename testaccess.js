const { Storage } = require('@google-cloud/storage');
const path = require('path');

// Set the path to the service account key file
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'config', 'service-account-key.json');

// Creates a client
const storage = new Storage();

const bucketName = 'mdrn-zuvillage-test'; // Replace with your actual bucket name

async function listFiles() {
    try {
        const [files] = await storage.bucket(bucketName).getFiles();
        console.log('Files:');
        files.forEach(file => {
            console.log(file.name);
        });
    } catch (error) {
        console.error('Error accessing bucket:', error);
    }
}

listFiles();
