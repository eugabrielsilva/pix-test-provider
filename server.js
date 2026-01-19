if(process.env.NODE_ENV !== 'production') {
    const dotenv = await import('dotenv');
    dotenv.config({quiet: true});
}

import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStaticPix} from 'pix-utils';

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'data.json');

const PORT = process.env.PORT || 9000;
const PIX_KEY = process.env.PIX_KEY;
const PIX_NAME = process.env.PIX_NAME;
const PIX_CITY = process.env.PIX_CITY;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const API_TOKEN = process.env.API_TOKEN;

const red = "\x1b[31m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const reset = "\x1b[0m";

let localPayments = [];

// Reads data from the JSON file
try {
    if(fs.existsSync(DB_FILE)) {
        const fileData = fs.readFileSync(DB_FILE, 'utf8');
        localPayments = JSON.parse(fileData);
    }
} catch(error) {
    console.error(`${red}Read data error:${reset}`, error);
}

const readData = () => localPayments;

// Writes data to the JSON file
const writeData = (data) => {
    localPayments = data;
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch(error) {
        console.error(`${red}Write data error:${reset}`, error);
    }
}

// Auth middleware
const authMiddleware = (req, res, next) => {
    if(!API_TOKEN) {
        return next();
    }

    const authHeader = req.headers.authorization;

    if(!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            status: false,
            error: 'Missing API token.'
        });
    }

    const token = authHeader.split(' ')[1];

    if(token !== API_TOKEN) {
        return res.status(403).json({
            status: false,
            error: 'Invalid API token.'
        });
    }

    next();
};

// Creates new PIX payment
app.post('/create', authMiddleware, async (req, res) => {
    const {value, expires_in, description} = req.body;

    if(typeof value !== 'number' || typeof expires_in !== 'number' || typeof description !== 'string') {
        return res.status(400).json({
            status: false,
            error: 'Invalid request parameters.'
        });
    }

    try {
        const id = crypto.randomUUID().replaceAll('-', '').substring(0, 25);

        const pix = createStaticPix({
            merchantName: PIX_NAME,
            merchantCity: PIX_CITY,
            pixKey: PIX_KEY,
            infoAdicional: description,
            transactionAmount: value / 100,
            txid: id,
        }).throwIfError();

        const created_at = new Date();
        const expires_at = new Date(created_at.getTime() + (expires_in * 1000));
        const qr_code = await pix.toImage();

        const payment = {
            id,
            value,
            description,
            pix_code: pix.toBRCode(),
            qr_code,
            created_at,
            expires_at,
            status: 'PENDING'
        };

        const payments = readData();
        payments.push(payment);
        writeData(payments);

        console.log(`${green}Payment created:${reset}`, id);

        return res.status(201).json({
            status: true,
            data: payment
        });
    } catch(error) {
        console.error(`${red}Create PIX error:${reset}`, error);

        return res.status(500).json({
            status: false,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });
    }
});

// Simulates PIX payment
app.post('/simulate/:id', authMiddleware, async (req, res) => {
    const payments = readData();
    const index = payments.findIndex(p => p.id === req.params.id);

    if(index === -1) {
        return res.status(404).json({
            status: false,
            error: 'Payment not found.'
        });
    }

    const payment = payments[index];
    const now = new Date();

    if(now > new Date(payment.expires_at)) {
        return res.status(400).json({
            status: false,
            error: 'Payment expired.'
        });
    }

    if(payment.status === 'PAID') {
        return res.status(400).json({
            status: false,
            error: 'Payment already paid.'
        });
    }

    payment.status = 'PAID';
    payment.paid_at = now;
    payments[index] = payment;
    writeData(payments);

    const updatedData = {
        id: payment.id,
        description: payment.description,
        status: payment.status,
        paid_at: payment.paid_at
    }

    if(WEBHOOK_URL) {
        try {
            await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    event: 'payment.paid',
                    data: updatedData
                })
            });
        } catch(error) {
            console.error(`${red}Webhook error:${reset}`, error);
        }
    }

    console.log(`${green}Payment simulated:${reset}`, payment.id);

    return res.json({
        status: true,
        data: updatedData
    });
});

// Gets PIX payment from ID
app.get('/payment/:id', authMiddleware, (req, res) => {
    const payments = readData();
    const payment = payments.find(p => p.id === req.params.id);

    if(!payment) {
        return res.status(404).json({
            status: false,
            error: 'Payment not found.'
        });
    }

    const now = new Date();
    const isExpired = now > new Date(payment.expires_at) && payment.status !== 'PAID';

    return res.json({
        status: true,
        data: {
            ...payment,
            status: isExpired ? 'EXPIRED' : payment.status
        }
    });
});

// Webhook test
app.post('/webhook', (req, res) => {
    console.log(`${green}Webhook received:${reset}`, req.body);

    return res.json({
        status: true,
        data: req.body
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`${green}--------------------------------------------------------------------------${reset}`);
    console.log(`${green}PIX Test Provider v0.1 by Gabriel Silva${reset}`);
    console.log(`${yellow}Server running on:${reset}`, `http://localhost:${PORT}${reset}`);
    console.log(`${yellow}API token:${reset}`, API_TOKEN);
    console.log(`${yellow}Webhook URL:${reset}`, WEBHOOK_URL);
    console.log(`${green}--------------------------------------------------------------------------${reset}`);
});