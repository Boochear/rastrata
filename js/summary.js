const { dateKey } = require('./stats-store');

const SEASONS = ['winter', 'spring', 'summer', 'autumn'];

function seasonOf(month) {
    if (month === 11 || month <= 1) return 'winter';
    if (month <= 4) return 'spring';
    if (month <= 7) return 'summer';
    return 'autumn';
}

function rangeFor(kind, ref) {
    const y = ref.getFullYear();
    const m = ref.getMonth();
    let from;
    let to;
    if (kind === 'month') {
        from = new Date(y, m, 1);
        to = new Date(y, m + 1, 0);
    } else if (kind === 'year') {
        from = new Date(y, 0, 1);
        to = new Date(y, 11, 31);
    } else {
        const s = seasonOf(m);
        const startMonth = { winter: 11, spring: 2, summer: 5, autumn: 8 }[s];
        const startYear = s === 'winter' && m <= 1 ? y - 1 : y;
        from = new Date(startYear, startMonth, 1);
        to = new Date(startYear, startMonth + 3, 0);
    }
    return { from, to, fromKey: dateKey(from), season: kind === 'season' ? seasonOf(from.getMonth()) : null };
}

function shiftRef(kind, ref, dir) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), 15);
    if (kind === 'month') d.setMonth(d.getMonth() + dir);
    else if (kind === 'season') d.setMonth(d.getMonth() + 3 * dir);
    else d.setFullYear(d.getFullYear() + dir);
    return d;
}

function keysOf(range) {
    const out = [];
    for (let d = new Date(range.from); d <= range.to; d.setDate(d.getDate() + 1)) out.push(dateKey(d));
    return out;
}

function summarize(stats, keys) {
    const apps = {};
    let total = 0;
    let best = ['', 0];
    let activeDays = 0;
    keys.forEach((k) => {
        const day = stats[k];
        if (!day) return;
        let sum = 0;
        Object.entries(day).forEach(([app, ms]) => {
            apps[app] = (apps[app] || 0) + ms;
            sum += ms;
        });
        total += sum;
        if (sum > 0) activeDays++;
        if (sum > best[1]) best = [k, sum];
    });
    return {
        total,
        activeDays,
        best,
        days: keys.length,
        apps: Object.entries(apps).sort((a, b) => b[1] - a[1])
    };
}

function rangeLabel(kind, range, t, lang) {
    const year = range.from.getFullYear();
    if (kind === 'month') return range.from.toLocaleDateString(lang, { month: 'long', year: 'numeric' });
    if (kind === 'year') return String(year);
    return `${t('season.' + range.season)} ${year}${range.season === 'winter' ? '–' + (year + 1) : ''}`;
}

function previousFull(kind, today) {
    return rangeFor(kind, shiftRef(kind, today, -1));
}

module.exports = { SEASONS, rangeFor, shiftRef, keysOf, summarize, previousFull, rangeLabel };
