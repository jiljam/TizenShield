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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.webm': 'video/webm' };

const server = createServer(async (req, res) => {
  // A request that never gets an answer during the test, like a stuck API.
  if (req.url.startsWith('/api/slow')) {
    const timer = setTimeout(() => res.writeHead(200).end('late'), 120000);
    res.on('close', () => clearTimeout(timer));
    return;
  }
  const path = normalize(decodeURIComponent(req.url.split(/[?#]/)[0])).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, path));
    const headers = { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
    // Simulates sites whose security policy blocks injected <style> tags.
    if (req.url.includes('csp=1')) headers['Content-Security-Policy'] = "style-src 'none'";
    // Range requests, like real video hosts: browsers can't seek without them.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? Number(range[1]) : body.length - Number(range[2]);
      const end = range[1] && range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
      headers['Content-Range'] = `bytes ${start}-${end}/${body.length}`;
      res.writeHead(206, headers).end(body.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, headers).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;

const START = `http://localhost:${port}/test/out/start.html`;
const SITE = `http://127.0.0.1:${port}/test/fixtures/site.html`;
const VIDEOS = `http://127.0.0.1:${port}/test/fixtures/videos.html`;
const CLIP = `http://127.0.0.1:${port}/test/out/clip.webm`;

execFileSync('node', ['build.mjs', '--start-url', START, '--outdir', 'test/out'], { cwd: ROOT, stdio: 'inherit' });
await mkdir(OUT, { recursive: true });
// A 3-minute VP8 clip (desktop Chromium has no H.264): long enough to test seeking and resume.
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=180:size=640x360:rate=24',
  '-c:v', 'libvpx', '-b:v', '400k', '-deadline', 'realtime', '-cpu-used', '8', join(OUT, 'clip.webm')]);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
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

  const player = {
    time: () => page.evaluate(() => document.querySelector('.ts-video').currentTime),
    paused: () => page.evaluate(() => document.querySelector('.ts-video').paused),
    hasClass: (name) => page.evaluate((n) => document.querySelector('.ts-player').classList.contains(n), name),
    waitPlaying: (min) => page.waitForFunction((m) => {
      const v = document.querySelector('.ts-video');
      return v && !v.paused && v.currentTime > m;
    }, min)
  };

  step('video page: toolbar offers "Play on TV player (2)" first, highlighted');
  await page.goto(VIDEOS);
  await page.waitForSelector('#tizenshield-toolbar', { state: 'attached' });
  await page.keyboard.press('F2');
  await page.keyboard.press('ArrowDown');
  assert.equal(await active(), 'Play on TV player (2)');
  await page.screenshot({ path: join(OUT, 'toolbar-video.png') });

  step('it opens a chooser listing both videos, titled from the link text');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#tizenshield-picker', { state: 'visible' });
  const items = await page.locator('#tizenshield-picker button').allTextContents();
  assert.deepEqual(items.map((t) => t.replace(/WEBM.*/, '')), ['Sample clip', 'Broken video']);
  await page.screenshot({ path: join(OUT, 'picker.png') });

  step('choosing one plays it full screen on the start page');
  await page.keyboard.press('Enter');
  await page.waitForURL(/start\.html#play=/);
  await player.waitPlaying(0.5);
  assert.equal(await page.textContent('.ts-p-title'), 'Sample clip');
  await page.screenshot({ path: join(OUT, 'player.png') });

  step('Right twice is batched into one +60 s seek; OK pauses');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('.ts-video').currentTime > 59);
  await page.keyboard.press('Enter');
  assert.equal(await player.paused(), true);
  await page.screenshot({ path: join(OUT, 'player-paused.png') });

  step('Back closes the player and returns to the page');
  await page.keyboard.press('Escape');
  await page.waitForURL(VIDEOS);

  step('the Play key reopens it, resuming where it stopped');
  await page.waitForSelector('#tizenshield-toolbar', { state: 'attached' });
  await page.keyboard.press('MediaPlayPause');
  await page.waitForSelector('#tizenshield-picker', { state: 'visible' });
  await page.keyboard.press('Enter');
  await page.waitForURL(/start\.html#play=/);
  await player.waitPlaying(59);

  step('Back while playing hides the controls first, then closes');
  await page.keyboard.press('Escape');
  assert.equal(await player.hasClass('ts-p-idle'), true);
  await page.keyboard.press('Escape');
  await page.waitForURL(VIDEOS);

  step('OK on a broken video link shows a clear error with Try again / Back');
  await page.waitForSelector('#tizenshield-toolbar', { state: 'attached' });
  await page.evaluate(() => document.getElementById('missing').focus());
  await page.keyboard.press('Enter');
  await page.waitForSelector('.ts-p-failed');
  assert.match(await page.textContent('.ts-p-error'), /can't play on the TV/);
  assert.equal(await active(), 'Try again');
  await page.screenshot({ path: join(OUT, 'player-error.png') });
  await page.keyboard.press('Escape');
  await page.waitForURL(VIDEOS);

  step('a video address typed on the start page plays; Back returns home and frees the player');
  await page.goto(START);
  await page.waitForSelector('#ts-launcher');
  await page.keyboard.press('Enter');
  await page.keyboard.type(CLIP);
  await page.keyboard.press('Enter');
  await player.waitPlaying(1);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#ts-launcher');
  assert.equal(await page.locator('video').count(), 0);
  // History is per address: replaying the clip by URL retitles its entry from the file name.
  assert.equal((await page.locator('.ts-recent a').first().textContent()).indexOf('Video: clip'), 0);

  assert.deepEqual(errors, [], 'page errors');

  // A second browser that behaves like the 2017 TV engine for these
  // features: they're removed before TizenShield loads, so its polyfills
  // must bring them back.
  const oldEngine = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await oldEngine.addInitScript(() => {
    [
      [Object, 'entries'], [Object, 'values'], [Object, 'fromEntries'], [Array.prototype, 'flat'],
      [Array.prototype, 'flatMap'], [String.prototype, 'padStart'], [String.prototype, 'padEnd'],
      [Promise.prototype, 'finally'], [window, 'URLSearchParams'], [URL.prototype, 'searchParams'],
      [NodeList.prototype, 'forEach'], [Element.prototype, 'append'], [Element.prototype, 'prepend'],
      [Document.prototype, 'append'], [DocumentFragment.prototype, 'append'], [window, 'AbortController'],
      [window, 'AbortSignal'], [window, 'IntersectionObserver'], [window, 'IntersectionObserverEntry'],
      [window, 'ResizeObserver'], [KeyboardEvent.prototype, 'key']
      // globalThis stays: Playwright itself needs it to run page.evaluate().
    ].forEach(([owner, name]) => { delete owner[name]; });
  });
  await oldEngine.addInitScript({ path: join(OUT, 'userScript.js') });
  const old = await oldEngine.newPage();
  const oldErrors = [];
  old.on('pageerror', (error) => oldErrors.push(error.message));
  const MODERN = `http://127.0.0.1:${port}/test/fixtures/modern-apis.html`;
  const fixture = (name) => `http://127.0.0.1:${port}/test/fixtures/${name}.html`;
  const compatPanel = () => old.locator('#tizenshield-compat');

  step('old engine: a site needing 10 newer features works with TV fixes on');
  await old.goto(MODERN);
  const results = await old.evaluate(() => window.results);
  assert.deepEqual(Object.values(results).filter((r) => r !== true), [], JSON.stringify(results));
  const fixes = await old.evaluate(() => window.__tizenShieldFixes);
  ['IntersectionObserver', 'ResizeObserver', 'KeyboardEvent.key', 'URLSearchParams', 'Object.entries'].forEach((name) => {
    assert.ok(fixes.includes(name), name + ' should be added');
  });

  step('old engine: lazy loading (IntersectionObserver) fires only once the section scrolls into view');
  await old.waitForTimeout(400);
  assert.equal(await old.getAttribute('#lazy', 'data-state'), 'waiting');
  await old.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await old.waitForFunction(() => document.getElementById('lazy').getAttribute('data-state') === 'loaded');

  step('old engine: ResizeObserver reports size changes; pages see event.key for remote keys');
  await old.waitForFunction(() => document.body.getAttribute('data-box-width') === '250');
  await old.keyboard.press('Enter');
  assert.equal(await old.getAttribute('body', 'data-key'), 'Enter');

  step('a working page gets no compatibility notice');
  await old.waitForTimeout(3200);
  assert.equal(await compatPanel().isVisible(), false);

  step('"TV fixes: off" turns the polyfills off for that site');
  await old.evaluate(() => localStorage.setItem('tizenshield:polyfills-off', '1'));
  await old.reload();
  // Primitives only: Playwright's own object passing needs the removed features.
  assert.equal(await old.evaluate(() => window.__tizenShieldFixes.length), 0);
  assert.match(await old.evaluate(() => String(window.results['Object.entries'])), /error/);
  await old.evaluate(() => localStorage.removeItem('tizenshield:polyfills-off'));
  oldErrors.length = 0;

  const expectNotice = async (name, reason, shot) => {
    await old.goto(fixture(name));
    await compatPanel().waitFor({ state: 'visible', timeout: 10000 });
    assert.match(await compatPanel().textContent(), /can't run on your TV's browser/);
    assert.match(await compatPanel().textContent(), reason);
    if (shot) await old.screenshot({ path: join(OUT, shot) });
  };

  step('module-only app: explains that 2017 TVs skip its code');
  await expectNotice('compat-module', /browsers older than 2018 skip/);
  step('code too new to parse: explains the JavaScript is too new');
  await expectNotice('compat-syntax', /newer JavaScript/, 'compat-notice.png');
  assert.match(await compatPanel().textContent(), /Details: 1 script error/);
  assert.equal(await old.evaluate(() => document.activeElement.textContent), 'Go back');

  step('the notice\'s "Show log" opens the page log with the verdict in it');
  await old.keyboard.press('ArrowRight');
  assert.equal(await old.evaluate(() => document.activeElement.textContent), 'Show log');
  await old.keyboard.press('Enter');
  await old.locator('#tizenshield-log').waitFor({ state: 'visible' });
  assert.match(await old.locator('#tizenshield-log').textContent(), /Compatibility notice: This site can't run/);
  await old.keyboard.press('Escape');
  assert.equal(await old.locator('#tizenshield-log').isVisible(), false);

  step('missing feature: names it; Back on the notice goes back a page');
  await expectNotice('compat-missing', /features your TV doesn't have \(TotallyNewBrowserFeature\)/);
  await old.keyboard.press('Escape');
  await old.waitForURL(fixture('compat-syntax'));
  assert.equal(oldErrors.length, 3, 'only the deliberately broken pages report errors: ' + oldErrors.join(' | '));
  await oldEngine.close();

  const logContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await logContext.addInitScript({ path: join(OUT, 'userScript.js') });
  const lp = await logContext.newPage();
  const logPanel = lp.locator('#tizenshield-log');
  const logText = () => logPanel.textContent();

  step('page log: opens from the toolbar\'s Log button with the remote');
  await lp.goto(`http://127.0.0.1:${port}/test/fixtures/troubled.html`);
  await lp.waitForSelector('#tizenshield-toolbar', { state: 'attached' });
  await lp.waitForTimeout(500);
  await lp.keyboard.press('F2');
  await lp.keyboard.press('ArrowDown');
  for (let i = 0; i < 8; i++) await lp.keyboard.press('ArrowRight');
  assert.equal(await lp.evaluate(() => document.activeElement.textContent), 'Log');
  await lp.keyboard.press('Enter');
  await logPanel.waitFor({ state: 'visible' });

  step('page log: lists the stuck request, failed downloads and requests, and errors');
  const text = await logText();
  [
    /STILL WAITING FOR A RESPONSE.*Request GET.*\/api\/slow/,
    /Script didn't load.*missing-app\.js.*the site's own/,
    /Image didn't load.*no-such-ad\.png.*another site/,
    /Fetch GET failed \(404\).*\/api\/missing/,
    /Console error.*Player failed to start \{"code":42\}/,
    /Script error: Error: kaboom/,
    /TizenShield started/,
    /Page content ready/,
    /SLOWEST DOWNLOADS/
  ].forEach((pattern) => assert.match(text, pattern));
  assert.match(text, /27 errors.*3 failed.*1 request waiting/);
  await lp.screenshot({ path: join(OUT, 'page-log.png') });

  step('page log: refreshes itself, Down scrolls it, Back closes it');
  const waited = () => lp.evaluate(() => document.querySelector('#tizenshield-log').textContent.match(/for (\d+\.\d) s/)[1]);
  const firstWait = await waited();
  await lp.waitForTimeout(2300);
  assert.notEqual(await waited(), firstWait);
  const scrollTop = () => lp.evaluate(() => document.querySelector('#tizenshield-log').firstChild.children[1].scrollTop);
  await lp.keyboard.press('ArrowDown');
  assert.ok(await scrollTop() > 0);
  await lp.keyboard.press('Escape');
  assert.equal(await logPanel.isVisible(), false);
  await logContext.close();
  console.log('Smoke test passed. Screenshots in test/out/.');
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
}
