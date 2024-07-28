const { Storage } = require('@google-cloud/storage');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

const audioFiles = [
    'https://storage.googleapis.com/mdrn-zuvillage-test/Rustling-Demo.mp3'
    // Add more URLs of your audio files
];

app.get('/', (req, res) => {
    res.render('index', { audioFiles });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
