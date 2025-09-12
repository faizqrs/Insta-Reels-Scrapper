const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('../utils/logger');

puppeteer.use(StealthPlugin());

async function scrapeSingleReel(url, browser) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const id = url.split('/reel/')[1].replace('/', '');

    await page.waitForSelector('video, img', { timeout: 15000 });

    // Video URL
    const video_url = await page.$eval('video', el => el.src).catch(() => null);

    // Thumbnail URL with OG meta fallback
    const thumbnail_url = await page.$eval('meta[property="og:image"]', el => el.content).catch(async () => {
      return await page.$eval('video', el => el.poster).catch(() => null);
    });

    // Caption extraction with double fallback
    let caption = await page.$eval('div[role="button"] span', el => el.textContent.trim()).catch(() => '');
    if (!caption) {
      caption = await page.$eval('section > div > div > div > span', el => el.textContent.trim()).catch(() => '');
    }

    // Posted date
    const posted_at = await page.$eval('time', el => el.getAttribute('datetime')).catch(() => '');

    // Views extraction
    let views = '';
    try {
      views = await page.$eval('section div span', el => el.innerText).catch(() => '');
      if (!views.toLowerCase().includes('views')) {
        const spanTexts = await page.$$eval('section span', els => els.map(el => el.innerText));
        views = spanTexts.find(t => t.toLowerCase().includes('views')) || '';
      }
    } catch {
      views = '';
    }

    // Likes extraction
    let likes = null;
    try {
      likes = await page.$eval('section button span', el => el.innerText).catch(() => null);
      if (likes && isNaN(Number(likes.replace(/,/g, '')))) likes = null;
    } catch {
      likes = null;
    }

    // Comments extraction
    let comments = [];
    try {
      const commentEls = await page.$$('ul > li');
      for (const el of commentEls) {
        const commentText = await page.evaluate(el => el.innerText.trim(), el);
        if (commentText) comments.push(commentText);
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
    await page.close();
    logger.error(`Failed scraping reel ${url}: ${error.message}`);
    return { reel_url: url, error: 'Failed to scrape this reel' };
  }
}

async function scrapeReels(username, limit = 10) {
  const safeLimit = Math.min(parseInt(limit, 10) || 10, 50);
  const browser = await puppeteer.launch({ headless: true });

  try {
    const page = await browser.newPage();

    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    const userNotFound = await page.evaluate(() =>
      document.body.innerText.includes("Sorry, this page isn't available.")
    );
    if (userNotFound) {
      const err = new Error('User not found or profile is private');
      err.status = 404;
      throw err;
    }

    try {
      await page.waitForSelector("a[href*='/reel/']", { timeout: 15000 });
    } catch (e) {
      const err = new Error('No reels found or profile is private');
      err.status = 404;
      throw err;
    }

    let reelUrls = await page.$$eval("a[href*='/reel/']", els =>
      Array.from(new Set(els.map(a => a.href)))
    );
    reelUrls = reelUrls.slice(0, safeLimit);

    await page.close();

    const results = await Promise.allSettled(
      reelUrls.map(url => scrapeSingleReel(url, browser))
    );

    return results.map(r => (r.status === 'fulfilled' ? r.value : { error: 'Failed to scrape this reel' }));
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeReels };
