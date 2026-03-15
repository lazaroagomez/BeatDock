const fs = require('fs');
const path = require('path');

class LanguageManager {
    constructor() {
        this.locales = new Map();
        this.loadLocales();
    }

    loadLocales() {
        const localesPath = path.join(__dirname, '..', 'locales');
        const localeFiles = fs.readdirSync(localesPath).filter(file => file.endsWith('.json'));

        for (const file of localeFiles) {
            const locale = file.replace('.json', '');
            const translations = JSON.parse(fs.readFileSync(path.join(localesPath, file), 'utf-8'));
            this.locales.set(locale, translations);
        }
    }

    get(locale, key, ...args) {
        const translations = this.locales.get(locale) || this.locales.get('en');
        const fallback = this.locales.get('en');
        let translation = (Object.hasOwn(translations, key) ? translations[key] : null)
            || (Object.hasOwn(fallback, key) ? fallback[key] : key);

        if (typeof translation === 'string') {
            args.forEach((arg, index) => {
                translation = translation.replaceAll(`{${index}}`, String(arg));
            });
        }

        return translation;
    }
}

module.exports = LanguageManager; 