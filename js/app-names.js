const path = require('path');

const CONTAINERS = new Set(['common', 'games', 'epic games', 'program files', 'program files (x86)']);
const RE_EXE = /\.exe$/i;
const RE_DIGITS = /^[\d.\s]+$/;
const RE_NON_ALNUM = /[^a-zA-Z0-9]/g;
const cache = new Map();
const norm = (s) => String(s || '').replace(RE_NON_ALNUM, '').toLowerCase();

function good(s, proc) {
    if (!s) return false;
    s = String(s).trim();
    if (s.length < 2) return false;
    if (RE_EXE.test(s)) return false;
    if (s.toLowerCase() === String(proc).toLowerCase()) return false;
    if (RE_DIGITS.test(s)) return false;
    return true;
}

function fromFolder(proc, exePath) {
    if (!exePath) return null;
    const want = norm(proc);
    const dir = path.dirname(exePath);
    for (let d = dir; ;) {
        const parent = path.dirname(d);
        if (parent === d) break;
        const parentName = path.basename(parent).toLowerCase();
        if (CONTAINERS.has(parentName)) {
            const ok = parentName !== 'common' ||
                path.basename(path.dirname(parent)).toLowerCase() === 'steamapps';
            if (ok) return path.basename(d);
        }
        d = parent;
    }
    let d = dir;
    for (let up = 0; up < 4; up++) {
        const name = path.basename(d);
        if (want && norm(name) === want) return name;
        const parent = path.dirname(d);
        if (parent === d) break;
        d = parent;
    }
    return null;
}

function prettify(proc) {
    let s = String(proc || '').replace(/[-_.]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ').trim();
    if (s === s.toLowerCase()) s = s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
    return s || proc;
}

function resolveName(proc, description, exePath) {
    const key = (exePath || '') + '|' + proc;
    if (cache.has(key)) return cache.get(key);
    const name = good(description, proc)
        ? String(description).trim()
        : (fromFolder(proc, exePath) || prettify(proc));
    if (cache.size > 500) cache.clear();
    cache.set(key, name);
    return name;
}

module.exports = { resolveName };