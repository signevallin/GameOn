const { chromium } = require('/Users/signevallin/.npm/_npx/423231821c231c73/node_modules/playwright');
const fs = require('fs');
const path = require('path');

// Create screenshots dir
const screenshotsDir = '/tmp/quiz-debug-screenshots';
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function captureButtonStates(page, label) {
  const result = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    const relevant = [];
    buttons.forEach((btn, i) => {
      const text = btn.textContent.trim().substring(0, 60);
      const className = btn.className;
      const disabled = btn.disabled;
      const hasCorrect = className.includes('correct');
      const hasWrong = className.includes('wrong');
      const hasSelected = className.includes('selected');
      const hasBg = /bg-(green|red|yellow|orange|blue|purple|gray|slate|zinc|neutral)/.test(className);
      // Only include answer-like buttons (not nav, not settings)
      if (text && (hasCorrect || hasWrong || hasSelected || hasBg || disabled || className.includes('option') || className.includes('answer') || className.includes('choice'))) {
        relevant.push({ index: i, text, className, disabled, hasCorrect, hasWrong, hasSelected });
      }
    });
    return relevant;
  });
  console.log(`\n=== Button states [${label}] ===`);
  if (result.length === 0) {
    // Also dump ALL buttons for debugging
    const allBtns = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      return Array.from(buttons).map((btn, i) => ({
        index: i,
        text: btn.textContent.trim().substring(0, 60),
        className: btn.className,
        disabled: btn.disabled
      }));
    });
    console.log('No answer-like buttons found. All buttons:');
    allBtns.forEach(b => console.log(`  [${b.index}] "${b.text}" | class="${b.className}" | disabled=${b.disabled}`));
  } else {
    result.forEach(b => {
      console.log(`  [${b.index}] "${b.text}" | class="${b.className}" | disabled=${b.disabled} | correct=${b.hasCorrect} | wrong=${b.hasWrong} | selected=${b.hasSelected}`);
    });
  }
  return result;
}

async function captureAllButtonStates(page, label) {
  const result = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    return Array.from(buttons).map((btn, i) => ({
      index: i,
      text: btn.textContent.trim().substring(0, 60),
      className: btn.className,
      disabled: btn.disabled,
      style: btn.getAttribute('style') || '',
      dataAttrs: Array.from(btn.attributes)
        .filter(a => a.name.startsWith('data-'))
        .map(a => `${a.name}=${a.value}`)
        .join(', ')
    }));
  });
  console.log(`\n=== ALL Button states [${label}] ===`);
  result.forEach(b => {
    console.log(`  [${b.index}] "${b.text}" | class="${b.className}" | disabled=${b.disabled} | style="${b.style}" | data={${b.dataAttrs}}`);
  });
  return result;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    slowMo: 50,
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Capture console logs from the page
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`PAGE ERROR: ${msg.text()}`);
  });

  console.log('=== Step 1: Navigate to game ===');
  await page.goto('https://game-on-seven.vercel.app');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${screenshotsDir}/01-homepage.png` });
  console.log('Screenshot: 01-homepage.png');

  // Find game key input and enter it
  console.log('\n=== Step 2: Enter game key 66GBJR ===');
  await page.waitForTimeout(1000);

  // Look for game key input
  const inputs = await page.locator('input').all();
  console.log(`Found ${inputs.length} inputs on page`);

  // Try to find the game key field
  let gameKeyInput = page.locator('input[placeholder*="game" i]').first();
  if (!(await gameKeyInput.count())) {
    gameKeyInput = page.locator('input[placeholder*="key" i]').first();
  }
  if (!(await gameKeyInput.count())) {
    gameKeyInput = page.locator('input').first();
  }

  await gameKeyInput.fill('66GBJR');
  await page.screenshot({ path: `${screenshotsDir}/02-game-key-entered.png` });
  console.log('Screenshot: 02-game-key-entered.png');

  // Submit game key
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${screenshotsDir}/03-after-game-key.png` });
  console.log('Screenshot: 03-after-game-key.png');

  // Check current URL and page state
  console.log(`Current URL: ${page.url()}`);
  const pageTitle = await page.title();
  console.log(`Page title: ${pageTitle}`);

  // Look for team name input
  console.log('\n=== Step 3: Enter team name ===');
  await page.waitForTimeout(1000);

  let teamInput = page.locator('input[placeholder*="team" i]').first();
  if (!(await teamInput.count())) {
    teamInput = page.locator('input[placeholder*="name" i]').first();
  }
  if (!(await teamInput.count())) {
    teamInput = page.locator('input').first();
  }

  if (await teamInput.count()) {
    await teamInput.fill('playwright');
    await page.screenshot({ path: `${screenshotsDir}/04-team-name-entered.png` });
    console.log('Screenshot: 04-team-name-entered.png');

    // Submit
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: `${screenshotsDir}/05-after-team-name.png` });
  console.log('Screenshot: 05-after-team-name.png');
  console.log(`Current URL: ${page.url()}`);

  // Check for join/submit buttons
  const joinButtons = await page.locator('button').all();
  console.log(`\nFound ${joinButtons.length} buttons on page`);
  for (const btn of joinButtons) {
    const text = await btn.textContent();
    const visible = await btn.isVisible();
    if (visible) console.log(`  Visible button: "${text?.trim()}"`);
  }

  // Try clicking a join/submit/enter button if we see one
  const joinBtn = page.locator('button:has-text("Join"), button:has-text("Enter"), button:has-text("Submit"), button:has-text("Start"), button:has-text("Play")').first();
  if (await joinBtn.count() > 0) {
    console.log('\nClicking join/submit button...');
    await joinBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${screenshotsDir}/06-after-join.png` });
    console.log('Screenshot: 06-after-join.png');
  }

  console.log(`\nCurrent URL: ${page.url()}`);

  // Now look for mission/quiz cards on the lobby/dashboard
  console.log('\n=== Step 4: Look for quiz missions ===');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${screenshotsDir}/07-lobby.png` });
  console.log('Screenshot: 07-lobby.png');

  // Find quiz missions - look for Film Quiz, Name That Tune, etc.
  const quizMissions = await page.locator('text=/Film Quiz|Name That Tune|Celebrity|Music|Image Quiz|🍿|🎧|🎵/i').all();
  console.log(`Found ${quizMissions.length} quiz mission elements`);

  if (quizMissions.length === 0) {
    // Try generic mission/card selectors
    const cards = await page.locator('[class*="mission"], [class*="card"], [class*="game"]').all();
    console.log(`Found ${cards.length} mission/card elements`);

    // Take a full page screenshot and dump page text
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log('\nPage text preview:\n' + pageText);
  }

  // Click the first quiz mission we find
  const missionBtn = page.locator('button, [role="button"], div[class*="mission"]').filter({ hasText: /Film Quiz|Name That Tune|Celebrity Quiz|Music Emoji|Image Quiz/i }).first();

  if (await missionBtn.count() > 0) {
    console.log('\nFound and clicking quiz mission...');
    await missionBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${screenshotsDir}/08-quiz-opened.png` });
    console.log('Screenshot: 08-quiz-opened.png');
  } else {
    // Click the first clickable mission
    console.log('\nNo specific quiz found, trying first mission...');
    const firstMission = page.locator('button, [role="button"]').filter({ hasText: /quiz|tune|music|celeb|emoji/i }).first();
    if (await firstMission.count() > 0) {
      await firstMission.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotsDir}/08-quiz-opened.png` });
    }
  }

  console.log(`\nCurrent URL: ${page.url()}`);

  // Now we should be in a quiz - look for answer buttons
  console.log('\n=== Step 5: Quiz interaction - looking for answer buttons ===');
  await page.waitForTimeout(1000);

  // Dump ALL page content to understand the structure
  const pageHTML = await page.evaluate(() => {
    return document.body.innerHTML.substring(0, 5000);
  });
  console.log('\nPage HTML preview (first 5000 chars):');
  console.log(pageHTML);

  await page.screenshot({ path: `${screenshotsDir}/09-quiz-state.png` });

  // Try to find answer buttons - quiz typically has A/B/C/D or numbered options
  const answerSelectors = [
    'button[class*="option"]',
    'button[class*="answer"]',
    'button[class*="choice"]',
    '[class*="option-button"]',
    '[class*="answer-button"]'
  ];

  let answerButtons = [];
  for (const sel of answerSelectors) {
    const found = await page.locator(sel).all();
    if (found.length > 0) {
      console.log(`Found ${found.length} answer buttons with selector: ${sel}`);
      answerButtons = found;
      break;
    }
  }

  if (answerButtons.length === 0) {
    console.log('\nNo answer buttons found with specific selectors. Dumping all visible buttons:');
    await captureAllButtonStates(page, 'before answer click');
  }

  console.log('\nFull page text:');
  const fullText = await page.evaluate(() => document.body.innerText);
  console.log(fullText.substring(0, 3000));

  await browser.close();
  console.log('\n=== Debug complete. Screenshots saved to: ' + screenshotsDir + ' ===');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
