// scripts/generate-translations.ts
// Usage: GOOGLE_TRANSLATE_API_KEY=your_key npx ts-node --project tsconfig.json scripts/generate-translations.ts
import fs from 'fs';
import path from 'path';

const API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
if (!API_KEY) {
  console.error('GOOGLE_TRANSLATE_API_KEY env var is required');
  process.exit(1);
}

const LANGUAGES = ['sv', 'no', 'da', 'de', 'fr'];

async function translateBatch(texts: string[], target: string): Promise<string[]> {
  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: texts, target, source: 'en', format: 'text' }),
    }
  );
  const json = await res.json() as { data?: { translations?: { translatedText: string }[] } };
  if (!json.data?.translations) throw new Error(`Translate error: ${JSON.stringify(json)}`);
  return json.data.translations.map(t => t.translatedText);
}

// Recursively translate all string values in a JSON object, preserve structure
async function translateObject(
  obj: Record<string, unknown>,
  target: string
): Promise<Record<string, unknown>> {
  // Collect all string leaves with their paths
  const paths: string[][] = [];
  const values: string[] = [];

  function collect(o: unknown, path: string[]) {
    if (typeof o === 'string') { paths.push(path); values.push(o); }
    else if (typeof o === 'object' && o !== null) {
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) collect(v, [...path, k]);
    }
  }
  collect(obj, []);

  if (values.length === 0) return obj;

  // Translate in batches of 100 to avoid API limits
  const translated: string[] = [];
  for (let i = 0; i < values.length; i += 100) {
    const batch = values.slice(i, i + 100);
    const result = await translateBatch(batch, target);
    translated.push(...result);
  }

  // Rebuild the object with translated values
  const result = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
  for (let i = 0; i < paths.length; i++) {
    let node = result as Record<string, unknown>;
    for (const key of paths[i].slice(0, -1)) node = node[key] as Record<string, unknown>;
    node[paths[i][paths[i].length - 1]] = translated[i];
  }
  return result;
}

async function main() {
  const uiEn = JSON.parse(fs.readFileSync(path.join('messages', 'en.json'), 'utf8'));
  const missionsEn = JSON.parse(fs.readFileSync(path.join('messages', 'missions', 'en.json'), 'utf8'));

  for (const lang of LANGUAGES) {
    console.log(`Translating to ${lang}...`);

    const [uiTranslated, missionsTranslated] = await Promise.all([
      translateObject(uiEn, lang),
      translateObject(missionsEn, lang),
    ]);

    // Preserve language picker labels — these should stay in the target language name
    (uiTranslated as Record<string, Record<string, string>>).language = {
      pickerLabel: { sv: 'Språk', no: 'Språk', da: 'Sprog', de: 'Sprache', fr: 'Langue' }[lang] ?? 'Language',
      en: 'English', sv: 'Svenska', no: 'Norsk', da: 'Dansk', de: 'Deutsch', fr: 'Français',
    };

    fs.writeFileSync(
      path.join('messages', `${lang}.json`),
      JSON.stringify(uiTranslated, null, 2) + '\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join('messages', 'missions', `${lang}.json`),
      JSON.stringify(missionsTranslated, null, 2) + '\n',
      'utf8'
    );
    console.log(`  ✓ messages/${lang}.json and messages/missions/${lang}.json`);
  }
  console.log('Done!');
}

main().catch(err => { console.error(err); process.exit(1); });
