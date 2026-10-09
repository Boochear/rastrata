function toMinutes(str, fallback) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(str || ''));
    if (!m) return fallback;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return fallback;
    return h * 60 + min;
}

function isNight(settings, now) {
    const from = toMinutes(settings.nightFrom, 21 * 60);
    const to = toMinutes(settings.nightTo, 7 * 60);
    if (from === to) return false;
    const cur = now.getHours() * 60 + now.getMinutes();
    return from < to ? (cur >= from && cur < to) : (cur >= from || cur < to);
}

function isThanksgivingWeek(now) {
    const y = now.getFullYear();
    const first = new Date(y, 10, 1);
    const day = 1 + ((4 - first.getDay() + 7) % 7) + 21;
    const start = new Date(y, 10, day - 4);
    const end = new Date(y, 10, day + 3);
    return now >= start && now < end;
}

function holidayTheme(now) {
    const md = (now.getMonth() + 1) * 100 + now.getDate();
    if (md >= 1220 && md <= 1222) return '23';
    if (md >= 1015 && md <= 1101) return '20';
    if (isThanksgivingWeek(now)) return '22';
    if (md >= 1215 || md <= 110) return '21';
    return null;
}

function seasonTheme(now) {
    const m = now.getMonth() + 1;
    if (m === 12 || m <= 2) return '32';
    if (m <= 5) return '29';
    if (m <= 8) return '30';
    return '31';
}

function resolveTheme(settings, now = new Date()) {
    if (settings.holidayThemes) {
        const h = holidayTheme(now);
        if (h) return h;
    }
    if (settings.autoNight && isNight(settings, now)) {
        return String(settings.nightTheme);
    }
    if (settings.seasonalThemes) {
        return seasonTheme(now);
    }
    return String(settings.theme);
}

module.exports = { resolveTheme, holidayTheme, seasonTheme, isNight };