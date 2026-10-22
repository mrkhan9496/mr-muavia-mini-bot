/**
 * muavia-dailylife.js — Queen MD
 * DAILY LIFE reply commands — rozmarra ke Roman Urdu replies.
 * Ported from old muavia-mini-bot (commands/dailylife.js).
 *
 * NOTE: Source mein ye COMMANDS hain (.salam, .bye, etc.), auto-replies nahi.
 * Queen MD format mein cmd({ pattern }) ke taur par port kiye gaye.
 *
 * Usage:
 *   .salam                  -> isi chat mein reply
 *   .salam 923001234567     -> us number ke DM mein reply
 */

const { cmd } = require('../inconnuboy');

const FOOTER = '\n\n> *© Powered by QUEEN MD 👑*';

const REPLIES = {
    // 1. Salam aur Greetings
    salam: 'Assalam-o-Alaikum! ❤️',
    wsalam: 'Wa-Alaikum-Assalam! Allah aap ko khush rakhe. 🤍',
    subah: 'Subah bakhair! Aap ka din khushiyon bhara ho. 🌅',
    shab: 'Shab bakhair! Allah aap ko sukoon wali neend de. 🌙',

    // 2. Maafi aur Sorry
    sorry: 'Mujhe maaf kar dein, agar meri kisi baat se aap ka dil dukha ho. 🙏',
    maafi: 'Dil se maafi chahta hoon, mujh se ghalti ho gayi. 🤲',

    // 3. Shukriya aur Appreciation
    shukriya: 'Bohat bohat shukriya! Allah aap ko iska behtareen ajar de. 🤲',
    thanks: 'Thanks a lot! Dil se shukriya ada karta hoon. ❤️',

    // 4. Ijazat aur Permission
    ijazat: 'Agar aap ijazat dein to main ek baat pooch sakta hoon? 🙏',

    // 5. Respect aur Adab
    respect: 'Aap ki izzat mere liye bohat aham hai. 🤍',
    adab: 'Adab se arz hai. 🙏',

    // 6. Dua aur Khairiyat
    dua: 'Allah aap ko hamesha khush, salamat aur kamyab rakhe. Ameen. 🤲',
    khairiyat: 'Alhamdulillah, sab khairiyat hai. Aap apna batayein. 😊',
    mashallah: 'Mashallah! Allah nazar-e-bad se mehfooz rakhe. 🧿',

    // 7. Baat Cheet aur Daily Life
    haal: 'Kya haal hain? Sab khairiyat? 😊',
    busy: 'Thoda busy hoon, thodi der mein baat karta hoon. ⏳',
    ok: 'Theek hai, samajh gaya. 👍',

    // 8. Dosti aur Mohabbat Bhare Alfaaz
    dost: 'Dosti ka rishta duniya ka sab se pyara rishta hota hai. ❤️',
    mohabbat: 'Mohabbat bantne se barhti hai. 💕',

    // 9. Alvida aur Conversation End
    takecare: 'Apna khayal rakhiye ga. Allah Hafiz. 🤍',
    bye: 'Achha ji, phir baat hogi. Apna khayal rakhiye ga. 👋',
    allahhafiz: 'Allah Hafiz! Phir mulaqat hogi. 🤲',
};

const DESCS = {
    salam: 'Assalam-o-Alaikum reply',
    wsalam: 'Wa-Alaikum-Assalam reply',
    subah: 'Subah bakhair reply',
    shab: 'Shab bakhair reply',
    sorry: 'Sorry reply',
    maafi: 'Maafi reply',
    shukriya: 'Shukriya reply',
    thanks: 'Thanks reply',
    ijazat: 'Ijazat reply',
    respect: 'Respect reply',
    adab: 'Adab reply',
    dua: 'Dua reply',
    khairiyat: 'Khairiyat reply',
    mashallah: 'Mashallah reply',
    haal: 'Haal poocho reply',
    busy: 'Busy reply',
    ok: 'OK reply',
    dost: 'Dosti reply',
    mohabbat: 'Mohabbat reply',
    takecare: 'Take care reply',
    bye: 'Bye reply',
    allahhafiz: 'Allah Hafiz reply',
};

// Har command ke liye Queen MD cmd() register karo
for (const [pattern, text] of Object.entries(REPLIES)) {
    cmd({
        pattern: pattern,
        desc: DESCS[pattern] || pattern,
        category: "dailylife",
        filename: __filename
    },
    async (conn, mek, m, { from, q }) => {
        // Agar number diya ho to uske DM mein bhejo, warna isi chat mein
        let target = from;
        const numArg = String(q || '').trim().split(/\s+/)[0].replace(/[^0-9]/g, '');
        if (numArg.length >= 10) {
            target = numArg + '@s.whatsapp.net';
        }

        const isSameChat = target === from;
        await conn.sendMessage(target, {
            text: text + FOOTER
        }, isSameChat ? { quoted: mek } : {});
    });
}
