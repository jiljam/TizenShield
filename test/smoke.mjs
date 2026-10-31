// End-to-end check in desktop Chromium: builds a test bundle, serves the start
// page and a fake website on two origins, injects the script into every page
// the way TizenBrew does, and drives everything with the desktop key
// stand-ins (Esc = Back, F1-F4 = Red/Green/Yellow/Blue).
//
//   npm run smoke    (needs Playwright: npm i -D playwright, or a global install)
// Screenshots land in test/out/.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'test/out');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split(/[?#]/)[0])).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, path));
    const headers = { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' };
    // Simulates sites whose security policy blocks injected <style> tags.
    if (req.url.includes('csp=1')) headers['Content-Security-Policy'] = "style-src 'none'";
    res.writeHead(200, headers).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;

const START = `http://localhost:${port}/test/out/start.html`;
const SITE = `http://127.0.0.1:${port}/test/fixtures/site.html`;

execFileSync('node', ['build.mjs', '--start-url', START, '--outdir', 'test/out'], { cwd: ROOT, stdio: 'inherit' });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
await context.addInitScript({ path: join(OUT, 'userScript.js') });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

const step = (name) => console.log('- ' + name);
const active = () => page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.textContent.trim()));
const hidden = (selector) => page.evaluate((s) => getComputedStyle(document.querySelector(s)).display === 'none', selector);

try {
  step('start page renders default bookmarks with the search box focused');
  await page.goto(START);
  await page.waitForSelector('#ts-launcher');
  assert.equal(await page.locator('.ts-tile').count(), 3);
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'INPUT');
  assert.equal(await page.evaluate(() => document.querySelectorAll('#ts-launcher').length), 1, 'script ran twice');
  await page.screenshot({ path: join(OUT, 'launcher.png') });

  step('arrows move from the search box to the bookmark tiles');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'ts-tile');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('data-title')), 'DuckDuckGo Lite');
  await page.keyboard.press('ArrowUp');

  step('typing an address opens it and records it in history');
  await page.keyboard.press('Enter');
  await page.keyboard.type(`127.0.0.1:${port}/test/fixtures/site.html`);
  await page.keyboard.press('Enter');
  await page.waitForURL(SITE);
  await page.waitForSelector('#tizenshield-toolbar', { state: 'attached' });

  step('ads are hidden, content is not');
  assert.equal(await hidden('ins.adsbygoogle'), true);
  assert.equal(await hidden('#div-gpt-ad-123'), true);
  assert.equal(await hidden('.ad-container'), true);
  assert.equal(await hidden('#content'), false);

  step('arrows focus links with a visible ring despite the site removing outlines');
  await page.keyboard.press('ArrowDown');
  assert.equal(await active(), 'first');
  assert.match(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), /solid/);
  await page.keyboard.press('ArrowRight');
  assert.equal(await active(), 'News');
  await page.screenshot({ path: join(OUT, 'site-focus.png') });

  step('Down past the last link scrolls the page');
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowDown');
  assert.ok(await page.evaluate(() => window.scrollY > 0));

  step('Green opens the toolbar, arrows stay inside it, Back closes it');
  await page.keyboard.press('F2');
  assert.equal(await page.locator('#tizenshield-toolbar').isVisible(), true);
  assert.equal(await page.inputValue('#tizenshield-toolbar input'), SITE);
  await page.keyboard.press('ArrowDown');
  assert.equal(await active(), 'Back');
  await page.keyboard.press('ArrowRight');
  assert.equal(await active(), 'Forward');
  await page.screenshot({ path: join(OUT, 'toolbar.png') });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#tizenshield-toolbar').isVisible(), false);

  step('Yellow bookmarks the page and comes back to it');
  await page.keyboard.press('F3');
  await page.waitForURL(/start\.html#add=/);
  await page.waitForURL(SITE);

  step('links open with Enter; Back returns');
  await page.evaluate(() => document.getElementById('first').focus());
  await page.keyboard.press('Enter');
  await page.waitForURL(/page2\.html$/);
  await page.keyboard.press('Escape');
  await page.waitForURL(SITE);

  step('toolbar address bar searches through the start page');
  await page.waitForSelector('#tizenshield-toolbar', { state: 'attached' });
  await page.keyboard.press('F2');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+A');
  await page.keyboard.type(`127.0.0.1:${port}/test/fixtures/page2.html`);
  await page.keyboard.press('Enter');
  await page.waitForURL(/page2\.html$/);

  step('Red goes home, where the new bookmark and history show up');
  await page.waitForSelector('#tizenshield-toolbar', { state: 'attached' });
  await page.keyboard.press('F1');
  await page.waitForSelector('#ts-launcher');
  assert.equal(await page.locator('.ts-tile').count(), 4);
  assert.equal(await page.locator('.ts-tile').first().getAttribute('data-title'), 'Fixture Site');
  assert.equal(await page.locator('.ts-recent a').count(), 2);

  step('Yellow twice removes the focused bookmark');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('F3');
  await page.keyboard.press('F3');
  assert.equal(await page.locator('.ts-tile').count(), 3);

  step('a request to open a non-web address is refused');
  // From another page: a hash-only change on the start page itself wouldn't reload it.
  await page.goto(SITE);
  await page.goto(START + '#go=' + encodeURIComponent('file:///etc/passwd'));
  await page.waitForSelector('#ts-launcher');
  assert.equal(page.url(), START);

  step('on a site whose policy blocks <style>, ads are hidden by script and the toolbar still works');
  await page.goto(SITE + '?csp=1');
  await page.waitForSelector('#tizenshield-toolbar', { state: 'attached' });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.ad-container')).display === 'none');
  await page.keyboard.press('F2');
  assert.equal(await page.locator('#tizenshield-toolbar').isVisible(), true);
  await page.screenshot({ path: join(OUT, 'toolbar-csp.png') });

  assert.deepEqual(errors, [], 'page errors');
  console.log('Smoke test passed. Screenshots in test/out/.');
} finally {
  await browser.close();
  server.close();
}
