const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(process.cwd(), 'locales');
const BASE = 'en';
const RTL = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'ckb', 'ug']);

function scanLanguages() {
    let files = [];
    try {
        files = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));
    } catch { }
    const list = files.map((f) => {
        const code = f.slice(0, -5);
        const d = readLocale(code);
        return { code, name: d._name || code };
    });
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
}

const LANGUAGES = scanLanguages();

let baseDict = null;
let dict = {};

function readLocale(code) {
    try {
        return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, code + '.json'), 'utf-8'));
    } catch {
        return {};
    }
}

function detect() {
    const langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || BASE];
    for (const l of langs) {
        const low = l.toLowerCase();
        if (/^zh-(hk|mo|hant)/.test(low)) return 'zh-TW';
        const exact = LANGUAGES.find((x) => x.code.toLowerCase() === low);
        if (exact) return exact.code;
        const prefix = LANGUAGES.find((x) => x.code.toLowerCase().split('-')[0] === low.split('-')[0]);
        if (prefix) return prefix.code;
    }
    return BASE;
}

function setLanguage(setting) {
    if (!baseDict) baseDict = readLocale(BASE);
    const code = (!setting || setting === 'auto') ? detect() : setting;
    dict = code === BASE ? {} : readLocale(code);
    return code;
}

function t(key) {
    return dict[key] ?? (baseDict && baseDict[key]) ?? key;
}

function applyTranslations(doc) {
    doc.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = t(el.dataset.i18n);
    });
    const code = Object.keys(dict).length ? (dict['_code'] || BASE) : BASE;
    doc.documentElement.lang = code;
    doc.documentElement.dir = RTL.has(code.split('-')[0]) ? 'rtl' : 'ltr';
}

module.exports = { LANGUAGES, setLanguage, t, applyTranslations };