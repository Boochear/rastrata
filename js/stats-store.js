const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(process.cwd(), 'stats.json');

function dateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function todayKey() {
    return dateKey(new Date());
}

function loadStats() {
    try {
        return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

function saveStats(stats) {
    const tmpPath = STATS_FILE + '.tmp';
    try {
        fs.writeFileSync(tmpPath, JSON.stringify(stats));
        fs.renameSync(tmpPath, STATS_FILE);
    } catch (err) {
        console.error('failed to save stats:', err.message);
    }
}

function addTime(stats, appName, ms) {
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

function getStatsForPeriod(stats, period) {
    let filteredDays;

    if (period === 'today') {
        filteredDays = [todayKey()];
    } else if (period === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        filteredDays = [dateKey(y)];
    } else if (period === 'last7') {
        filteredDays = daysInRange(7);
    } else if (period === 'last30') {
        filteredDays = daysInRange(30);
    } else if (period === 'lastyear') {
        filteredDays = daysInRange(365);
    } else {
        filteredDays = Object.keys(stats);
    }

    const merged = {};
    filteredDays.forEach((day) => {
        const dayStats = stats[day];
        if (!dayStats) return;
        Object.entries(dayStats).forEach(([name, ms]) => {
            merged[name] = (merged[name] || 0) + ms;
        });
    });
    return merged;
}

module.exports = { dateKey, todayKey, loadStats, saveStats, addTime, getStatsForPeriod, periodIncludesToday };