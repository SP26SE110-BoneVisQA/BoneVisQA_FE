import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from '../locales/en/translation.json';

/**
 * System UI is English-only. Vietnamese is reserved for AI chat content (API `locale`).
 * Do not re-enable browser language detection for shell copy.
 */
const resources = {
  en: {
    translation: enTranslation,
  },
};

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: ['en'],
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;
