const qrcode = require("qrcode-terminal");
const fs = require('fs');
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const ytdl = require('ytdl-core');
const uploadToS3 = require('./s3-config');
const fetch = require("node-fetch");

const client = new Client({
    authStrategy: new LocalAuth(),
});

client.initialize();

client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
    console.log("AUTHENTICATED");
});

async function _process(message, type) {
    const ytRegex = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})$/;
    const ytLink = message.body.slice(7);

    if (ytRegex.test(ytLink)) {
        const info = await ytdl.getInfo(ytLink);
        const videoTitle = info.videoDetails.title;
        client.sendMessage(message.from, `Please wait....\n${type} link to download "${videoTitle}" will be sent to you.`);

        let options, fileName;
        if (type == 'Audio') {
            options = { filter: 'audioonly', format: 'webm' };
            fileName = `file_${Math.random().toString(36).substring(2, 8)}.webm`;
        } else if (type == 'Video') {
            options = { quality: 'highest', filter: 'audioandvideo', format: 'mp4' };
            fileName = `file_${Math.random().toString(36).substring(2, 8)}.mp4`;
        }

        const stream = ytdl(ytLink, options);
        const writeStream = fs.createWriteStream(`./${fileName}`);
        stream.pipe(writeStream);

        writeStream.on('finish', async () => {
            try {
                console.log('file downloaded. beginning upload');
                const link = await uploadToS3(fileName);
                // const media = MessageMedia.fromFilePath(`./${fileName}`);
                // media.filename = `download.mp4`;
                // await client.sendMessage(message.from, media, { sendMediaAsDocument: true });
                console.log('uploaded');

                await message.reply(`Download link: ${link}\n\nLink is valid for 24 hours. Enjoy!`);
                fs.unlinkSync(`./${fileName}`);
            } catch (err) {
                console.log(err.message);
            }
        });
    } else {
        console.log('link was invalid');
        message.reply('Invalid YouTube link');
    }
}

async function getJoke() {
    try {
        const res = await fetch("https://icanhazdadjoke.com/", {
            method: "GET",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        const resJson = await res.json();
        return resJson.joke;
    } catch (error) {
        console.log('Error occured while fetching joke', error);
        return null;
    }
}

async function getQuote() {
    try {
        const res = await fetch("https://api.quotable.io/random");
        const resJson = await res.json();

        return `"${resJson.content}"\n ~${resJson.author}`;
    } catch (error) {
        console.log('Error occured while fetching quote', error);
        return null;
    }
}

client.on('message', async (message) => {
    if (message.body.substring(0, 6) == '/audio') {
        console.log('received link');
        _process(message, 'Audio');
    } else if (message.body.substring(0, 6) == '/video') {
        console.log('received link');
        _process(message, 'Video');
    } else if (message.body.substring(0, 5) == '/help') {
        message.reply('Available commands-\n\n*/video <yt-link>* - To download as video\n*/audio <yt-link>* - To download as audio\n*/joke* - Get a joke\n*/quote*- Get a quote\n*/help* - List of all available commands');
    } else if (message.body.substring(0, 5) == '/joke') {
        const joke = await getJoke();
        console.log(joke);
        message.reply(joke);
    } else if(message.body.substring(0, 6) == '/quote'){
        const quote = await getQuote();
        console.log(quote);
        message.reply(quote);
    }
});

