// components/LanguagePicker.tsx
'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { initI18n } from '@/lib/i18n';

const LANGUAGES = [
  { code: 'en', flag: '🇬🇧' },
  { code: 'sv', flag: '🇸🇪' },
  { code: 'no', flag: '🇳🇴' },
  { code: 'da', flag: '🇩🇰' },
  { code: 'de', flag: '🇩🇪' },
  { code: 'fr', flag: '🇫🇷' },
];

export default function LanguagePicker() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const currentLang = i18n.language ?? 'en';

  async function handleSelect(code: string) {
    setOpen(false);
    localStorage.setItem('gameon_lang', code);
    await initI18n(code);
  }

  const current = LANGUAGES.find(l => l.code === currentLang) ?? LANGUAGES[0];

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={t('language.pickerLabel')}
        title={t('language.pickerLabel')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '4px 8px',
          cursor: 'pointer',
          fontFamily: "'Sora', sans-serif",
          fontSize: '12px',
          color: 'var(--muted)',
          lineHeight: 1,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ fontSize: '14px' }}>{current.flag}</span>
        <span>{currentLang.toUpperCase()}</span>
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 900 }}
            onClick={() => setOpen(false)}
          />
          {/* dropdown */}
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 1000,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            overflow: 'hidden',
            minWidth: '160px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: lang.code === currentLang ? 'var(--surface)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '13px',
                  color: lang.code === currentLang ? 'var(--accent)' : 'var(--text)',
                  fontWeight: lang.code === currentLang ? 700 : 400,
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '16px' }}>{lang.flag}</span>
                <span>{t(`language.${lang.code}`)}</span>
                {lang.code === currentLang && (
                  <span style={{ marginLeft: 'auto', fontSize: '14px' }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
