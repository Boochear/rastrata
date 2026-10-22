const http = require('http');

const PORT = 47821;
const EXTENSION_ORIGIN = /^(chrome|moz|safari-web)-extension:\/\//;

function createSiteServer(onTab) {
    const server = http.createServer((req, res) => {
        const origin = req.headers.origin || '';
        const fromExtension = EXTENSION_ORIGIN.test(origin);
        res.setHeader('Access-Control-Allow-Origin', fromExtension ? origin : 'null');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            return res.end();
        }
        if (!fromExtension || req.method !== 'POST' || req.url !== '/tab') {
            res.writeHead(403);
            return res.end();
        }

        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
            if (body.length > 20000) req.destroy();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                onTab({ url: String(data.url || ''), focused: !!data.focused });
            } catch { }
            res.writeHead(204);
            res.end();
        });
    });

    server.on('error', (err) => console.error('site server:', err.message));
    server.listen(PORT, '127.0.0.1');

    return { close: () => server.close() };
}

module.exports = { createSiteServer };
