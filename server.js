require('dotenv').config({quiet: true});

const express = require('express');
const app = express();
const crypto = require('node:crypto');
const fs = require('node:fs');
const {createStaticPix} = require('pix-utils');

const DB_FILE = './data.json';
const PORT = process.env.PORT || 9000;
const PIX_KEY = process.env.PIX_KEY;
const PIX_NAME = process.env.PIX_NAME;
const PIX_CITY = process.env.PIX_CITY;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const API_TOKEN = process.env.API_TOKEN;

app.use(express.json());

// Reads data from the JSON file
const readData = () => {
    try {
        if(!fs.existsSync(DB_FILE)) return [];
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch(error) {
        return [];
    }
}

// Writes data to the JSON file
const writeData = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch(error) {
        console.error(error);
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
    const {value, expiresIn, description} = req.body;

    if(typeof value !== 'number' || typeof expiresIn !== 'number' || typeof description !== 'string') {
        return res.status(400).json({
            status: false,
            error: 'Missing request parameters.'
        });
    }

    try {
        const pix = createStaticPix({
            merchantName: PIX_NAME,
            merchantCity: PIX_CITY,
            pixKey: PIX_KEY,
            infoAdicional: description,
            transactionAmount: value / 100
        });

        const id = crypto.randomUUID();
        const created_at = new Date();
        const expires_at = new Date(created_at.getTime() + (expiresIn * 1000));
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

        console.log('Payment created:', id);

        return res.status(201).json({
            status: true,
            data: payment
        });
    } catch(error) {
        return res.status(500).json({
            status: false,
            error
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
            error: 'Payment already expired.'
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
            console.log(error);
        }
    }

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
    console.log('Webhook received:', req.body);

    return res.json({
        status: true,
        data: req.body
    });
});

// Start server
app.listen(PORT, () => {
    console.log('\x1b[32m%s\x1b[0m', 'PIX Test Provider v0.1');
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('API token:', API_TOKEN);
    console.log('Webhook URL:', WEBHOOK_URL);
});