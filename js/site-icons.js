const fs = require('fs');
const path = require('path');
const https = require('https');

const FILE = path.join(process.cwd(), 'siteicons.json');

const KNOWN = {
    soundcloud: 'soundcloud.com', bandcamp: 'bandcamp.com', gitlab: 'gitlab.com', youtube: 'youtube.com', github: 'github.com', twitch: 'twitch.tv', discord: 'discord.com',
    reddit: 'reddit.com', telegram: 'telegram.org', vk: 'vk.com', 'вконтакте': 'vk.com',
    google: 'google.com', yandex: 'yandex.ru', 'яндекс': 'yandex.ru', wikipedia: 'wikipedia.org',
    chatgpt: 'chatgpt.com', openai: 'openai.com', claude: 'claude.ai', twitter: 'x.com', x: 'x.com',
    steam: 'store.steampowered.com', facebook: 'facebook.com', instagram: 'instagram.com',
    tiktok: 'tiktok.com', netflix: 'netflix.com', spotify: 'spotify.com', amazon: 'amazon.com',
    ozon: 'ozon.ru', wildberries: 'wildberries.ru', avito: 'avito.ru', rutube: 'rutube.ru',
    kinopoisk: 'kinopoisk.ru', 'кинопоиск': 'kinopoisk.ru', 'stack overflow': 'stackoverflow.com',
    linkedin: 'linkedin.com', pinterest: 'pinterest.com', whatsapp: 'whatsapp.com', figma: 'figma.com',
    notion: 'notion.so', trello: 'trello.com', aliexpress: 'aliexpress.com', gmail: 'mail.google.com',
    'google docs': 'docs.google.com', 'google drive': 'drive.google.com', 'google maps': 'maps.google.com'
};

function candidates(site) {
    const s = String(site).trim().toLowerCase();
    if (KNOWN[s]) return [KNOWN[s]];
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)) return [s];
    const slug = s.replace(/[^a-z0-9]/g, '');
    if (slug.length < 3 || slug !== s.replace(/\s+/g, '')) return [];
    return [slug + '.com', slug + '.ru', slug + '.org', slug + '.net'];
}

function fetchIcon(domain) {
    return new Promise((resolve) => {
        const req = https.get(`https://icons.duckduckgo.com/ip3/${domain}.ico`, {
            headers: { 'User-Agent': 'Rastrata-app' },
            timeout: 5000
        }, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                return resolve(null);
            }
            const chunks = [];
            let size = 0;
            res.on('data', (c) => {
                size += c.length;
                if (size > 200000) { req.destroy(); return resolve(null); }
                chunks.push(c);
            });
            res.on('end', () => {
                const buf = Buffer.concat(chunks);
                resolve(buf.length > 100 ? `data:${res.headers['content-type'] || 'image/x-icon'};base64,${buf.toString('base64')}` : null);
            });
        });
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.on('error', () => resolve(null));
    });
}

function shrink(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                const c = document.createElement('canvas');
                c.width = c.height = 32;
                c.getContext('2d').drawImage(img, 0, 0, 32, 32);
                const out = c.toDataURL('image/png');
                resolve(out.length < dataUrl.length ? out : dataUrl);
            } catch { resolve(dataUrl); }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

function saveFile(icons) {
    const tmp = FILE + '.tmp';
    try {
        fs.writeFileSync(tmp, JSON.stringify(icons));
        fs.renameSync(tmp, FILE);
    } catch { }
}

function createSiteIcons(onReady) {
    let icons = {};
    try { icons = JSON.parse(fs.readFileSync(FILE, 'utf-8')); } catch { }
    const tried = new Set();
    (async () => {
        let changed = false;
        for (const key of Object.keys(icons)) {
            const v = icons[key];
            if (typeof v === 'string' && v.length > 6000) {
                const small = await shrink(v);
                if (small !== v) { icons[key] = small; changed = true; }
            }
        }
        if (changed) { saveFile(icons); onReady(); }
    })();
    async function request(site) {
        if (!site || icons[site] || tried.has(site)) return;
        tried.add(site);
        for (const domain of candidates(site)) {
            const raw = await fetchIcon(domain);
            if (raw) {
                icons[site] = await shrink(raw);
                saveFile(icons);
                onReady();
                return;
            }
        }
    }
    return { icons, request };
}

module.exports = { createSiteIcons };
