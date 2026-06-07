// lib/translate.ts
import { SupabaseClient } from '@supabase/supabase-js';

export async function translateText(text: string, targetLang: string): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey || !text.trim()) return text;

  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, target: targetLang, source: 'en', format: 'text' }),
      }
    );
    const json = await res.json() as { data?: { translations?: { translatedText: string }[] } };
    return json?.data?.translations?.[0]?.translatedText ?? text;
  } catch {
    return text; // silent fallback
  }
}

export async function translateMission(
  missionId: string,
  language: string,
  sourceName: string,
  sourceDesc: string,
  supabase: SupabaseClient
): Promise<{ name: string; desc: string }> {
  // 1. Check cache first
  try {
    const { data: cached } = await supabase
      .from('mission_translations')
      .select('name, desc')
      .eq('mission_id', missionId)
      .eq('language', language)
      .single();

    if (cached) return { name: cached.name, desc: cached.desc ?? sourceDesc };
  } catch {
    // Not cached — continue to translate
  }

  // 2. Translate name and desc in parallel
  const [translatedName, translatedDesc] = await Promise.all([
    translateText(sourceName, language),
    translateText(sourceDesc, language),
  ]);

  // 3. Cache the result (ignore errors — translation still works without cache)
  try {
    await supabase.from('mission_translations').upsert(
      { mission_id: missionId, language, name: translatedName, desc: translatedDesc },
      { onConflict: 'mission_id,language' }
    );
  } catch {
    // Non-critical — fall through
  }

  return { name: translatedName, desc: translatedDesc };
}
