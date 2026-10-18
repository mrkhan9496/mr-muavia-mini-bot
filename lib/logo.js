// Logo maker: SVG se PNG (sharp). Bina kisi external API ke, hamesha chalta hai.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// bg: [rang1, rang2], fill: [top, bottom], glow, stroke, deco
const STYLES = {
    neonlight:   { bg: ['#05010f', '#14052e'], fill: ['#ffffff', '#00f6ff'], glow: '#00e5ff', stroke: '#00e5ff', deco: 'frame' },
    blackpink:   { bg: ['#000000', '#1a0010'], fill: ['#ff5fa8', '#ff1493'], glow: '#ff1493', stroke: '#000000', deco: 'bars' },
    dragonball:  { bg: ['#ff9a00', '#ff5e00'], fill: ['#fff176', '#ffb300'], glow: '#ff6d00', stroke: '#7a2b00', deco: 'stars' },
    '3dcomic':   { bg: ['#fff7d6', '#ffe08a'], fill: ['#ffeb3b', '#ff9800'], glow: '#000000', stroke: '#000000', deco: 'dots', shadow: true },
    america:     { bg: ['#b22234', '#ffffff'], fill: ['#ffffff', '#ffffff'], glow: '#3c3b6e', stroke: '#3c3b6e', deco: 'flagus' },
    naruto:      { bg: ['#ff8f00', '#e65100'], fill: ['#ffffff', '#ffe0b2'], glow: '#bf360c', stroke: '#1a1a1a', deco: 'swirl' },
    sadgirl:     { bg: ['#1b1b2f', '#3d2c5e'], fill: ['#d7c4ff', '#a98bff'], glow: '#7e57c2', stroke: '#0d0d1a', deco: 'rain' },
    clouds:      { bg: ['#4fc3f7', '#e1f5fe'], fill: ['#ffffff', '#e3f2fd'], glow: '#ffffff', stroke: '#0288d1', deco: 'cloud' },
    futuristic:  { bg: ['#000814', '#001d3d'], fill: ['#00f5d4', '#00bbf9'], glow: '#00bbf9', stroke: '#001d3d', deco: 'grid' },
    '3dpaper':   { bg: ['#eceff1', '#cfd8dc'], fill: ['#ffffff', '#f5f5f5'], glow: '#90a4ae', stroke: '#b0bec5', deco: 'none', shadow: true },
    eraser:      { bg: ['#fafafa', '#e0e0e0'], fill: ['#212121', '#424242'], glow: '#bdbdbd', stroke: '#ffffff', deco: 'lines' },
    sunset:      { bg: ['#ff512f', '#dd2476'], fill: ['#fff3b0', '#ffd166'], glow: '#ff9e00', stroke: '#6a040f', deco: 'sun' },
    leaf:        { bg: ['#1b5e20', '#66bb6a'], fill: ['#f1f8e9', '#c5e1a5'], glow: '#aed581', stroke: '#1b5e20', deco: 'leaves' },
    galaxy:      { bg: ['#0b0033', '#370031'], fill: ['#ffffff', '#c3a6ff'], glow: '#9d4edd', stroke: '#240046', deco: 'stars' },
    sans:        { bg: ['#000000', '#111111'], fill: ['#ffffff', '#cfd8dc'], glow: '#00b0ff', stroke: '#000000', deco: 'frame' },
    boom:        { bg: ['#ffd600', '#ff6d00'], fill: ['#ff1744', '#d50000'], glow: '#ffffff', stroke: '#ffffff', deco: 'burst' },
    hacker:      { bg: ['#000000', '#001a00'], fill: ['#00ff41', '#00c030'], glow: '#00ff41', stroke: '#003b00', deco: 'matrix' },
    devilwings:  { bg: ['#1a0000', '#4a0000'], fill: ['#ff3d00', '#b71c1c'], glow: '#ff1744', stroke: '#000000', deco: 'wings', wing: '#220000' },
    nigeria:     { bg: ['#008751', '#008751'], fill: ['#ffffff', '#ffffff'], glow: '#004d2e', stroke: '#004d2e', deco: 'flagng' },
    bulb:        { bg: ['#0d0d0d', '#262626'], fill: ['#fff9c4', '#ffeb3b'], glow: '#ffee58', stroke: '#3e3a00', deco: 'bulbs' },
    angelwings:  { bg: ['#e3f2fd', '#ffffff'], fill: ['#fff8e1', '#ffd54f'], glow: '#ffecb3', stroke: '#90a4ae', deco: 'wings', wing: '#ffffff' },
    zodiac:      { bg: ['#10002b', '#240046'], fill: ['#e0aaff', '#9d4edd'], glow: '#c77dff', stroke: '#10002b', deco: 'circle' },
    luxury:      { bg: ['#0a0a0a', '#1c1c1c'], fill: ['#fff1b8', '#d4a017'], glow: '#d4a017', stroke: '#3b2f00', deco: 'frame' },
    paint:       { bg: ['#ffffff', '#f3f3f3'], fill: ['#e91e63', '#2196f3'], glow: '#ffeb3b', stroke: '#222222', deco: 'splash' },
    frozen:      { bg: ['#a1c4fd', '#c2e9fb'], fill: ['#ffffff', '#b3e5fc'], glow: '#4fc3f7', stroke: '#0277bd', deco: 'snow' },
    castle:      { bg: ['#2c3e50', '#4ca1af'], fill: ['#ffe0b2', '#ffb74d'], glow: '#ffb74d', stroke: '#1a252f', deco: 'castle' },
    tatoo:       { bg: ['#f5f0e6', '#e0d7c3'], fill: ['#111111', '#2b2b2b'], glow: '#8d6e63', stroke: '#111111', deco: 'lines' },
    valorant:    { bg: ['#0f1923', '#1f2c3a'], fill: ['#ff4655', '#ece8e1'], glow: '#ff4655', stroke: '#0f1923', deco: 'slash' },
    bear:        { bg: ['#8d6e63', '#d7ccc8'], fill: ['#fff3e0', '#ffe0b2'], glow: '#5d4037', stroke: '#3e2723', deco: 'bear' },
    typography:  { bg: ['#ffffff', '#f5f5f5'], fill: ['#111111', '#111111'], glow: '#eeeeee', stroke: '#ffffff', deco: 'typo' },
    birthday:    { bg: ['#ff9a9e', '#fad0c4'], fill: ['#ffffff', '#fff176'], glow: '#ff4081', stroke: '#c2185b', deco: 'confetti' },
};

const rnd = (seed) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

function decoSvg(kind, w, h, st) {
    const r = rnd(42);
    let o = '';
    switch (kind) {
        case 'stars': for (let i = 0; i < 70; i++) o += `<circle cx="${r() * w}" cy="${r() * h}" r="${r() * 2.2 + 0.4}" fill="#fff" opacity="${0.4 + r() * 0.6}"/>`; break;
        case 'dots': for (let x = 0; x < w; x += 28) for (let y = 0; y < h; y += 28) o += `<circle cx="${x}" cy="${y}" r="3" fill="#00000022"/>`; break;
        case 'frame': o = `<rect x="20" y="20" width="${w - 40}" height="${h - 40}" rx="18" fill="none" stroke="${st.glow}" stroke-width="4" opacity="0.9" filter="url(#glow)"/>`; break;
        case 'bars': o = `<rect x="0" y="40" width="${w}" height="14" fill="#ff1493"/><rect x="0" y="${h - 54}" width="${w}" height="14" fill="#ff1493"/>`; break;
        case 'lines': for (let i = -h; i < w; i += 22) o += `<line x1="${i}" y1="0" x2="${i + h}" y2="${h}" stroke="#00000012" stroke-width="3"/>`; break;
        case 'grid': for (let x = 0; x < w; x += 45) o += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#00bbf91f"/>`; for (let y = 0; y < h; y += 45) o += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#00bbf91f"/>`; break;
        case 'matrix': for (let i = 0; i < 60; i++) o += `<text x="${r() * w}" y="${r() * h}" font-size="18" fill="#00ff41" opacity="${0.15 + r() * 0.35}" font-family="monospace">${r() > 0.5 ? 1 : 0}</text>`; break;
        case 'rain': for (let i = 0; i < 80; i++) { const x = r() * w, y = r() * h; o += `<line x1="${x}" y1="${y}" x2="${x - 6}" y2="${y + 26}" stroke="#9fa8da" stroke-width="2" opacity="0.4"/>`; } break;
        case 'sun': o = `<circle cx="${w / 2}" cy="${h * 0.78}" r="150" fill="#ffd166" opacity="0.55"/><rect x="0" y="${h * 0.78}" width="${w}" height="${h * 0.22}" fill="#3d0c3a" opacity="0.7"/>`; break;
        case 'cloud': for (let i = 0; i < 7; i++) { const x = r() * w, y = r() * h; o += `<ellipse cx="${x}" cy="${y}" rx="${70 + r() * 60}" ry="${24 + r() * 18}" fill="#fff" opacity="0.55"/>`; } break;
        case 'leaves': for (let i = 0; i < 24; i++) o += `<ellipse cx="${r() * w}" cy="${r() * h}" rx="26" ry="10" fill="#2e7d32" opacity="0.35" transform="rotate(${r() * 180} ${r() * w} ${r() * h})"/>`; break;
        case 'burst': for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; o += `<polygon points="${w / 2},${h / 2} ${w / 2 + Math.cos(a) * 700},${h / 2 + Math.sin(a) * 700} ${w / 2 + Math.cos(a + 0.12) * 700},${h / 2 + Math.sin(a + 0.12) * 700}" fill="#ffffff" opacity="0.12"/>`; } break;
        case 'wings': o = `<path d="M${w / 2 - 330},${h / 2 + 40} Q${w / 2 - 470},${h / 2 - 190} ${w / 2 - 160},${h / 2 - 150} Q${w / 2 - 300},${h / 2 - 40} ${w / 2 - 240},${h / 2 + 60}Z" fill="${st.wing}" stroke="${st.glow}" stroke-width="3" opacity="0.9"/><path d="M${w / 2 + 330},${h / 2 + 40} Q${w / 2 + 470},${h / 2 - 190} ${w / 2 + 160},${h / 2 - 150} Q${w / 2 + 300},${h / 2 - 40} ${w / 2 + 240},${h / 2 + 60}Z" fill="${st.wing}" stroke="${st.glow}" stroke-width="3" opacity="0.9"/>`; break;
        case 'circle': o = `<circle cx="${w / 2}" cy="${h / 2}" r="190" fill="none" stroke="${st.glow}" stroke-width="3" opacity="0.7"/><circle cx="${w / 2}" cy="${h / 2}" r="165" fill="none" stroke="${st.glow}" stroke-width="1.5" stroke-dasharray="6 10" opacity="0.7"/>`; break;
        case 'splash': for (let i = 0; i < 10; i++) o += `<circle cx="${r() * w}" cy="${r() * h}" r="${14 + r() * 40}" fill="hsl(${r() * 360},85%,60%)" opacity="0.45"/>`; break;
        case 'snow': for (let i = 0; i < 60; i++) o += `<circle cx="${r() * w}" cy="${r() * h}" r="${r() * 4 + 1}" fill="#fff" opacity="0.85"/>`; break;
        case 'castle': o = `<path d="M0,${h} L0,${h - 90} L40,${h - 90} L40,${h - 130} L80,${h - 130} L80,${h - 90} L140,${h - 90} L140,${h - 160} L200,${h - 160} L200,${h - 90} L${w},${h - 90} L${w},${h}Z" fill="#1a252f" opacity="0.8"/>`; break;
        case 'slash': o = `<polygon points="0,${h} ${w * 0.35},0 ${w * 0.45},0 ${w * 0.1},${h}" fill="#ff4655" opacity="0.5"/><polygon points="${w},0 ${w * 0.65},${h} ${w * 0.55},${h} ${w * 0.9},0" fill="#ff4655" opacity="0.5"/>`; break;
        case 'confetti': for (let i = 0; i < 70; i++) o += `<rect x="${r() * w}" y="${r() * h}" width="10" height="16" fill="hsl(${r() * 360},90%,60%)" transform="rotate(${r() * 360} ${r() * w} ${r() * h})" opacity="0.8"/>`; break;
        case 'bulbs': for (let i = 0; i < 9; i++) o += `<circle cx="${60 + i * ((w - 120) / 8)}" cy="40" r="11" fill="#ffee58" filter="url(#glow)"/>`; break;
        case 'swirl': for (let i = 1; i < 6; i++) o += `<circle cx="${w / 2}" cy="${h / 2}" r="${i * 55}" fill="none" stroke="#00000022" stroke-width="6"/>`; break;
        case 'bear': o = `<circle cx="${w / 2 - 150}" cy="60" r="38" fill="#5d4037"/><circle cx="${w / 2 + 150}" cy="60" r="38" fill="#5d4037"/>`; break;
        case 'typo': for (let i = 0; i < 6; i++) o += `<text x="${(i * 160) % w}" y="${60 + i * 70}" font-size="64" fill="#00000010" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold">ABC</text>`; break;
        case 'flagus': o = `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#usstripes)"/><rect x="0" y="0" width="360" height="${h * 0.54}" fill="#3c3b6e"/>`; break;
        case 'flagng': o = `<rect x="${w / 3}" y="0" width="${w / 3}" height="${h}" fill="#ffffff"/>`; break;
        default: break;
    }
    return o;
}

function logoSvg(styleName, text) {
    const st = STYLES[styleName];
    const w = 900, h = 450;
    const t = esc(String(text).slice(0, 24));
    const len = Math.max(t.length, 1);
    const size = Math.max(54, Math.min(170, Math.floor(780 / (len * 0.64))));
    const cx = w / 2, cy = h / 2 + size * 0.34;
    const font = "font-family=\"Impact, 'DejaVu Sans', Arial, sans-serif\" font-weight=\"900\"";
    const usStripes = styleName === 'america'
        ? `<linearGradient id="usstripes" x1="0" y1="0" x2="0" y2="1">${Array.from({ length: 13 }, (_, i) => `<stop offset="${(i / 13) * 100}%" stop-color="${i % 2 ? '#fff' : '#b22234'}"/><stop offset="${((i + 1) / 13) * 100}%" stop-color="${i % 2 ? '#fff' : '#b22234'}"/>`).join('')}</linearGradient>` : '';
    const bgRect = (styleName === 'america' || styleName === 'nigeria') ? '' : `<rect width="${w}" height="${h}" fill="url(#bg)"/>`;
    const nigeriaBg = styleName === 'nigeria' ? `<rect width="${w}" height="${h}" fill="#008751"/>` : '';
    const shadow = st.shadow ? `<text x="${cx + 7}" y="${cy + 8}" text-anchor="middle" font-size="${size}" ${font} fill="#00000066">${t}</text>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${st.bg[0]}"/><stop offset="100%" stop-color="${st.bg[1]}"/></linearGradient>
<linearGradient id="tx" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${st.fill[0]}"/><stop offset="100%" stop-color="${st.fill[1]}"/></linearGradient>
<filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
${usStripes}
</defs>
${bgRect}${nigeriaBg}
${decoSvg(st.deco, w, h, st)}
<text x="${cx}" y="${cy}" text-anchor="middle" font-size="${size}" ${font} fill="${st.glow}" filter="url(#glow)" opacity="0.9">${t}</text>
${shadow}
<text x="${cx}" y="${cy}" text-anchor="middle" font-size="${size}" ${font} fill="url(#tx)" stroke="${st.stroke}" stroke-width="${Math.max(3, size / 22)}" paint-order="stroke" stroke-linejoin="round">${t}</text>
</svg>`;
}

async function makeLogo(styleName, text) {
    const sharp = require('sharp');
    return sharp(Buffer.from(logoSvg(styleName, text))).png().toBuffer();
}

module.exports = { STYLES, makeLogo, logoSvg };
