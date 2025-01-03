const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const phoneNumber = require('awesome-phonenumber');
const { phone } = require('phone');
const PastebinAPI = require('pastebin-js');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Pastebin configuration
const pastebin = new PastebinAPI('K1K3y5AfegPTRu5UlCC9X5Xj-Hm80-WK');

// PostgreSQL configuration
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'whatsapp_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'your_password'
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);

// Démarrage du serveur
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
