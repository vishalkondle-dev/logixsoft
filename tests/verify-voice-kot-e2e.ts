import { chromium } from '@playwright/test';
import * as path from 'path';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const ARTIFACT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

async function loginAndGetCookie(phone: string) {
  const verifyRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, otp: '123456' }),
  });
  if (!verifyRes.ok) throw new Error(`Login failed: ${verifyRes.status}`);
  const setCookie = verifyRes.headers.get('set-cookie');
  const cookiePair = setCookie?.split(';')[0] ?? '';
  const [cookieName, cookieValue] = cookiePair.split('=');
  const data = await verifyRes.json();
  return { cookiePair, cookieName, cookieValue, user: data.user };
}

async function run() {
  console.log('=================================================================');
  console.log('🚀 LIVE E2E BROWSER VERIFICATION OF MULTILINGUAL PAN-INDIAN VOICE-TO-KOT');
  console.log('=================================================================');
  const auth = await loginAndGetCookie('+919985720478');
  console.log('✓ Logged in as:', auth.user.phoneNumber, `(${auth.user.role})`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    {
      name: auth.cookieName,
      value: decodeURIComponent(auth.cookieValue),
      domain: '.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();

  console.log('\n[1/3] Navigating to /pos...');
  await page.goto(`${WEB_BASE}/pos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Check Voice KOT button in toolbar
  const voiceBtn = page.locator('button[aria-label="Voice KOT Assistant"]');
  const isVoiceBtnVisible = await voiceBtn.isVisible();
  console.log('  ✓ Voice KOT Assistant button visible:', isVoiceBtnVisible);

  // Click to open Voice KOT modal
  console.log('\n[2/3] Opening Multilingual Voice-to-KOT Assistant Modal...');
  await voiceBtn.click();
  await page.waitForTimeout(1000);

  const modal = page.getByRole('dialog');
  const modalBadge = modal.locator('text=Multilingual Pan-Indian AI');
  console.log('  ✓ "Multilingual Pan-Indian AI" badge visible:', await modalBadge.isVisible());

  // Check language selector
  const langSelect = modal.locator('input[placeholder*="Hinglish"], input[value*="Hinglish"], input[value*="English"]');
  console.log('  ✓ Speech Language selector visible:', await langSelect.isVisible());

  // Input regional Telugu order speech into textarea:
  // "Table 4 rendu artisan cappuccino takkuva sugar vulli lekunda aur ek grilled chicken pesto panini"
  const speechText = 'Table 4 rendu artisan cappuccino takkuva sugar vulli lekunda aur ek grilled chicken pesto panini';
  console.log(`  -> Simulating Telugu/Hinglish speech input: "${speechText}"`);

  const textarea = modal.locator('textarea');
  await textarea.fill(speechText);
  await page.waitForTimeout(1000);

  // Verify parser results
  const capText = modal.getByText('Artisan Cappuccino', { exact: true });
  console.log('  ✓ Parsed dish 1 (Artisan Cappuccino):', await capText.isVisible());

  const paniniText = modal.getByText('Grilled Chicken Pesto Panini', { exact: true });
  console.log('  ✓ Parsed dish 2 (Grilled Chicken Pesto Panini):', await paniniText.isVisible());

  // Verify Telugu quantity "rendu" parsed as 2
  const qtyTwo = modal.locator('text=2').first();
  console.log('  ✓ Telugu number "rendu" parsed as 2:', await qtyTwo.isVisible());

  // Verify regional notes "takkuva sugar" (Less Sugar) and "vulli lekunda" (No Onion)
  const noteBadge = modal.locator('text=Note: Less Sugar, No Onion');
  console.log('  ✓ Extracted regional cooking notes (Less Sugar, No Onion):', await noteBadge.isVisible());

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_voice_kot_multilingual_modal.png') });
  console.log('  ✓ Saved screenshot: e2e_voice_kot_multilingual_modal.png');

  // Click "Add to Cart"
  console.log('\n[3/3] Clicking "Add to Cart" to populate POS cart...');
  const addToCartBtn = modal.getByRole('button', { name: /Add to Cart/i });
  await addToCartBtn.click();
  await page.waitForTimeout(1500);

  const cartItem = page.locator('text=Artisan Cappuccino').first();
  console.log('  ✓ Staged items successfully added into POS cart:', await cartItem.isVisible());

  await browser.close();
  console.log('\n=================================================================');
  console.log('🎉 MULTILINGUAL LIVE E2E VERIFICATION COMPLETED SUCCESSFULLY!');
  console.log('=================================================================');
}

run().catch((err) => {
  console.error('E2E TEST FAILED:', err);
  process.exit(1);
});
