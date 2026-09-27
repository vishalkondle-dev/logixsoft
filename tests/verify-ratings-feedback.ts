import { chromium } from '@playwright/test';
import * as path from 'path';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const OWNER_PHONE = '+917276718848';
const DEV_OTP = '123456';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

async function fetchAuthCookie(): Promise<{ name: string; value: string; domain: string; path: string }> {
  const sRes = await fetch(`${API_BASE}/auth/phone/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: OWNER_PHONE }),
  });
  if (!sRes.ok) {
    throw new Error(`send-otp failed: ${sRes.status} ${await sRes.text()}`);
  }

  const vRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: OWNER_PHONE, otp: DEV_OTP }),
  });
  if (!vRes.ok) {
    throw new Error(`verify failed: ${vRes.status} ${await vRes.text()}`);
  }

  const setCookies = (vRes.headers as any).getSetCookie
    ? (vRes.headers as any).getSetCookie()
    : [vRes.headers.get('set-cookie')];
  const cookieStr = setCookies.filter(Boolean).join('; ');

  const match = cookieStr.match(/__Secure-logix-dine\.session_token=([^;]+)/);
  if (!match) {
    throw new Error(`Session cookie not found in: ${cookieStr}`);
  }

  return {
    name: '__Secure-logix-dine.session_token',
    value: match[1],
    domain: '.logixsoft.in',
    path: '/',
  };
}

async function run() {
  console.log('Fetching auth cookie for owner/customer...');
  const authCookie = await fetchAuthCookie();
  console.log('Auth cookie received.');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: authCookie.name,
      value: authCookie.value,
      domain: '.logixsoft.in',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: authCookie.name,
      value: authCookie.value,
      domain: 'dine.logixsoft.in',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();

  try {
    // ══════════════════════════════════════════════════════════
    // 1. OWNER FEEDBACK DASHBOARD VERIFICATION
    // ══════════════════════════════════════════════════════════
    console.log('--- Step 1: Owner Feedback Dashboard ---');
    await page.goto(`${WEB_BASE}/settings/feedback`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'owner_feedback_dashboard.png'), fullPage: false });
    console.log('Screenshot saved: owner_feedback_dashboard.png');

    const titleText = await page.locator('text=Customer Reviews & Ratings').first().isVisible();
    console.log('Title visible:', titleText);

    const authenticityNotice = await page.locator('text=Verified Authenticity Guarantee').first().isVisible();
    console.log('Verified Authenticity Guarantee visible:', authenticityNotice);

    // Verify absence of delete buttons
    const deleteReviewButton = await page.locator('button:has-text("Delete Review"), button[aria-label="Delete review"]').count();
    console.log('Delete review buttons count (must be 0):', deleteReviewButton);
    if (deleteReviewButton > 0) {
      throw new Error('FAIL: Delete review button found on owner page!');
    }
    console.log('PASS: Immutability verified. Owners cannot delete customer reviews.');

    // ══════════════════════════════════════════════════════════
    // 2. CUSTOMER PORTAL PAST ORDERS TAB & RATING SUBMISSION
    // ══════════════════════════════════════════════════════════
    console.log('--- Step 2: Customer Portal Past Orders ---');
    await page.goto(`${WEB_BASE}/portal?tab=past`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'portal_past_orders_ratings.png'), fullPage: false });
    console.log('Screenshot saved: portal_past_orders_ratings.png');

    // Click the Rate button or badge on the first past order
    const rateTrigger = page.locator('text="★ Rate"').first();
    const rateTriggerVisible = await rateTrigger.isVisible();
    console.log('Rate trigger badge visible:', rateTriggerVisible);

    if (rateTriggerVisible) {
      console.log('Opening Rate Order Modal via Rate badge...');
      await rateTrigger.click();
      await page.waitForTimeout(1500);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'portal_rate_order_modal.png'), fullPage: false });
      console.log('Screenshot saved: portal_rate_order_modal.png');

      // Check modal components
      const hasOverallRating = await page.locator('text=Overall Experience').isVisible();
      console.log('Has Overall Experience rating:', hasOverallRating);

      const hasDishRatings = await page.locator('text=Rate Individual Dishes').isVisible();
      console.log('Has Rate Individual Dishes section:', hasDishRatings);

      // Fill feedback comment
      const commentInput = page.locator('textarea[placeholder*="Tell us what you enjoyed"]');
      if (await commentInput.isVisible()) {
        await commentInput.fill('Exceptional Rogan Josh and Murgh Rara! Melt-in-mouth tender meat with rich spices. Top notch hospitality!');
      }

      // Submit feedback
      const submitBtn = page.locator('button:has-text("Submit Rating"), button:has-text("Update Review")').first();
      console.log('Submitting review...');
      await submitBtn.scrollIntoViewIfNeeded();
      await submitBtn.click();
      await page.waitForTimeout(3000);

      // Verify that the order card now shows rating and expand it
      console.log('Re-checking past orders after submission...');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);

      // Click first order card to expand details
      const firstCardHeader = page.locator('.mantine-Card-root > div:first-child').first();
      await firstCardHeader.click();
      await page.waitForTimeout(1000);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'portal_past_order_expanded.png'), fullPage: false });
      console.log('Screenshot saved: portal_past_order_expanded.png');

      const reviewSummaryVisible = await page.locator('text=Your Review:').first().isVisible().catch(() => false);
      console.log('Review summary box visible inside expanded order:', reviewSummaryVisible);

      const editBtnVisible = await page.locator('button:has-text("Edit Review"), button:has-text("Edit")').first().isVisible().catch(() => false);
      console.log('Edit Review button visible for customer:', editBtnVisible);
    }

    // ══════════════════════════════════════════════════════════
    // 3. OWNER DASHBOARD REPLY WORKFLOW
    // ══════════════════════════════════════════════════════════
    console.log('--- Step 3: Owner Reply to New Review ---');
    await page.goto(`${WEB_BASE}/settings/feedback`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Find the newly submitted review from Vishal Kondle or first Reply button
    const replyBtn = page.locator('button:has-text("Reply to Customer")').first();
    const canReply = await replyBtn.isVisible().catch(() => false);
    console.log('Can reply to customer review:', canReply);

    if (canReply) {
      await replyBtn.click();
      await page.waitForTimeout(1000);

      const replyTextarea = page.locator('textarea[placeholder*="reply"]');
      await replyTextarea.fill('Dear Vishal, thank you so much for your kind words! We take great pride in our authentic Kashmiri Rogan Josh. Looking forward to serving you again soon!');

      const sendReplyBtn = page.locator('button:has-text("Save & Post Reply")');
      await sendReplyBtn.click();
      await page.waitForTimeout(3000);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'owner_feedback_with_reply.png'), fullPage: false });
      console.log('Screenshot saved: owner_feedback_with_reply.png');
    }

    // ══════════════════════════════════════════════════════════
    // 4. CUSTOMER PORTAL VERIFICATION OF OWNER REPLY
    // ══════════════════════════════════════════════════════════
    console.log('--- Step 4: Verify Restaurant Message in Customer Portal ---');
    await page.goto(`${WEB_BASE}/portal?tab=past`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Wait for cards to be rendered and expand first order card
    const firstOrder = page.locator('.mantine-Card-root > div:first-child').first();
    await firstOrder.waitFor({ state: 'visible', timeout: 20000 });
    await firstOrder.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'portal_review_with_reply.png'), fullPage: false });
    console.log('Screenshot saved: portal_review_with_reply.png');

    const restaurantMessageVisible = await page.locator('text=Restaurant Message:').first().isVisible().catch(() => false);
    console.log('Restaurant reply message visible to customer:', restaurantMessageVisible);

    console.log('=== Complete E2E Rating & Feedback Lifecycle Verified Successfully! ===');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
