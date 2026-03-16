const pc = require('picocolors');

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const TAG_THRESHOLD = { cmd: 1, track: 1 };

const currentLevel = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;

function timestamp() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function shouldLog(level) {
    const threshold = LEVELS[level] ?? TAG_THRESHOLD[level] ?? 0;
    return threshold >= currentLevel;
}

function formatTag(level) {
    const tags = {
        debug: pc.dim('[DEBUG]'),
        info:  pc.cyan('[INFO] '),
        cmd:   pc.magenta('[CMD]  '),
        track: pc.blue('[TRACK]'),
        warn:  pc.yellow('[WARN] '),
        error: pc.red('[ERROR]'),
    };
    return tags[level] || pc.white(`[${level.toUpperCase()}]`);
}

function log(level, message, ...args) {
    if (!shouldLog(level)) return;
    const prefix = `${pc.dim(timestamp())} ${formatTag(level)}`;
    const method = level === 'error' ? console.error
                 : level === 'warn' ? console.warn
                 : console.log;
    method(prefix, message, ...args);
}

module.exports = {
    debug: (msg, ...args) => log('debug', msg, ...args),
    info:  (msg, ...args) => log('info', msg, ...args),
    warn:  (msg, ...args) => log('warn', msg, ...args),
    error: (msg, ...args) => log('error', msg, ...args),
    cmd:   (msg, ...args) => log('cmd', msg, ...args),
    track: (msg, ...args) => log('track', msg, ...args),
};
