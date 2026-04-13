const { chromium } = require('/Users/signevallin/.npm/_npx/423231821c231c73/node_modules/playwright');
const fs = require('fs');

const screenshotsDir = '/tmp/quiz-debug-screenshots';
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

const BASE_URL = 'http://localhost:4000';
const GAME_KEY = '66GBJR';
const TEAM_NAME = 'playwright';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getButtonStates(page) {
  return await page.evaluate(() => {
    const buttons = document.querySelectorAll('.option-btn');
    return Array.from(buttons).map((btn, i) => ({
      index: i,
      text: btn.textContent.trim().substring(0, 50),
      className: btn.className,
      disabled: btn.disabled,
      hasCorrect: btn.classList.contains('correct'),
      hasWrong: btn.classList.contains('wrong'),
      hasSelected: btn.classList.contains('selected'),
    }));
  });
}

async function logButtonStates(page, label) {
  const states = await getButtonStates(page);
  console.log(`\n--- [${label}] option-btn states (${states.length} buttons) ---`);
  if (states.length === 0) {
    console.log('  (no .option-btn elements found)');
    // Log ALL buttons
    const allBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map((btn, i) => ({
        i, text: btn.textContent.trim().substring(0, 40), cls: btn.className, disabled: btn.disabled
      }))
    );
    console.log('  All buttons:');
    allBtns.forEach(b => console.log(`    [${b.i}] "${b.text}" cls="${b.cls}" disabled=${b.disabled}`));
  } else {
    states.forEach(b => {
      const flags = [
        b.hasCorrect ? 'CORRECT' : '',
        b.hasWrong ? 'WRONG' : '',
        b.hasSelected ? 'SELECTED' : '',
        b.disabled ? 'disabled' : '',
      ].filter(Boolean).join(', ');
      console.log(`  [${b.index}] "${b.text}" | class="${b.className}" | ${flags || 'clean'}`);
    });
  }
  return states;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); // mobile-ish
  const page = await context.newPage();

  page.on('console', msg => {
    if (['error','warn'].includes(msg.type())) console.log(`[PAGE ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  // ── Step 1: Navigate and login ──────────────────────────────────────────
  console.log('\n=== STEP 1: Navigate to app ===');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${screenshotsDir}/01-initial.png` });

  const title = await page.title();
  const url = page.url();
  console.log(`URL: ${url}, Title: ${title}`);

  // Dump HTML to understand structure
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
  console.log('Page text:', bodyText);

  // ── Step 2: Login ───────────────────────────────────────────────────────
  console.log('\n=== STEP 2: Login ===');

  await page.waitForTimeout(500);
  await page.screenshot({ path: `${screenshotsDir}/02-login-screen.png` });

  const inputs = await page.locator('input').count();
  console.log(`Found ${inputs} input(s) on login screen`);

  // The login form has: [0]=team name, [1]=game key
  // Fill team name (first input)
  const teamNameInput = page.locator('input').nth(0);
  await teamNameInput.fill(TEAM_NAME);
  console.log('Filled team name:', TEAM_NAME);

  // Fill game key (second input)
  const gameKeyInput = page.locator('input').nth(1);
  await gameKeyInput.fill(GAME_KEY);
  console.log('Filled game key:', GAME_KEY);

  await page.screenshot({ path: `${screenshotsDir}/03-form-filled.png` });

  // Click JOIN GAME button
  const joinBtn = page.locator('button').filter({ hasText: /join game/i }).first();
  if (await joinBtn.count() > 0) {
    console.log('Clicking JOIN GAME button...');
    await joinBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${screenshotsDir}/04-after-login.png` });
  console.log('After login, URL:', page.url());
  console.log('Page text:', await page.evaluate(() => document.body.innerText.substring(0, 800)));

  // ── Step 3: Find a multi-question quiz ──────────────────────────────────
  console.log('\n=== STEP 3: Find a quiz mission ===');
  await page.waitForTimeout(1000);

  // The categories are <div> elements with onClick - find by text content
  // Look for Music & Film category card
  const categoryDivs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div[style*="cursor: pointer"]')).map((el, i) => ({
      i,
      text: el.textContent.trim().substring(0, 80),
      tag: el.tagName
    }));
  });
  console.log('Clickable divs:', categoryDivs);

  // Click Music & Film category using evaluate+click
  const clickedCategory = await page.evaluate(() => {
    const divs = document.querySelectorAll('div[style*="cursor: pointer"]');
    for (const div of divs) {
      const text = div.textContent || '';
      if (text.includes('Music') || text.includes('🎵')) {
        (div).click();
        return `Clicked: ${text.trim().substring(0, 50)}`;
      }
    }
    // Try any category div
    if (divs.length > 0) {
      (divs[0]).click();
      return `Clicked first: ${(divs[0]).textContent?.trim().substring(0, 50)}`;
    }
    return 'No clickable divs found';
  });
  console.log(clickedCategory);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${screenshotsDir}/07a-category-click.png` });
  console.log('After category click:', await page.evaluate(() => document.body.innerText.substring(0, 600)));

  // Now find mission cards (also <div> with onClick)
  const missionClicked = await page.evaluate(() => {
    const cards = document.querySelectorAll('.mission-card');
    console.log('mission cards found:', cards.length);
    for (const card of cards) {
      const text = card.textContent || '';
      // Look for quiz-type missions
      if (text.match(/celebrity|film quiz|music emoji|image quiz|name that tune/i)) {
        (card).click();
        return `Clicked mission: ${text.trim().substring(0, 60)}`;
      }
    }
    // Click first non-done mission card
    for (const card of cards) {
      if (!card.classList.contains('done')) {
        (card).click();
        return `Clicked first undone mission: ${card.textContent?.trim().substring(0, 60)}`;
      }
    }
    // Click any mission card
    if (cards.length > 0) {
      (cards[0]).click();
      return `Clicked first mission: ${cards[0].textContent?.trim().substring(0, 60)}`;
    }
    return 'No mission cards found';
  });
  console.log(missionClicked);

  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${screenshotsDir}/07-quiz-opened.png` });
  console.log('Quiz page text:', await page.evaluate(() => document.body.innerText.substring(0, 600)));

  // ── Step 4: Play through the quiz, logging button states ────────────────
  console.log('\n=== STEP 4: Play quiz questions ===');

  const MAX_QUESTIONS = 6;

  for (let q = 1; q <= MAX_QUESTIONS; q++) {
    console.log(`\n====== QUESTION ${q} ======`);

    // Wait for option buttons to appear
    try {
      await page.waitForSelector('.option-btn', { timeout: 5000 });
    } catch (e) {
      console.log('No .option-btn found after 5s, checking page state...');
      const text = await page.evaluate(() => document.body.innerText.substring(0, 400));
      console.log('Page text:', text);
      await page.screenshot({ path: `${screenshotsDir}/q${q}-no-buttons.png` });
      break;
    }

    // Log initial state BEFORE clicking
    const statesBefore = await logButtonStates(page, `Q${q} BEFORE click`);
    await page.screenshot({ path: `${screenshotsDir}/q${q}-before-click.png` });

    if (statesBefore.length === 0) {
      console.log('No option buttons found, stopping.');
      break;
    }

    // Click the first option button
    const firstOption = page.locator('.option-btn').first();
    const optionText = await firstOption.textContent();
    console.log(`\nClicking first option: "${optionText?.trim()}"`);
    await firstOption.click();

    // IMMEDIATELY after click - capture state
    await sleep(50);
    const statesImmediate = await logButtonStates(page, `Q${q} IMMEDIATELY after click (50ms)`);
    await page.screenshot({ path: `${screenshotsDir}/q${q}-immediate-after-click.png` });

    // 200ms after click
    await sleep(150);
    const states200 = await logButtonStates(page, `Q${q} 200ms after click`);
    await page.screenshot({ path: `${screenshotsDir}/q${q}-200ms-after-click.png` });

    // 500ms after click
    await sleep(300);
    await logButtonStates(page, `Q${q} 500ms after click`);

    // 800ms after click
    await sleep(300);
    await logButtonStates(page, `Q${q} 800ms after click`);

    // 1050ms after click (just after transition to next question)
    await sleep(250);
    const statesAfterTransition = await logButtonStates(page, `Q${q} ~1050ms after click (next question should appear)`);
    await page.screenshot({ path: `${screenshotsDir}/q${q}-after-transition.png` });

    // Check if we're on the next question (buttons should be clean)
    const bleedDetected = statesAfterTransition.some(b => b.hasCorrect || b.hasWrong || b.hasSelected || b.disabled);
    if (statesAfterTransition.length > 0 && bleedDetected) {
      console.log(`\n!!! BLEED DETECTED on Q${q} -> Q${q+1} transition !!!`);
      statesAfterTransition.forEach(b => {
        if (b.hasCorrect || b.hasWrong || b.hasSelected || b.disabled) {
          console.log(`  BLEEDING: "${b.text}" class="${b.className}" disabled=${b.disabled}`);
        }
      });
    } else if (statesAfterTransition.length > 0) {
      console.log(`\n✓ Clean transition (no bleed detected)`);
    }

    // 1500ms after click (well into next question)
    await sleep(450);
    const statesFinal = await logButtonStates(page, `Q${q} 1500ms after click (settled)`);
    await page.screenshot({ path: `${screenshotsDir}/q${q}-settled.png` });

    const finalBleed = statesFinal.some(b => b.hasCorrect || b.hasWrong || b.hasSelected);
    if (statesFinal.length > 0 && finalBleed) {
      console.log(`\n!!! PERSISTENT BLEED at 1500ms on Q${q} -> Q${q+1} !!!`);
    }

    // Check if the game finished (no more option-btn)
    const hasMoreOptions = await page.locator('.option-btn').count();
    if (hasMoreOptions === 0) {
      console.log('\nNo more option buttons — quiz likely finished or changed screen.');
      await page.screenshot({ path: `${screenshotsDir}/q${q}-finished.png` });
      break;
    }
  }

  console.log('\n=== DONE ===');
  console.log(`Screenshots saved to: ${screenshotsDir}`);
  await browser.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
