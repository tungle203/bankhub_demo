const express = require('express');
const path = require('path');
const logger = require('morgan');
const handlebars = require('express-handlebars');
const Redis = require('ioredis');
const axios = require('axios');
require('dotenv').config();

const clientId = process.env.CLIENT_ID;
const secretKey = process.env.SECRET_KEY;
const baseUrl = process.env.BASE_URL;
const bankHubUrl = process.env.BANK_HUB_URL;
const redirectUri = process.env.REDIRECT_URL;

const app = express();
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const redis = new Redis({
    port: process.env.REDIS_PORT,
    host: process.env.REDIS_HOST,
});

redis.on('connect', () => {
    console.log('Connected to Redis');
});

redis.on('error', (error) => {
    console.error("Can't connect to Redis");
});

app.engine(
    '.hbs',
    handlebars.engine({
        extname: '.hbs',
    }),
);

app.get('/api/grantToken', async (req, res) => {
    const config = {
        headers: {
            'X-Client-ID': clientId,
            'X-Secret-Key': secretKey,
        },
    };

    try {
        const response = await axios.post(
            `${bankHubUrl}/grant/token`,
            {
                scopes: 'transaction',
                redirectUri: redirectUri,
                language: 'vi',
            },
            config,
        );
        const grantToken = response.data.grantToken;
        return res.json({ grantToken }).status(201);
    } catch (error) {
        res.sendStatus(500);
    }
});

app.get('/api/publicToken/:token', async (req, res) => {
    const publicToken = req.params.token;
    const config = {
        headers: {
            'X-Client-ID': clientId,
            'X-Secret-Key': secretKey,
        },
    };

    try {
        const response = await axios.post(
            `${bankHubUrl}/grant/exchange`,
            {
                publicToken,
            },
            config,
        );
        redis.set('accessToken', response.data.accessToken);
        return res.sendStatus(201);
    } catch (error) {
        return res.sendStatus(404);
    }
});

app.get('/api/transactions', async (req, res) => {
    try {
        const accessToken = await redis.get('accessToken');
        const config = {
            headers: {
                'X-Client-ID': clientId,
                'X-Secret-Key': secretKey,
                Authorization: accessToken,
            },
        };

        const response = await axios.get(`${bankHubUrl}/transactions`, config);
        return res.json(response.data).status(200);
    } catch (error) {
        return res.sendStatus(500);
    }
});

app.get('/', async (req, res) => {
    redis.get('accessToken', (err, accessToken) => {
        if (err) {
            res.render('index', {
                baseUrl: baseUrl,
                hasAccessToken: false,
            });
        } else {
            res.render('index', {
                baseUrl: baseUrl,
                hasAccessToken: !!accessToken,
            });
        }
    });
});

app.listen(3000, () => {
    console.log(`Server is running at ${baseUrl}`);
});

module.exports = app;
