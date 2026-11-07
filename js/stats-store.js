const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(process.cwd(), 'stats.json');
let lastSaved = null;
let rev = 0;
const caches = new WeakMap();

function resetStatsCache() { rev++; }

function dateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function todayKey() {
    return dateKey(new Date());
}

function loadStats() {
    rev++;
    try {
        const data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
        lastSaved = JSON.stringify(data);
        return data;
    } catch {
        return {};
    }
}

function saveStats(stats) {
    const json = JSON.stringify(stats);
    if (json === lastSaved) return;
    const tmpPath = STATS_FILE + '.tmp';
    try {
        fs.writeFileSync(tmpPath, json);
        fs.renameSync(tmpPath, STATS_FILE);
        lastSaved = json;
    } catch (err) {
        console.error('failed to save stats:', err.message);
    }
}

function addTime(stats, appName, ms) {
    rev++;
    const end = Date.now();
    let start = end - ms;
    while (start < end) {
        const d = new Date(start);
        const nextMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
        const chunk = Math.min(end, nextMidnight) - start;
        const day = dateKey(d);
        if (!stats[day]) stats[day] = {};
        stats[day][appName] = (stats[day][appName] || 0) + chunk;
        start += chunk;
    }
}

function daysInRange(n) {
    const result = [];
    const now = new Date();
    for (let i = 0; i < n; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        result.push(dateKey(d));
    }
    return result;
}

function periodIncludesToday(period) {
    return period !== 'yesterday';
}

function mergeDays(stats, days) {
    const merged = {};
    for (const day of days) {
        const dayStats = stats[day];
        if (!dayStats) continue;
        for (const name in dayStats) merged[name] = (merged[name] || 0) + dayStats[name];
    }
    return merged;
}

function getStatsForPeriod(stats, period) {
    if (period === 'today') return mergeDays(stats, [todayKey()]);
    if (period === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        return mergeDays(stats, [dateKey(y)]);
    }
    const today = todayKey();
    let perStats = caches.get(stats);
    if (!perStats) { perStats = new Map(); caches.set(stats, perStats); }
    let c = perStats.get(period);
    if (!c || c.rev !== rev || c.today !== today) {
        let days;
        if (period === 'last7') days = daysInRange(7);
        else if (period === 'last30') days = daysInRange(30);
        else if (period === 'lastyear') days = daysInRange(365);
        else days = Object.keys(stats);
        c = { rev, today, data: mergeDays(stats, days.filter((d) => d !== today)) };
        perStats.set(period, c);
    }
    const out = Object.assign({}, c.data);
    const t = stats[today];
    if (t) for (const name in t) out[name] = (out[name] || 0) + t[name];
    return out;
}

module.exports = { dateKey, todayKey, loadStats, saveStats, addTime, getStatsForPeriod, periodIncludesToday, resetStatsCache };