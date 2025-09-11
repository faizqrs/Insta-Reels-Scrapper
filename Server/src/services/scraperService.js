require('dotenv').config();
const { chromium } = require('playwright');
const logger = require('../utils/logger');

async function ensureLoggedIn(context) {
  const page = await context.newPage();
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle', timeout: 60000 });

  await page.fill('input[name="username"]', process.env.INSTA_USERNAME);
  await page.fill('input[name="password"]', process.env.INSTA_PASSWORD);

  try {
    await Promise.all([
      page.click('button[type="submit"]'),
      Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }),
        page.waitForSelector('nav', { timeout: 60000 }), // Successful login indicator
        page.waitForSelector('text=Sorry, your password was incorrect', { timeout: 60000 }), // Login failure indicator
      ]),
    ]);
  } catch (error) {
    await page.screenshot({ path: `login_error_${Date.now()}.png` }).catch(() => {});
    await page.close();
    throw new Error('Instagram login navigation failed or timed out');
  }

  const isLoggedIn = (await page.locator('nav').count()) > 0;
  if (!isLoggedIn) {
    await page.close();
    throw new Error('Instagram login failed: Incorrect credentials or login blocked');
  }

  await page.close();
}

async function scrapeSingleReel(url, context) {
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    const id = url.split('/reel/')[1].replace('/', '');

    await page.waitForSelector('video, img', { timeout: 30000 });

    const video_url = await page.$eval('video', (el) => el.src).catch(() => null);

    const thumbnail_url = await page
      .$eval('meta[property="og:image"]', (el) => el.content)
      .catch(async () => {
        return await page.$eval('video', (el) => el.poster).catch(() => null);
      });

    let caption = await page.$eval('div[role="button"] span', (el) => el.textContent).catch(() => '');
    if (!caption) {
      caption = await page.$eval('section > div > div > div > span', (el) => el.textContent).catch(() => '');
    }

    const posted_at = await page.$eval('time', (el) => el.getAttribute('datetime')).catch(() => '');

    let views = '';
    try {
      const spanHandles = await page.$$('section span');
      for (const span of spanHandles) {
        const text = await span.innerText();
        if (text.toLowerCase().includes('views')) {
          views = text;
          break;
        }
      }
    } catch {
      views = '';
    }

    const likes = null;

    let comments = [];
    try {
      const commentElements = await page.$$('ul > li');
      for (const element of commentElements) {
        const commentText = await element.innerText();
        if (commentText.trim()) comments.push(commentText.trim());
      }
    } catch {
      comments = [];
    }

    await page.close();

    return {
      id,
      reel_url: url,
      video_url,
      thumbnail_url,
      caption,
      posted_at,
      views,
      likes,
      comments_count: comments.length,
      comments,
    };
  } catch (error) {
    await page.screenshot({ path: `error_${Date.now()}.png` }).catch(() => {});
    await page.close();
    logger.error(`Failed scraping reel ${url}: ${error.message}`);
    return { reel_url: url, error: 'Failed to scrape this reel' };
  }
}

async function scrapeReels(username, limit = 5, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
      timezoneId: 'Asia/Kolkata',
    });

    try {
      await ensureLoggedIn(context);

      const page = await context.newPage();
      await page.goto(`https://www.instagram.com/${username}/`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      if (await page.locator("text=Sorry, this page isn't available.").count()) {
        await page.screenshot({ path: `${username}_not_found.png` }).catch(() => {});
        throw Object.assign(new Error('User not found'), { status: 404 });
      }

      if (await page.locator("text=This Account is Private").count()) {
        await page.screenshot({ path: `${username}_private.png` }).catch(() => {});
        throw Object.assign(new Error('User profile is private.'), { status: 403 });
      }

      if (await page.locator("text=Log in to see").count()) {
        await page.screenshot({ path: `${username}_login_required.png` }).catch(() => {});
        throw Object.assign(new Error('Login required to view this profile.'), { status: 403 });
      }

      try {
        await page.waitForSelector("a[href*='/reel/']", { timeout: 20000 });
      } catch (e) {
        await page.screenshot({ path: `${username}_no_reels.png` }).catch(() => {});
        throw Object.assign(new Error('No reels found on this profile.'), { status: 404 });
      }

      let reelUrls = await page.$$eval("a[href*='/reel/']", (links) => links.map((el) => el.href));
      reelUrls = reelUrls.slice(0, limit);

      const results = await Promise.allSettled(reelUrls.map((url) => scrapeSingleReel(url, context)));

      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      logger.info(`Scraped ${successCount} reels from ${username} (Attempt ${attempt + 1})`);

      await browser.close();
      return results.map((r) => (r.status === 'fulfilled' ? r.value : { error: 'Failed to scrape this reel' }));
    } catch (error) {
      await browser.close();
      attempt++;
      logger.error(`Attempt ${attempt} failed for ${username}: ${error.message}`);

      if (attempt >= maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
    }
  }
}

module.exports = { scrapeReels };
