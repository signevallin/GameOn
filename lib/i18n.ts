// lib/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Explicit map prevents webpack from tree-shaking the JSON files
const UI_MODULES: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('@/messages/en.json'),
  sv: () => import('@/messages/sv.json'),
  no: () => import('@/messages/no.json'),
  da: () => import('@/messages/da.json'),
  de: () => import('@/messages/de.json'),
  fr: () => import('@/messages/fr.json'),
};

const MISSION_MODULES: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('@/messages/missions/en.json'),
  sv: () => import('@/messages/missions/sv.json'),
  no: () => import('@/messages/missions/no.json'),
  da: () => import('@/messages/missions/da.json'),
  de: () => import('@/messages/missions/de.json'),
  fr: () => import('@/messages/missions/fr.json'),
};

export async function initI18n(language: string) {
  const safeLanguage = UI_MODULES[language] ? language : 'en';

  const [uiMod, missionsMod] = await Promise.all([
    (UI_MODULES[safeLanguage] ?? UI_MODULES.en)(),
    (MISSION_MODULES[safeLanguage] ?? MISSION_MODULES.en)(),
  ]);

  const uiStrings = uiMod.default;
  const missionStrings = missionsMod.default;

  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: safeLanguage,
      fallbackLng: 'en',
      ns: ['translation', 'missions'],
      defaultNS: 'translation',
      resources: {
        [safeLanguage]: {
          translation: uiStrings,
          missions: missionStrings,
        },
      },
      interpolation: { escapeValue: false },
    });

    // Always have English as fallback
    if (safeLanguage !== 'en') {
      const [enUi, enMissions] = await Promise.all([UI_MODULES.en(), MISSION_MODULES.en()]);
      i18n.addResourceBundle('en', 'translation', enUi.default, true, true);
      i18n.addResourceBundle('en', 'missions', enMissions.default, true, true);
    }
  } else {
    i18n.addResourceBundle(safeLanguage, 'translation', uiStrings, true, true);
    i18n.addResourceBundle(safeLanguage, 'missions', missionStrings, true, true);
    await i18n.changeLanguage(safeLanguage);
  }
}

export default i18n;
