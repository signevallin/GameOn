// lib/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Statically imported so they're bundled and available synchronously
import enUi from '@/messages/en.json';
import enMissions from '@/messages/missions/en.json';

// Dynamic imports for non-English languages (loaded on demand)
const UI_MODULES: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  sv: () => import('@/messages/sv.json'),
  no: () => import('@/messages/no.json'),
  da: () => import('@/messages/da.json'),
  de: () => import('@/messages/de.json'),
  fr: () => import('@/messages/fr.json'),
};

const MISSION_MODULES: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  sv: () => import('@/messages/missions/sv.json'),
  no: () => import('@/messages/missions/no.json'),
  da: () => import('@/messages/missions/da.json'),
  de: () => import('@/messages/missions/de.json'),
  fr: () => import('@/messages/missions/fr.json'),
};

// Initialize synchronously with English so the first render always has translations.
// No async plugins — i18next initializes synchronously when all resources are provided inline.
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    ns: ['translation', 'missions'],
    defaultNS: 'translation',
    resources: {
      en: {
        translation: enUi as unknown as Record<string, unknown>,
        missions: enMissions as unknown as Record<string, unknown>,
      },
    },
    interpolation: { escapeValue: false },
  });
}

export async function initI18n(language: string) {
  const safeLanguage = (language === 'en' || UI_MODULES[language]) ? language : 'en';

  if (safeLanguage === 'en') {
    if (i18n.language !== 'en') await i18n.changeLanguage('en');
    return;
  }

  const [uiMod, missionsMod] = await Promise.all([
    UI_MODULES[safeLanguage](),
    MISSION_MODULES[safeLanguage](),
  ]);

  i18n.addResourceBundle(safeLanguage, 'translation', uiMod.default, true, true);
  i18n.addResourceBundle(safeLanguage, 'missions', missionsMod.default, true, true);
  await i18n.changeLanguage(safeLanguage);
}

export default i18n;
