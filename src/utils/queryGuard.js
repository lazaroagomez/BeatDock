const { isSafeExternalHost } = require('./networkGuard');

const SEARCH_PREFIXES = [
    'ytsearch:',
    'ytmsearch:',
    'scsearch:',
    'spsearch:',
    'amsearch:',
    'dzsearch:',
    'ymsearch:',
];

const BLOCKED_PROTOCOLS = new Set([
    'data:',
    'file:',
    'ftp:',
    'gopher:',
    'javascript:',
]);

function stripToken(token) {
    return token.replace(/^[<("'`]+|[>)"',`]+$/g, '');
}

function hasSearchPrefix(value) {
    const lower = value.toLowerCase();
    return SEARCH_PREFIXES.some(prefix => lower.startsWith(prefix));
}

function parseUrlToken(token) {
    const cleaned = stripToken(token);
    if (!cleaned || hasSearchPrefix(cleaned)) return null;

    if (/^https?:\/\//i.test(cleaned)) {
        return new URL(cleaned);
    }

    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)) {
        return new URL(cleaned);
    }

    if (/^(localhost|(\d{1,3}\.){3}\d{1,3}|\[[0-9a-f:]+\])(:\d+)?(\/|$)/i.test(cleaned)) {
        return new URL(`https://${cleaned}`);
    }

    if (/^(www\.|[a-z0-9-]+(\.[a-z0-9-]+)+)(:\d+)?\//i.test(cleaned)) {
        return new URL(`https://${cleaned}`);
    }

    return null;
}

async function validatePlaybackQuery(query) {
    const trimmed = String(query || '').trim();
    if (!trimmed || hasSearchPrefix(trimmed)) {
        return { allowed: true };
    }

    const tokens = trimmed.match(/\S+/g) || [];

    for (const token of tokens) {
        let url;
        try {
            url = parseUrlToken(token);
        } catch {
            return { allowed: false, reason: 'invalid-url' };
        }

        if (!url) continue;

        if (BLOCKED_PROTOCOLS.has(url.protocol)) {
            return { allowed: false, reason: 'blocked-protocol' };
        }

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            continue;
        }

        const safeHost = await isSafeExternalHost(url.hostname);
        if (!safeHost) {
            return { allowed: false, reason: 'blocked-host' };
        }
    }

    return { allowed: true };
}

module.exports = { validatePlaybackQuery };
