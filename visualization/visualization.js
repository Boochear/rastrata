const fs = require('fs');
const path = require('path');

const { loadSettings } = require('./js/settings-store');
const { applyFont } = require('./js/fonts');
const { setLanguage, t, applyTranslations } = require('./js/i18n');

new Function('module', 'exports', 'define',
    fs.readFileSync(path.join(process.cwd(), 'lib', 'echarts.min.js'), 'utf-8'))();

const win = nw.Window.get();

function applyAppearance() {
    const s = loadSettings();
    setLanguage(s.language);
    applyTranslations(document);
    document.body.setAttribute('data-theme', s.theme);
    applyFont(s.fontFamily, document);
}
applyAppearance();

document.getElementById('btn-close').addEventListener('click', () => win.close());

const PERIOD_DAYS = { last7: 7, last30: 30, lastyear: 365, all: null };
const state = { mode: 'apps', period: 'last7', drill: null };
let currentView = null;

const chart = echarts.init(document.getElementById('viz-chart'));
window.addEventListener('resize', () => chart.resize());

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
    const { stats, names } = window.mainWindowRef.getVizData();
    let keys = Object.keys(stats).sort();
    const n = PERIOD_DAYS[state.period];
    if (n) {
        const d = new Date();
        d.setDate(d.getDate() - (n - 1));
        const from = d.toISOString().slice(0, 10);
        keys = keys.filter((k) => k >= from);
    }
    return { stats, names, keys };
}

function buildView() {
    const { stats, names, keys } = getData();
    const name = (id) => names[id] || id;
    const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

    if (state.mode === 'apps' && !state.drill) {
        const totals = {};
        keys.forEach((k) => {
            Object.entries(stats[k]).forEach(([app, ms]) => {
                totals[app] = (totals[app] || 0) + ms;
            });
        });
        const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 15);
        return {
            crumb: t('viz.crumb.apps'),
            ids: top.map((t) => t[0]),
            labels: top.map((t) => name(t[0])),
            values: top.map((t) => t[1]),
            horizontal: true,
            drillable: true
        };
    }

    if (state.mode === 'apps') {
        const id = state.drill;
        const days = fillDays(keys);
        return {
            crumb: `${t('viz.crumb.apps')} › ${name(id)}`,
            ids: days,
            labels: days,
            values: days.map((d) => (stats[d] && stats[d][id]) || 0),
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
            values: days.map((d) => (stats[d] ? sum(stats[d]) : 0)),
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
        horizontal: true
    };
}

function draw(view) {
    const fg = cssVar('--fg');
    const soft = cssVar('--border-soft');
    const bg = cssVar('--bg');
    const border = cssVar('--border');

    const max = Math.max(0, ...view.values);
    const unit = max >= 7200000
        ? { div: 3600000, label: t('unit.hour') }
        : { div: 60000, label: t('unit.min') };
    const data = view.values.map((v) => +(v / unit.div).toFixed(2));

    const valueAxis = {
        type: 'value',
        name: unit.label,
        nameTextStyle: { color: fg },
        axisLabel: { color: fg },
        splitLine: { lineStyle: { color: soft, opacity: 0.4 } }
    };

    const categoryAxis = {
        type: 'category',
        data: view.labels,
        inverse: view.horizontal,
        axisLine: { lineStyle: { color: fg } },
        axisLabel: view.horizontal
            ? { color: fg, interval: 0, width: 120, overflow: 'truncate' }
            : { color: fg, formatter: (v) => v.slice(5) }
    };

    chart.setOption({
        animationDuration: 300,
        textStyle: { fontFamily: getComputedStyle(document.body).fontFamily, color: fg },
        grid: { left: 10, right: 24, top: 30, bottom: 10, containLabel: true },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: bg,
            borderColor: border,
            textStyle: { color: fg },
            formatter: (p) => `${p[0].name}<br><b>${fmt(p[0].value * unit.div)}</b>`
        },
        xAxis: view.horizontal ? valueAxis : categoryAxis,
        yAxis: view.horizontal ? categoryAxis : valueAxis,
        dataZoom: view.days ? [{ type: 'inside' }] : [],
        title: max > 0 ? { show: false } : {
            text: 'Нет данных',
            left: 'center',
            top: 'middle',
            textStyle: { color: fg }
        },
        series: [{
            type: 'bar',
            data,
            barMaxWidth: 28,
            cursor: view.drillable ? 'pointer' : 'default',
            itemStyle: { color: fg, borderRadius: 4 },
            emphasis: { itemStyle: { color: soft } }
        }]
    }, true);
}

function updateUI(view) {
    document.getElementById('viz-crumb').textContent = view.crumb;
    document.getElementById('viz-back').classList.toggle('hidden', !state.drill);
    document.querySelectorAll('[data-mode]').forEach((b) => {
        b.classList.toggle('selected', b.dataset.mode === state.mode);
    });
    document.querySelectorAll('[data-period]').forEach((b) => {
        b.classList.toggle('selected', b.dataset.period === state.period);
    });
}

function render() {
    currentView = buildView();
    updateUI(currentView);
    draw(currentView);
}

chart.on('click', (params) => {
    if (!currentView || !currentView.drillable) return;
    state.drill = currentView.ids[params.dataIndex];
    render();
});

document.getElementById('viz-back').addEventListener('click', () => {
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

window.onAppearanceChanged = function () {
    applyAppearance();
    render();
};

(function init() {
    if (!window.mainWindowRef) {
        setTimeout(init, 50);
        return;
    }
    render();
})();