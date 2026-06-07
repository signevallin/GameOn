# GameOn — Produktroadmap

> Uppdaterad: 2026-06-07

---

## Nuläge ✅

Plattformen är fullt fungerande med 30+ uppdrag, realtids-leaderboard, power-ups, fotouppdrag, custom missions, PDF-rapport, Stripe-betalning, AI-chatbot och superadmin-analytics.

---

## Vecka 1 — Snabba vinster

Funktioner som löser tydliga smärtpunkter och kan levereras snabbt.

- 🔁 **Kopiera spel** — duplicera befintliga spelkonfig direkt
- 📅 **Schemalägg spel** — boka framtida spel som startar automatiskt (Vercel Cron)
- 🏆 **Delningsbara resultatkort** — OG-bild med laget, poäng och placering att dela på sociala medier
- 📱 **Mobilvy för admin** — responsiv AdminScreen för telefon (leaderboard, foton, power-ups)
- 📊 **Per-spel-statistik i UI** — vilka uppdrag fick mest/minst poäng, var lag fastnade

---

## Vecka 2 — Produktmognad

Funktioner som höjer kvaliteten och öppnar nya kundsegment.

- 🌐 **Fler språk (i18n)** — svenska + engelska, adminval per spel
- 🎮 **Spelmallar** — "After Work", "IT Onboarding", "Onboarding Ny Anställd" etc.
- 🔔 **Push-notiser till lag** (PWA Web Push) — power-ups, spelstart, spelslut
- 🖼️ **AI-bedömning av fotouppdrag** — Claude Vision bedömer foton automatiskt, admin kan godkänna/neka

---

## Månad 1 — Plattformsskifte

Större satsningar som fundamentalt förbättrar upplevelsen.

### 🎙️ Presentatörsläge (Live Host View)
En stor-skärms-vy optimerad för att visas på projektor/TV under eventet. Visar live-leaderboard, poänganimationer, uppdragsaktivitet och power-ups som de händer — utan admin-kontroller. Kunder vill ha "spelshow"-känslan.

### ⚡ Realtid via WebSockets
Ersätt polling (3-5 sek) med Supabase Realtime. Teams ser leaderboard-ändringar, power-ups och notiser direkt. Eliminerar "varför uppdateras det inte?"-frustration.

### 🤖 AI-genererade uppdrag
Admin beskriver sitt event/tema ("vår företagshistorik", "cybersäkerhet", "Stockholm") — AI genererar ett komplett uppdragsset med frågor, bilder och svarsalternativ. Radikalt lägre tröskel för custom games.

### 🎯 Parallella uppdrag
Lag kan välja vilka uppdrag de gör och i vilken ordning (inte sekventiellt). Mer strategi, mer variation, kortare köer. Fundamentalt nytt spelläge.

---

## Månad 2-3 — Skalning

Funktioner som driver tillväxt och nya affärsmodeller.

### 🏢 White-label / Varumärkesanpassning
Studio-kunder sätter sin logga, färgpalett och domän. Spelet ser ut som kundens produkt.

### 🗓️ Ligor & återkommande spel
Automatisk liga som kör samma format veckovis/månadsvis med ackumulerade poäng. Perfekt för team-building med kontinuitet.

### 🏪 Uppdragsmarknadsplats
Kunder kan sälja eller dela sina egna uppdragspaket till andra GameOn-kunder. Skapar nätverkseffekter och passiva intäkter.

### 🔌 Webhooks & publikt API
Kunder kopplar GameOn till Slack, Teams, HR-system. Resultat, poäng och events skickas som webhooks. Öppnar enterprise-segment.

### 🌍 Stöd för 500+ spelare simultant
Arkitekturförbättringar (edge functions, connection pooling, rate limiting) för att hantera stora events — konferenser, mässor, 1000-personers kickoffs.

---

## Kvartal 3+ — Nästa nivå

Satsningar som förändrar vad GameOn är.

### 📲 Native app (iOS/Android)
React Native med Expo. Bättre kameraåtkomst för fotouppdrag, push-notiser, offline-support.

### 🎥 Videouppdrag
Lag spelar in korta videoklipp (sångframträdande, sketch, presentation) — AI eller admin bedömer. Extremt delningsbart, viral potential.

### 🤖 AI Game Host
En AI-röst/karaktär som narrerar spelet live — reagerar på poäng, provocerar lag, skapar dramatik. Differentierar GameOn som "spelshow-plattform" snarare än quiz-verktyg.

### 🏆 Turneringsläge
Knockout-bracket eller gruppspel med flera rundor. Lag elimineras, final avgör vinnaren. Passar sportsliga events och konferenser.

---

## Prioriteringsprinciper

1. **Spelupplevelsen först** — allt som gör spelet roligare och smidigare trumfar infra och admin-verktyg
2. **Viral loop** — funktioner som gör att spelare berättar om GameOn (resultatkort, AI host, presentatörsläge)
3. **Intäktsdriven** — funktioner som motiverar uppgradering och förnyelse
4. **Datadrivet** — superadmin-analytics visar vad som funkar → bygg mer av det
