const fs = require('fs');
const path = require('path');

class LanguageManager {
    constructor() {
        this.locales = new Map();
        this.loadLocales();
    }

    loadLocales() {
        try {
            const localesPath = path.join(__dirname, '..', 'locales');
            
            if (!fs.existsSync(localesPath)) {
                console.error('Locales directory not found:', localesPath);
                return;
            }
            
            const localeFiles = fs.readdirSync(localesPath).filter(file => file.endsWith('.json'));

            for (const file of localeFiles) {
                try {
                    const locale = file.replace('.json', '');
                    const filePath = path.join(localesPath, file);
                    const fileContent = fs.readFileSync(filePath, 'utf-8');
                    const translations = JSON.parse(fileContent);
                    this.locales.set(locale, translations);
                    console.log(`Loaded locale: ${locale}`);
                } catch (fileError) {
                    console.error(`Error loading locale file ${file}:`, fileError.message);
                }
            }
            
            // Ensure we have at least English as fallback
            if (!this.locales.has('en')) {
                console.warn('English locale not found, creating minimal fallback');
                this.locales.set('en', {
                    'ERROR_COMMAND_EXECUTION': 'An error occurred while executing this command.',
                    'BUTTON_ERROR': 'An error occurred while processing this button.',
                    'NOT_IN_VOICE': 'You need to be in a voice channel to use this command.',
                    'NOTHING_PLAYING': 'Nothing is currently playing.',
                    'QUEUE_EMPTY': 'The queue is empty.'
                });
            }
            
        } catch (error) {
            console.error('Error loading locales:', error);
            // Create minimal English fallback
            this.locales.set('en', {
                'ERROR_COMMAND_EXECUTION': 'An error occurred while executing this command.',
                'BUTTON_ERROR': 'An error occurred while processing this button.'
            });
        }
    }

    get(locale, key, ...args) {
        try {
            const translations = this.locales.get(locale) || this.locales.get('en');
            if (!translations) {
                console.warn(`No translations found for locale: ${locale}`);
                return key; // Return the key itself as fallback
            }
            
            let translation = translations[key];
            
            // Fallback to English if key not found in requested locale
            if (translation === undefined && locale !== 'en') {
                const englishTranslations = this.locales.get('en');
                if (englishTranslations) {
                    translation = englishTranslations[key];
                }
            }
            
            // If still no translation found, return the key
            if (translation === undefined) {
                console.warn(`Translation key not found: ${key} for locale: ${locale}`);
                return key;
            }

            if (typeof translation === 'string') {
                args.forEach((arg, index) => {
                    const regex = new RegExp(`\\{${index}\\}`, 'g');
                    translation = translation.replace(regex, arg);
                });
            }

            return translation;
        } catch (error) {
            console.error(`Error getting translation for key ${key}:`, error.message);
            return key; // Return key as fallback
        }
    }
}

module.exports = LanguageManager;
