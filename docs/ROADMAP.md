# GameOn — Produktroadmap

> Uppdaterad: 2026-06-07

---

## Nuläge ✅

Plattformen är fullt fungerande med:
- 30+ färdiga uppdrag (IT, trivia, foto, musik, duel)
- Anpassade uppdrag (custom mission builder)
- Realtids-leaderboard och adminpanel
- Power-ups (Sabotage, Dubbla poäng, Falsk ledtråd, Hot Potato)
- Fotoinlämningar med adminbedömning
- PDF-rapport efter spel
- Stripe-betalning (Starter / Pro / Studio)
- AI-chatbot på landningssidan
- Superadmin-analytics (KPIs, kundlista, uppdragsranking)

---

## Nu — Q3 2026

Förbättringar som löser tydliga smärtpunkter hos befintliga kunder.

### 🔁 Kopiera spel
Kunna duplicera ett tidigare spel med samma inställningar, uppdrag och tid — utan att behöva konfigurera om från scratch.
- Nytt "Kopiera"-knapp i spellistan i AdminScreen
- Ny POST-action `action: 'duplicate'` i `/api/admin/game`

### 📅 Schemalägg spel
Boka ett spel i förväg med datum/tid. Spelet startar automatiskt, ingen admin behöver vara inloggad.
- `scheduled_at`-kolumn på games-tabellen
- Cron-job (Vercel Cron) som startar spel vid rätt tid

### 🏆 Delningsbara resultat
Teams och kunder kan dela sin slutpoäng på sociala medier — en "resultatkort"-bild med laget namn, poäng och plats.
- `/api/team/result-card` som genererar en OG-bild med `@vercel/og`
- Delningsknapp i ResultScreen

### 📱 Bättre mobilupplevelse
Mobilvy för admin — just nu är AdminScreen svår att använda på telefon. Prioritera tabbar, leaderboard och fotobedömning.
- Responsiv layout för kritiska admin-vyer

---

## Nästa — Q4 2026

Funktioner som ökar intäkter och öppnar nya kundsegment.

### 🌐 Fler språk (i18n)
Svenska och engelska som standard. Möjlighet att byta språk i spelet (viktigt för internationella kunder och mixed-language lag).
- `next-intl` eller enkel JSON-baserad i18n
- Adminval: vilket språk spelet körs på

### 🎮 Spelmallar / Paket
Förpaketerade spelkonfigurationer för vanliga scenarion — t.ex. "IT Onboarding", "After Work", "Företagsfest".
- Gallerisida med mallar i admin-vytets skapa-flöde
- En mall laddar förvalda uppdrag + inställningar

### 📊 Per-spel-rapport i adminpanelen
Statistik direkt i UI:t (inte bara PDF) — vilka uppdrag fick högst poäng, var lag fastnade, genomsnittstid per uppdrag.
- Ny flik "Statistik" per spel i AdminScreen
- Bygger på befintlig `mission_scores`-data

### 🔔 Push-notiser till lag
Teams får push-notis (PWA) när ett power-up aktiveras mot dem, eller när spelet startar/slutar.
- Service worker + Web Push API
- Ersätter/kompletterar befintlig polling-mekanik

### 🖼️ Bilduppdrag med AI-bedömning
Admin kan aktivera AI-automatisk bedömning av fotouppdrag (istället för manuell rating) med hjälp av Claude Vision.
- Ny admininställning per uppdrag: "AI-bedöm foton"
- `/api/admin/photos/ai-rate` som anropar Claude Haiku med bild-URL

---

## Senare — 2027+

Strategiska satsningar beroende på vilken riktning som växer mest.

### 🏢 White-label / Varumärkesanpassning
Kunder (framför allt Studio-tier) kan sätta sin logga, färgpalett och domän — spelet ser ut som kundens produkt.
- Custom logo/färger per admin-konto
- CNAME-stöd via Vercel

### 🏪 Uppdragsmarknadsplats
Kunder kan sälja eller dela sina egna anpassade uppdragspaket till andra GameOn-kunder.
- Marketplace-vy i adminpanelen
- Köp/gratis-modell, intäktsdelning

### 🔌 Webhooks & API för integrationer
Kunder kan koppla GameOn till egna system (Slack, Teams, HR-system) — notiser om spel, resultat, poäng.
- Webhook-konfiguration per kund
- Dokumenterat REST API med API-nyckel

### 🗓️ Återkommande spel / Ligor
Kör samma spelformat varje vecka/månad — automatisk liga med ackumulerade poäng över tid.
- `league`-entitet som samlar spelinstanser
- Ligatabell i AdminScreen och ResultScreen

### 📲 Native app (iOS/Android)
PWA fungerar men en native app ger bättre kameraåtkomst (viktigt för fotouppdrag) och push-notiser.
- React Native med Expo
- Kamera-API för fotouppdrag utan workarounds

---

## Prioriteringsprinciper

1. **Befintliga kunder först** — funktioner som löser frustration för de som redan betalar
2. **Intäktsdriven** — funktioner som motiverar uppgradering (Starter → Pro → Studio)
3. **Minimal komplexitet** — undvik features som kräver stor infrastruktur utan bevisad efterfrågan
4. **Datadrivet** — superadmin-analytics visar vilka uppdrag/spel som underpresterar → informerar vad som behöver förbättras
