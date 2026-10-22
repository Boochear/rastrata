const BROWSERS = new Set([
    'chrome', 'googlechrome', 'msedge', 'microsoftedge', 'firefox', 'opera', 'operagx', 'brave',
    'bravebrowser', 'vivaldi', 'browser', 'yandex', 'safari', 'chromium', 'arc', 'iexplore',
    'librewolf', 'zen', 'waterfox', 'thorium'
]);

const BROWSER_TITLE = /chrome|firefox|edge|opera|brave|vivaldi|yandex|яндекс|браузер|safari|chromium|\barc\b|\bzen\b|librewolf|waterfox|thorium/i;
const EMPTY_TITLE = /^(new tab|новая вкладка|about:blank|untitled|start page|домашняя страница|empty)$/i;

const TITLE_SITES = [
    'SoundCloud', 'YouTube', 'Twitch', 'GitHub', 'GitLab', 'Reddit', 'Spotify', 'Telegram', 'Discord',
    'Twitter', 'Instagram', 'Facebook', 'TikTok', 'Netflix', 'Wikipedia', 'Stack Overflow', 'ChatGPT',
    'Claude', 'Google', 'Yandex', 'Яндекс', 'VK', 'ВКонтакте', 'Ozon', 'Wildberries', 'Avito', 'Rutube',
    'Kinopoisk', 'Кинопоиск', 'Pinterest', 'LinkedIn', 'Steam', 'Figma', 'Notion', 'Trello', 'Bandcamp',
    'Deezer', 'Last.fm', 'Habr', 'Хабр', 'Pikabu', 'Пикабу', 'DTF', 'AliExpress', 'Amazon', 'Gmail'
];

function knownSite(text) {
    const low = text.toLowerCase();
    let best = null;
    let bestAt = -1;
    TITLE_SITES.forEach((name) => {
        const key = name.toLowerCase();
        const at = key.length < 3 ? (new RegExp('(^|[^\\p{L}\\d])' + key + '($|[^\\p{L}\\d])', 'u').test(low) ? low.length : -1) : low.lastIndexOf(key);
        if (at > bestAt) {
            bestAt = at;
            best = name;
        }
    });
    return best;
}

function isBrowser(appName) {
    return BROWSERS.has(String(appName).toLowerCase().replace(/[\s._-]/g, ''));
}

function siteFromTitle(title) {
    let parts = String(title || '').replace(/^\(\d+\)\s*/, '').split(/\s[-–—|·]\s/).map((p) => p.trim()).filter(Boolean);
    if (parts.length && BROWSER_TITLE.test(parts[parts.length - 1])) parts.pop();
    if (!parts.length) return null;
    const known = knownSite(parts.join(' | '));
    if (known) return known;
    const site = parts[parts.length - 1].slice(0, 40);
    return EMPTY_TITLE.test(site) ? null : site;
}

const TWO_PART = new Set([
    'co.uk', 'org.uk', 'ac.uk', 'com.au', 'net.au', 'com.br', 'co.jp', 'co.kr', 'co.nz', 'co.in',
    'com.tr', 'com.ua', 'com.cn', 'com.mx', 'com.ar', 'co.za', 'com.pl'
]);

function siteFromUrl(url) {
    let host;
    try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        host = u.hostname.toLowerCase();
    } catch {
        return null;
    }
    if (!host || /^[\d.]+$/.test(host) || host.includes(':')) return host || null;
    const labels = host.replace(/^www\./, '').split('.');
    if (labels.length <= 2) return labels.join('.');
    const lastTwo = labels.slice(-2).join('.');
    return TWO_PART.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

function siteFromAddressBar(text) {
    let v = String(text || '').trim();
    if (!v) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) {
        if (/\s/.test(v.split('/')[0])) return null;
        v = 'https://' + v;
    }
    let host = '';
    try { host = new URL(v).hostname; } catch { return null; }
    if (!host || (!host.includes('.') && host !== 'localhost')) return null;
    return siteFromUrl(v);
}

module.exports = { isBrowser, siteFromTitle, siteFromUrl, siteFromAddressBar };
