// 🎧 AUDIO EFFECTS: kisi audio/voice/video ko reply karke command likho
const { cmd } = require('../inconnuboy');
const config = require('../config');
const { ffmpeg, getMediaBuffer } = require('../lib/util');

const SR = 'aresample=44100,';
const EFFECTS = {
    bass: 'equalizer=f=18:width_type=o:width=2:g=14',
    slow: 'atempo=0.75',
    fast: 'atempo=1.5',
    reverse: 'areverse',
    baby: SR + 'asetrate=44100*1.45,aresample=44100',
    demon: SR + 'asetrate=44100*0.62,aresample=44100,atempo=1.15',
    earrape: 'volume=12,acrusher=level_in=8:level_out=18:bits=8:mode=log:aa=1',
    nightcore: SR + 'asetrate=44100*1.25,aresample=44100',
    robot: "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75",
    chipmunk: SR + 'asetrate=44100*1.7,aresample=44100',
    radio: 'highpass=f=800,lowpass=f=3500,volume=1.6',
    blown: 'acrusher=.1:1:64:0:log,volume=2',
    tupai: SR + 'asetrate=44100*1.9,aresample=44100,atempo=0.9',
    fat: SR + 'asetrate=44100*0.8,aresample=44100,atempo=1.25',
    smooth: 'lowpass=f=5000,aecho=0.8:0.88:60:0.35',
    deep: SR + 'asetrate=44100*0.75,aresample=44100,atempo=1.1',
};

for (const [name, filter] of Object.entries(EFFECTS)) {
    cmd({ pattern: name, desc: `Audio effect: ${name}`, category: 'audio', react: '🎧', filename: __filename },
        async (conn, mek, m, { from, reply, prefix }) => {
            const media = await getMediaBuffer(m, ['audio', 'video']);
            if (!media) return reply(`🎧 Kisi *audio / voice note / video* ko reply karke *${prefix}${name}* likho.`);
            const out = await ffmpeg(media.buffer, 'bin', 'mp3', ['-vn', '-af', filter, '-b:a', '128k']);
            await conn.sendMessage(from, { audio: out, mimetype: 'audio/mpeg', ptt: false }, { quoted: mek });
        });
}
