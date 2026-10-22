// Sticker banane ka common code (wa-sticker-formatter, fail ho to seedha ffmpeg)
const { toWebp } = require('./util');

async function makeSticker(buffer, { pack = 'Queen MD MINI', author = 'Queen MD Mini', type = 'full', ext = 'jpg' } = {}) {
    try {
        const { Sticker, StickerTypes } = require('wa-sticker-formatter');
        const st = new Sticker(buffer, {
            pack, author,
            type: type === 'crop' ? StickerTypes.CROPPED : type === 'circle' ? StickerTypes.CIRCLE : StickerTypes.FULL,
            quality: 50, background: 'transparent',
        });
        return await st.toBuffer();
    } catch (_) {
        return toWebp(buffer, ext);
    }
}

module.exports = { makeSticker };
