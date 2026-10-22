const fs = require('fs');
const path = require('path');

const { loadSettings } = require('./js/settings-store');
const { dateKey } = require('./js/stats-store');
const { applyFont } = require('./js/fonts');
const { setLanguage, t, applyTranslations } = require('./js/i18n');
const { resolveTheme } = require('./js/theme-scheduler');
const { rangeFor, shiftRef, keysOf, summarize, rangeLabel } = require('./js/summary');

new Function('module', 'exports', 'define',
    fs.readFileSync(path.join(process.cwd(), 'lib', 'echarts.min.js'), 'utf-8'))();

const win = nw.Window.get();

let rainbow = false;
let glowPx = 10;

function applyAppearance() {
    const s = loadSettings();
    rainbow = !!s.vizRainbow;
    glowPx = Number(s.glow);
    if (!Number.isFinite(glowPx)) glowPx = 10;
    document.body.style.setProperty('--glow-size', glowPx + 'px');
    setLanguage(s.language);
    applyTranslations(document);
    document.body.setAttribute('data-theme', resolveTheme(s));
    document.body.setAttribute('data-anim', s.themeAnimations === false ? 'off' : 'on');
    applyFont(s.fontFamily, document);
    document.body.style.setProperty('--bg-blur', Number(s.backgroundBlur) || 0);
}
applyAppearance();

const $ = (id) => document.getElementById(id);

$('btn-close').addEventListener('click', () => win.hide());

const PERIOD_DAYS = { last7: 7, last30: 30, lastyear: 365, all: null };
const state = { mode: 'apps', period: 'last7', drill: null, sumKind: 'month', sumOffset: 0 };
let currentView = null;

const chart = echarts.init($('viz-chart'));
window.addEventListener('resize', () => {
    chart.resize();
    if (donut) donut.resize();
});

function cssVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function fmt(ms) {
    if (ms < 60000) return `${Math.round(ms / 1000)} ${t('unit.sec')}`;
    const m = Math.round(ms / 60000);
    const h = Math.floor(m / 60);
    return h > 0
        ? `${h} ${t('unit.hour')} ${m % 60} ${t('unit.min')}`
        : `${m} ${t('unit.min')}`;
}

function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toRgb(color) {
    const el = document.createElement('div');
    el.style.color = color;
    document.body.appendChild(el);
    const c = getComputedStyle(el).color;
    el.remove();
    const m = c.match(/[\d.]+/g) || [255, 255, 255];
    return [Number(m[0]), Number(m[1]), Number(m[2])];
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
    }
    return [h, s, l];
}

function hslToRgb(h, s, l) {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
    return [f(0), f(8), f(4)];
}

const TIP = {
    confine: true,
    appendToBody: true,
    position: (pt) => [pt[0] + 16, pt[1] + 12]
};

function rainbowColor(i, n) {
    return `hsl(${Math.round((i / Math.max(n, 1)) * 300)}, 75%, 58%)`;
}

function palette(n) {
    const make = (h, s, l) => {
        const [r, g, b] = hslToRgb(((h % 360) + 360) % 360, s, l);
        const [r2, g2, b2] = hslToRgb(((h + 28) % 360 + 360) % 360, s, Math.min(l + 0.08, 0.8));
        return { c: `rgb(${r}, ${g}, ${b})`, c2: `rgb(${r2}, ${g2}, ${b2})`, soft: `rgba(${r}, ${g}, ${b}, 0.18)` };
    };
    if (rainbow) {
        return Array.from({ length: n }, (_, i) => make((i / Math.max(n, 1)) * 300, 0.78, 0.58));
    }
    const [h, s0, l0] = rgbToHsl(...toRgb(cssVar('--accent') || cssVar('--fg')));
    const gray = s0 < 0.08;
    return Array.from({ length: n }, (_, i) => {
        if (gray) {
            const dir = l0 < 0.5 ? 1 : -1;
            return make(0, 0, Math.min(Math.max(l0 + dir * i * 0.035, 0.08), 0.92));
        }
        const s = Math.min(Math.max(s0, 0.35), 0.85);
        const l = Math.max(0.36, Math.min(Math.max(l0, 0.5), 0.68) - i * 0.018);
        return make(h + i * 7, s, l);
    });
}

function sumValues(obj) {
    return Object.values(obj).reduce((a, b) => a + b, 0);
}

function fillDays(keys) {
    if (!keys.length) return [];
    const out = [];
    const end = new Date(keys[keys.length - 1] + 'T00:00:00Z').getTime();
    for (let t = new Date(keys[0] + 'T00:00:00Z').getTime(); t <= end; t += 86400000) {
        out.push(new Date(t).toISOString().slice(0, 10));
    }
    return out;
}

function getData() {
    const data = window.mainWindowRef.getVizData();
    const n = PERIOD_DAYS[state.period];
    let from = '';
    if (n) {
        const d = new Date();
        d.setDate(d.getDate() - (n - 1));
        from = dateKey(d);
    }
    const inRange = (k) => k >= from;
    data.keys = Object.keys(data.stats).filter(inRange).sort();
    data.siteKeys = Object.keys(data.sites).filter(inRange).sort();
    return data;
}

function allOf(source, keys) {
    const totals = {};
    keys.forEach((k) => {
        Object.entries(source[k]).forEach(([id, ms]) => {
            totals[id] = (totals[id] || 0) + ms;
        });
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

const DAY = 86400000;

function dayCards(data) {
    const lastDays = (n) => {
        const out = [];
        for (let i = 0; i < n; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            out.push(dateKey(d));
        }
        return out;
    };
    const used = (keys) => keys.reduce((a, k) => a + (data.stats[k] ? sumValues(data.stats[k]) : 0), 0);
    const first = Object.keys(data.stats).sort()[0];
    const lifeDays = first ? Math.max(1, Math.round((new Date(dateKey(new Date()) + 'T00:00:00Z') - new Date(first + 'T00:00:00Z')) / DAY) + 1) : 1;
    const cards = [['day', 1], ['week', 7], ['month', 30], ['year', 365]].map(([name, n]) => {
        const ms = used(lastDays(n));
        const sub = n === 1
            ? `${fmt(ms)} ${t('day.of24')}`
            : `${t('day.avg')}: ${fmt(ms / n)} ${t('day.of24')}`;
        return [t('comp.' + name), `${(ms / (n * DAY) * 100).toFixed(1)}%`, sub];
    });
    const lifeMs = used(Object.keys(data.stats));
    cards.push([t('comp.life'), `${(lifeMs / (lifeDays * DAY) * 100).toFixed(1)}%`, `${t('day.avg')}: ${fmt(lifeMs / lifeDays)} ${t('day.of24')}`]);
    $('viz-cards').innerHTML = cards.map(([title, value, sub]) =>
        `<div class="viz-card"><span>${esc(title)}</span><b>${esc(value)}</b><span>${esc(sub)}</span></div>`).join('');
}

function buildView() {
    const data = getData();
    const { stats, names, icons, keys } = data;
    const name = (id) => names[id] || id;

    if (state.mode === 'calendar') {
        const daily = {};
        Object.keys(stats).forEach((k) => { daily[k] = sumValues(stats[k]); });
        return { crumb: t('viz.crumb.calendar'), calendar: true, daily };
    }

    if (state.mode === 'computer') {
        dayCards(data);
        const days = fillDays(keys);
        const used = days.map((d) => (stats[d] ? sumValues(stats[d]) : 0));
        return {
            crumb: t('viz.crumb.computer'),
            ids: days,
            labels: days,
            values: used,
            values2: used.map((v) => Math.max(0, DAY - v)),
            day24: true,
            horizontal: false,
            days: true
        };
    }

    if ((state.mode === 'apps' || state.mode === 'sites') && !state.drill) {
        const isSites = state.mode === 'sites';
        const all = allOf(isSites ? data.sites : stats, isSites ? data.siteKeys : keys);
        const top = all.slice(0, 15);
        return {
            crumb: t(isSites ? 'viz.crumb.sites' : 'viz.crumb.apps'),
            ids: top.map((x) => x[0]),
            labels: top.map((x) => (isSites ? x[0] : name(x[0]))),
            values: top.map((x) => x[1]),
            icons: top.map((x) => (isSites ? data.siteIcons[x[0]] : icons[x[0]])),
            total: all.reduce((a, x) => a + x[1], 0),
            count: all.length,
            horizontal: true,
            drillable: true
        };
    }

    if (state.mode === 'apps' || state.mode === 'sites') {
        const id = state.drill;
        const isSites = state.mode === 'sites';
        const source = isSites ? data.sites : stats;
        const days = fillDays(isSites ? data.siteKeys : keys);
        return {
            crumb: `${t(isSites ? 'viz.crumb.sites' : 'viz.crumb.apps')} › ${isSites ? id : name(id)}`,
            ids: days,
            labels: days,
            values: days.map((d) => (source[d] && source[d][id]) || 0),
            horizontal: false,
            days: true
        };
    }

    if (!state.drill) {
        const days = fillDays(keys);
        return {
            crumb: t('viz.crumb.days'),
            ids: days,
            labels: days,
            values: days.map((d) => (stats[d] ? sumValues(stats[d]) : 0)),
            horizontal: false,
            days: true,
            drillable: true
        };
    }

    const day = state.drill;
    const rows = Object.entries(stats[day] || {}).sort((a, b) => b[1] - a[1]);
    return {
        crumb: `${t('viz.crumb.days')} › ${day}`,
        ids: rows.map((r) => r[0]),
        labels: rows.map((r) => name(r[0])),
        values: rows.map((r) => r[1]),
        icons: rows.map((r) => icons[r[0]]),
        total: rows.reduce((a, r) => a + r[1], 0),
        count: rows.length,
        horizontal: true
    };
}

function draw(view) {
    const fg = cssVar('--fg');
    const accent = cssVar('--accent') || fg;
    const soft = cssVar('--border-soft');
    const bg = cssVar('--bg');
    const border = cssVar('--border');

    const max = Math.max(0, ...view.values, ...(view.values2 || []));
    const day24 = !!view.day24;
    const unit = day24 || max >= 7200000
        ? { div: 3600000, label: t('unit.hour') }
        : { div: 60000, label: t('unit.min') };
    const toUnit = (arr) => arr.map((v) => +(v / unit.div).toFixed(2));

    const valueAxis = {
        type: 'value',
        name: unit.label,
        nameTextStyle: { color: fg },
        axisLabel: { color: fg },
        splitLine: { lineStyle: { color: soft, opacity: 0.4 } },
        ...(day24 ? { min: 0, max: 24, interval: 6 } : {})
    };

    const rich = {};
    (view.icons || []).forEach((src, i) => {
        if (src) rich['i' + i] = { width: 16, height: 16, backgroundColor: { image: src } };
    });

    const categoryAxis = {
        type: 'category',
        data: view.labels,
        inverse: view.horizontal,
        axisLine: { lineStyle: { color: fg } },
        axisLabel: view.horizontal
            ? {
                color: fg,
                interval: 0,
                width: 150,
                overflow: 'truncate',
                rich,
                formatter: (v, i) => (view.icons && view.icons[i] ? `{i${i}|} ${v}` : v)
            }
            : { color: fg, formatter: (v) => v.slice(5) }
    };

    const series = [{
        type: 'bar',
        name: day24 ? t('day.used') : '',
        data: toUnit(view.values),
        stack: day24 ? 'day' : undefined,
        barMaxWidth: 28,
        cursor: view.drillable ? 'pointer' : 'default',
        itemStyle: {
            color: rainbow && !day24 ? (p) => rainbowColor(p.dataIndex, view.values.length) : accent,
            borderRadius: day24 ? 0 : 4,
            shadowBlur: glowPx,
            shadowColor: accent
        },
        emphasis: { itemStyle: { color: fg } }
    }];
    if (view.values2) {
        series.push({
            type: 'bar',
            name: t('day.free'),
            data: toUnit(view.values2),
            stack: 'day',
            barMaxWidth: 28,
            itemStyle: { color: 'rgba(128, 128, 128, 0.25)', borderRadius: [4, 4, 0, 0] }
        });
    }

    chart.setOption({
        animationDuration: 300,
        textStyle: { fontFamily: getComputedStyle(document.body).fontFamily, color: fg },
        legend: view.values2 ? { top: 0, textStyle: { color: fg } } : { show: false },
        grid: { left: 10, right: 24, top: view.values2 ? 40 : 30, bottom: 10, containLabel: true },
        tooltip: {
            ...TIP,
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: bg,
            borderColor: border,
            textStyle: { color: fg },
            formatter: (p) => day24
                ? `${p[0].name}<br><b>${fmt(p[0].value * unit.div)}</b> · ${(p[0].value * unit.div / DAY * 100).toFixed(1)}% ${t('day.ofday')}`
                : `${p[0].name}<br><b>${fmt(p[0].value * unit.div)}</b>`
        },
        xAxis: view.horizontal ? valueAxis : categoryAxis,
        yAxis: view.horizontal ? categoryAxis : valueAxis,
        dataZoom: view.days ? [{ type: 'inside' }] : [],
        title: max > 0 ? { show: false } : {
            text: t('viz.nodata'),
            left: 'center',
            top: 'middle',
            textStyle: { color: fg }
        },
        series
    }, true);
}

function renderCalendar(view) {
    const fg = cssVar('--fg');
    const accentRgb = toRgb(cssVar('--accent') || fg);
    const lang = document.documentElement.lang || 'en';
    const todayKey = dateKey(new Date());
    const max = Math.max(1, ...Object.values(view.daily));
    const dow = [0, 1, 2, 3, 4, 5, 6].map((i) => new Date(2024, 0, 1 + i).toLocaleDateString(lang, { weekday: 'short' }));
    const head = dow.map((d) => `<div class="cal-dow">${esc(d)}</div>`).join('');
    const now = new Date();
    let html = '';
    for (let i = 0; i < 12; i++) {
        const first = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
        let cells = head + '<div class="cal-day pad"></div>'.repeat((first.getDay() + 6) % 7);
        for (let d = 1; d <= count; d++) {
            const key = dateKey(new Date(first.getFullYear(), first.getMonth(), d));
            const ms = view.daily[key] || 0;
            let style = '';
            if (ms > 0) {
                const ratio = ms / max;
                const alpha = 0.22 + 0.78 * ratio;
                const [r, g, b] = rainbow ? hslToRgb(((d - 1) / count) * 300, 0.78, 0.56) : accentRgb;
                const dark = (0.299 * r + 0.587 * g + 0.114 * b) > 150;
                style = `background:rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)});` + (alpha > 0.6 ? `color:${dark ? '#111' : '#fff'};` : '');
            }
            cells += `<div class="cal-day${ms ? ' has' : ''}${key === todayKey ? ' today' : ''}" data-day="${key}" title="${key}${ms ? ' · ' + esc(fmt(ms)) : ''}" style="${style}">${d}</div>`;
        }
        html += `<div class="cal-month"><div class="cal-title">${esc(first.toLocaleDateString(lang, { month: 'long', year: 'numeric' }))}</div><div class="cal-grid">${cells}</div></div>`;
    }
    $('viz-calendar').innerHTML = html;
}

function summaryRef() {
    let ref = new Date();
    ref = new Date(ref.getFullYear(), ref.getMonth(), 15);
    for (let i = 0; i < -state.sumOffset; i++) ref = shiftRef(state.sumKind, ref, -1);
    return ref;
}

function renderSummary() {
    const data = window.mainWindowRef.getVizData();
    const ref = summaryRef();
    const range = rangeFor(state.sumKind, ref);
    const prevRange = rangeFor(state.sumKind, shiftRef(state.sumKind, ref, -1));
    const cur = summarize(data.stats, keysOf(range));
    const prev = summarize(data.stats, keysOf(prevRange));
    const label = rangeLabel(state.sumKind, range, t, document.documentElement.lang || 'en');

    let delta = '';
    if (prev.total > 0) {
        const pct = Math.round((cur.total - prev.total) / prev.total * 100);
        delta = `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% ${t('sum.vsprev')}`;
    }
    const avg = cur.activeDays ? cur.total / cur.activeDays : 0;
    const elapsed = Math.max(1, keysOf(range).filter((k) => k <= dateKey(new Date())).length);
    const cards = [
        [t('sum.total'), fmt(cur.total), delta],
        [t('day.share'), `${(cur.total / (elapsed * DAY) * 100).toFixed(1)}%`, `${fmt(cur.total / elapsed)} ${t('day.perday')}`],
        [t('sum.avg'), fmt(avg), `${cur.activeDays} ${t('sum.activedays')}`],
        [t('sum.best'), cur.best[0] ? fmt(cur.best[1]) : '—', cur.best[0]]
    ];

    const names = data.names;
    const top = cur.apps.slice(0, 10).map(([id, ms]) => {
        const icon = data.icons[id] ? `<img class="sum-icon" src="${esc(data.icons[id])}">` : '';
        const pct = cur.total ? Math.round(ms / cur.total * 100) : 0;
        return `<div class="sum-line"><span>${icon}${esc(names[id] || id)}</span><span>${esc(fmt(ms))} · ${pct}%</span></div>`;
    }).join('');

    $('viz-summary').innerHTML =
        `<div class="viz-cards-inline" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:10px">` +
        cards.map(([title, value, sub]) => `<div class="viz-card"><span>${esc(title)}</span><b>${esc(value)}</b><span>${esc(sub)}</span></div>`).join('') +
        `</div>` +
        `<div class="sum-head">${esc(t('sum.top'))}</div>` +
        (top || `<div class="sum-line"><span>${esc(t('viz.nodata'))}</span></div>`);

    return { crumb: label };
}

let donut = null;

function renderBoard(view) {
    const pal = palette(view.ids.length);
    const fg = cssVar('--fg');
    const bg = cssVar('--bg');
    const border = cssVar('--border');
    const max = Math.max(1, ...view.values);
    const total = view.total || 1;

    const slices = view.ids.slice(0, 8).map((id, i) => ({
        name: view.labels[i],
        value: view.values[i],
        itemStyle: { color: pal[i].c }
    }));
    const rest = view.total - slices.reduce((a, x) => a + x.value, 0);
    if (rest > 0) slices.push({ name: t('board.other'), value: rest, itemStyle: { color: 'rgba(128, 128, 128, 0.45)' } });

    $('viz-board').classList.toggle('rainbow', rainbow);
    if (!donut) donut = echarts.init($('board-donut'));
    donut.resize();
    donut.setOption({
        animationDuration: 500,
        textStyle: { fontFamily: getComputedStyle(document.body).fontFamily, color: fg },
        tooltip: {
            ...TIP,
            trigger: 'item',
            backgroundColor: bg,
            borderColor: border,
            textStyle: { color: fg },
            formatter: (p) => `${esc(p.name)}<br><b>${fmt(p.value)}</b> · ${p.percent}%`
        },
        title: {
            text: fmt(view.total),
            subtext: t('board.total'),
            left: 'center',
            top: 'center',
            itemGap: 2,
            textStyle: { color: fg, fontSize: 15, fontWeight: 800 },
            subtextStyle: { color: fg, fontSize: 11 }
        },
        series: [
            ...(glowPx > 0 ? [{
                type: 'pie',
                z: 1,
                silent: true,
                radius: ['58%', '86%'],
                label: { show: false },
                labelLine: { show: false },
                itemStyle: { borderWidth: 0 },
                data: slices.map((x) => ({
                    name: x.name,
                    value: x.value,
                    itemStyle: { color: x.itemStyle.color, shadowBlur: glowPx, shadowColor: x.itemStyle.color }
                }))
            }] : []),
            {
                type: 'pie',
                z: 2,
                radius: ['58%', '86%'],
                label: { show: false },
                labelLine: { show: false },
                itemStyle: { borderRadius: 6, borderColor: bg, borderWidth: 3 },
                emphasis: { scaleSize: 6 },
                data: slices
            }
        ]
    }, true);

    const lead = view.ids.length ? `${t('board.leader')}: <b>${esc(view.labels[0])}</b> · ${Math.round(view.values[0] / total * 100)}%` : '';
    $('board-stats').innerHTML =
        `<div class="board-big">${esc(fmt(view.total))}</div>` +
        `<div class="board-cap">${view.count} ${esc(t('board.items'))}</div>` +
        `<div class="board-lead">${lead}</div>`;

    $('board-list').innerHTML = view.ids.length ? view.ids.map((id, i) => {
        const p = pal[i];
        const icon = view.icons && view.icons[i]
            ? `<img src="${esc(view.icons[i])}">`
            : esc(String(view.labels[i]).charAt(0).toUpperCase());
        const rank = i < 3 ? ` m${i + 1}` : '';
        return `<div class="board-row${i === 0 ? ' first' : ''}${view.drillable ? ' drill' : ''}" data-i="${i}" style="--c:${p.c};--c2:${p.c2};--cbg:${p.soft};animation-delay:${i * 40}ms">` +
            `<div class="board-rank${rank}">${i + 1}</div>` +
            `<div class="board-avatar">${icon}</div>` +
            `<div class="board-main"><div class="board-line"><span class="board-name">${esc(view.labels[i])}</span><span class="board-time">${esc(fmt(view.values[i]))}</span></div>` +
            `<div class="board-bar"><i style="width:${(view.values[i] / max * 100).toFixed(1)}%;--d:${i * 40 + 100}ms;animation-delay:${i * 40 + 100}ms"></i></div></div>` +
            `<div class="board-pct">${Math.round(view.values[i] / total * 100)}%</div></div>`;
    }).join('') : `<div class="sum-line"><span>${esc(t('viz.nodata'))}</span></div>`;

    $('board-list').querySelectorAll('.board-row.drill').forEach((row) => {
        row.addEventListener('click', () => {
            state.drill = view.ids[Number(row.dataset.i)];
            render();
        });
    });
}

function updateUI(view) {
    const m = state.mode;
    $('viz-crumb').textContent = view.crumb;
    $('viz-back').classList.toggle('hidden', !state.drill);
    $('viz-period-bar').classList.toggle('hidden', m === 'calendar' || m === 'summary');
    $('viz-sum-bar').classList.toggle('hidden', m !== 'summary');
    $('viz-cards').classList.toggle('hidden', m !== 'computer');
    $('viz-chart').classList.toggle('hidden', m === 'summary' || !!view.horizontal || !!view.calendar);
    $('viz-calendar').classList.toggle('hidden', !view.calendar);
    $('viz-board').classList.toggle('hidden', !view.horizontal);
    $('viz-summary').classList.toggle('hidden', m !== 'summary');
    document.querySelectorAll('[data-mode]').forEach((b) => {
        b.classList.toggle('selected', b.dataset.mode === m);
    });
    document.querySelectorAll('[data-period]').forEach((b) => {
        b.classList.toggle('selected', b.dataset.period === state.period);
    });
    document.querySelectorAll('[data-sum]').forEach((b) => {
        b.classList.toggle('selected', b.dataset.sum === state.sumKind);
    });
    $('sum-next').classList.toggle('hidden', state.sumOffset >= 0);
}

function render() {
    if (state.mode === 'summary') {
        currentView = renderSummary();
        updateUI(currentView);
        return;
    }
    currentView = buildView();
    updateUI(currentView);
    if (currentView.horizontal) {
        renderBoard(currentView);
        return;
    }
    if (currentView.calendar) {
        renderCalendar(currentView);
        return;
    }
    chart.resize();
    draw(currentView);
}

$('viz-calendar').addEventListener('click', (e) => {
    const cell = e.target.closest('.cal-day.has');
    if (!cell) return;
    state.mode = 'days';
    state.drill = cell.dataset.day;
    render();
});

chart.on('click', (params) => {
    if (!currentView || !currentView.drillable) return;
    state.drill = currentView.ids[params.dataIndex];
    render();
});

$('viz-back').addEventListener('click', () => {
    state.drill = null;
    render();
});

document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
        state.mode = btn.dataset.mode;
        state.drill = null;
        render();
    });
});

document.querySelectorAll('[data-period]').forEach((btn) => {
    btn.addEventListener('click', () => {
        state.period = btn.dataset.period;
        state.drill = null;
        render();
    });
});

document.querySelectorAll('[data-sum]').forEach((btn) => {
    btn.addEventListener('click', () => {
        state.sumKind = btn.dataset.sum;
        state.sumOffset = 0;
        render();
    });
});

$('sum-prev').addEventListener('click', () => {
    state.sumOffset--;
    render();
});

$('sum-next').addEventListener('click', () => {
    if (state.sumOffset < 0) state.sumOffset++;
    render();
});

window.showMode = function (mode, kind) {
    state.mode = mode;
    state.drill = null;
    if (kind) {
        state.sumKind = kind;
        state.sumOffset = -1;
    }
    render();
    win.show();
    win.focus();
};

window.onShown = function () {
    render();
    win.show();
    win.focus();
};

window.onAppearanceChanged = function () {
    applyAppearance();
    render();
};

(function init() {
    if (!window.mainWindowRef) {
        setTimeout(init, 50);
        return;
    }
    const first = window.initialMode;
    if (first) {
        state.mode = first.mode;
        if (first.kind) {
            state.sumKind = first.kind;
            state.sumOffset = -1;
        }
    }
    render();
    if (location.hash !== '#prewarm') win.show();
})();
