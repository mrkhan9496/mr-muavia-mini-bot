
// QnMD — Config 

const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env')) {
    dotenv.config({ path: '.env' });
}

module.exports = {
    // ===========================================================
    // 1. CONFIGURATION DE BASE (Session & Database)
    // ===========================================================
    SESSION_ID: process.env.SESSION_ID || "muavia_mini_01", 
    MONGODB_URI: process.env.MONGODB_URI || '',
    
    // ===========================================================
    // 2. INFORMATIONS DU BOT
    // ===========================================================
    PREFIX: process.env.PREFIX || '.',
    OWNER_NUMBER: process.env.OWNER_NUMBER || '923426637623', // Mettez votre numéro ici
    BOT_NAME: "QnMD",
    OWNER_NAME: process.env.OWNER_NAME || 'MR Muavia',
    DESCRIPTION: process.env.DESCRIPTION || '> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ Queen MD',
    BOT_FOOTER: '© ᴘᴏᴡᴇʀᴇᴅ ʙʏ Queen MD',
    
    // Mode de travail : public, private, group, inbox
    WORK_TYPE: process.env.WORK_TYPE || "public", 
    
    // ===========================================================
    // 3. FONCTIONNALITÉS AUTOMATIQUES (STATUTS)
    // ===========================================================
    AUTO_VIEW_STATUS: process.env.AUTO_VIEW_STATUS || 'true', // Voir automatiquement les statuts
    AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS || 'true', // Liker automatiquement les statuts
    AUTO_LIKE_EMOJI: ['❤️', '🌹', '😇', '💥', '🔥', '💫', '💎', '💙', '🌝', '💚'], 
    
    AUTO_STATUS_REPLY: process.env.AUTO_STATUS_REPLY || 'false', // Répondre aux statuts
    AUTO_STATUS_MSG: process.env.AUTO_STATUS_MSG || 'Nice status! 🔥', // Message de réponse
    
    // ===========================================================
    // 4. FONCTIONNALITÉS DE CHAT & PRÉSENCE
    // ===========================================================
    READ_MESSAGE: process.env.READ_MESSAGE || 'false', // Marquer les messages comme lus (Blue Tick)
    AUTO_TYPING: process.env.AUTO_TYPING || 'false', // Afficher "Écrit..."
    AUTO_RECORDING: process.env.AUTO_RECORDING || 'false', // Afficher "Enregistre..."
    
    // ===========================================================
    // 5. GESTION DES GROUPES
    // ===========================================================
    WELCOME_ENABLE: process.env.WELCOME_ENABLE || 'true',
    GOODBYE_ENABLE: process.env.GOODBYE_ENABLE || 'true',
    WELCOME_MSG: process.env.WELCOME_MSG || null, 
    GOODBYE_MSG: process.env.GOODBYE_MSG || null, 
    WELCOME_IMAGE: process.env.WELCOME_IMAGE || null, 
    GOODBYE_IMAGE: process.env.GOODBYE_IMAGE || null,
    
    GROUP_INVITE_LINK: process.env.GROUP_INVITE_LINK || 'https://chat.whatsapp.com/',
    
    // ===========================================================
    // 6. SÉCURITÉ & ANTI-CALL
    // ===========================================================
    ANTI_CALL: process.env.ANTI_CALL || 'false', // Rejeter les appels
    REJECT_MSG: process.env.REJECT_MSG || '*📞 Call rejected automatically. No calls allowed.*',
    
    // ===========================================================
    // 7. IMAGES & LIENS
    // ===========================================================
    MENU_IMAGE_URL: process.env.MENU_IMAGE_URL || 'https://files.catbox.moe/dbc49y.jpg',
    ANTI_LINK: process.env.ANTI_LINK || 'false',
    MENTION_REPLY: process.env.MENTION_REPLY || 'false',
    // Apni Heroku app ka link (pair code .pair command ke liye). Heroku pe HEROKU_APP_NAME set karo ya APP_URL do
    APP_URL: process.env.APP_URL || (process.env.HEROKU_APP_NAME ? `https://${process.env.HEROKU_APP_NAME}.herokuapp.com` : ''),
    IMAGE_PATH: './assets/mini-bot-logo.jpg',
    CHANNEL_LINK: process.env.CHANNEL_LINK || 'https://whatsapp.com/channel/0029VbDUrr1AojYnZ7f3ny39',
    
    // ===========================================================
    // 8. EXTERNAL API (Optionnel)
    // ===========================================================
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '8799842458:AAFe1E56I5D24QXfV3xAzPTjr1169B8IJvo',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '8799842458'
    
};
  
