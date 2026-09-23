const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(process.cwd(), 'stats.json');

function todayKey() {
    return new Date().toISOString().slice(0, 10);
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
        fs.writeFileSync(tmpPath, JSON.stringify(stats, null, 2));
        fs.renameSync(tmpPath, STATS_FILE);
    } catch (err) {
        console.error('failed to save stats:', err.message);
    }
}

function addTime(stats, appName, ms) {
    const day = todayKey();
    if (!stats[day]) stats[day] = {};
    stats[day][appName] = (stats[day][appName] || 0) + ms;
}

function daysInRange(n) {
    const result = [];
    const now = new Date();
    for (let i = 0; i < n; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        result.push(d.toISOString().slice(0, 10));
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
        filteredDays = [y.toISOString().slice(0, 10)];
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

module.exports = { todayKey, loadStats, saveStats, addTime, getStatsForPeriod, periodIncludesToday };