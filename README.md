# TizenShield

A remote-friendly web browser with ad hiding for Samsung Tizen TVs, built as a
[TizenBrew](https://github.com/reisxd/TizenBrew) module. It's not a port of Brave (that isn't
possible on Tizen): it gives the TV's built-in web engine a Brave-like start page, remote-control
browsing and cosmetic ad hiding, on top of DNS-level ad blocking (NextDNS, AdGuard DNS or Pi-hole).
Video files found on a page play in a full-screen player that uses the TV's hardware decoder.
"TV fixes" add about 50 newer browser features the TV lacks, and when a site still can't run, a
notice explains why instead of leaving a blank page. A **Page log** shows what happened on the
current page, right on the TV.

Status: v0.4, built and tested in desktop Chromium (`npm test`, `npm run smoke`).
Not yet tried on a TV; see [First test on the TV](#first-test-on-the-tv).

| Decision | Choice |
|---|---|
| Target TV | 2017 (Tizen 3.0, Chrome 47 engine), so output is ES5 |
| Scope | Start page + toolbar over websites + ad hiding + "Play on TV player" + TV fixes and compatibility notice |
| Build | Plain JS, esbuild bundle, Babel to ES5, minified, checked by an ES5-only parser |
| Publishing | Public GitHub repo `jiljam/TizenShield` (TizenBrew loads modules through jsDelivr, which can't read private repos) |

## How it works

Verified against TizenBrew's source (`service-nextgen/service/utils/debugger.js` and
`moduleLoader.js`):

- `packageType: "mods"` makes TizenBrew open `websiteURL` and evaluate `dist/userScript.js` in
  **every new page and frame** through the TV's remote debugger. So the script keeps running as
  you browse to any site, not only the first one.
- `websiteURL` is `dist/start.html`, served by TizenBrew's own local module server
  (`127.0.0.1:8081/module/<name>/...`, which fetches from jsDelivr). No other hosting is needed.
- The start page keeps bookmarks, history and the search-engine setting in its `localStorage`.
  Websites can't read that, so they send requests in the start page's URL fragment:
  `start.html#go=<typed text>` (open/search and record it), `start.html#add=<url>&title=<t>`
  (bookmark it, then return) and `start.html#play=<video url>&title=<t>&from=<page>` (play it).

### Play on TV player

The same approach as Stremio clients such as [Kai](https://github.com/ITzAkai/kai): don't use
the website's own player (most need a newer browser than Chrome 47); hand the TV a plain video URL
instead. On Samsung TVs, `<video>` is backed by the hardware decoder, so it plays MKV and MP4 with
H.264, HEVC and AC3, and HLS (`.m3u8`) streams, which desktop browsers can't.

- **Found:** links to video files (`.mp4 .mkv .webm .m4v .mov .avi .ts .m2ts .m3u8`) and
  `<video>` elements playing a plain web address. Videos fed through Media Source (`blob:`
  addresses: YouTube, Dailymotion, most big streaming sites) can't be handed over.
- **Opened from:** the highlighted **Play on TV player** button, first in the Green toolbar (with
  a chooser when a page has several videos), the remote's **Play** key, or OK on a video link.
  A hint appears when a page has a video.
- **Plays on the start page**, not over the website: no site scripts competing for the TV's
  memory, no site security policy in the way, and the decoder is released when you leave.

### TV fixes and the compatibility notice

The TV's engine (Chrome 47, 2015) can't be upgraded, so many current sites fail on it. There are
two kinds of failure, and only the first can be fixed from a script:

- **Missing features** (functions, objects): TizenShield adds them to every website and frame
  before the site's code runs ("polyfills", `src/polyfills/`). Among them: `IntersectionObserver`
  (lazy-loaded images and infinite scroll), `ResizeObserver`, `KeyboardEvent.key` (so sites that
  check `event.key === 'Enter'` respond to the remote, including Samsung's Back, colour and media
  keys), `URLSearchParams`, `AbortController`, `Object.entries`, `Array.flat`, `String.padStart`,
  `Promise.finally`, `globalThis`, `Element.append`, scroll options and more. Each is added only
  if missing. **Log** in the toolbar shows how many were added; **TV fixes: off** turns them off
  for a site, in case one ever gets in a site's way.
- **Newer JavaScript syntax** (`?.`, `async`, module scripts) can't be added after the fact: the
  engine can't read the site's code at all. Many recent sites are like this.

When a page is still essentially empty a few seconds after loading, a notice explains which of
these happened: code too new to read, a named missing feature (e.g. `Proxy`), an app that only
loads as modules (which Chrome 47 skips), or the site's own scripts failing to load (often DNS
blocking). It offers **Go back** or **Stay on this page**.

TizenBrew injects the script as each page starts, so the fixes and error recording usually come
before the site's own scripts, but this isn't guaranteed. Errors that happen first are missed;
the notice then appears later (10 seconds after loading) with softer wording.

### Page log

Press Green, then **Log** (or **Show log** on the compatibility notice). It answers "why is this
page stuck?" without a PC, and updates every 2 seconds while open:

- **Still waiting for a response:** the site's own data requests that haven't been answered, and
  for how long. A page that never finishes loading is usually waiting on one of these.
- **Timeline:** when the site first responded, when the content was ready and fully loaded, every
  script error (marked "code too new" or "missing feature: X" where it can tell), downloads that
  failed (the site's own files, or other sites' files, which are often ads blocked by DNS),
  requests that failed or took over 5 seconds, console errors, "still loading after 30 s", and
  TizenShield's own events.
- **Slowest downloads**, with their times.

The browser only reports a download once it finishes, so stuck scripts and images don't appear
until they fail; stuck data requests do. Only the top page is logged, not embedded frames.

```
 TizenBrew ──opens──▶ start.html ◀──#go= / #add=──┐
                       │ launcher (launcher.js)      │
                       └──link / search──▶ any website ── userScript.js re-injected:
                                                       toolbar, remote navigation, ad hiding
```

| File | Role |
|---|---|
| `src/main.js` | Entry: decides start page vs. website vs. frame; skips TizenBrew's own pages |
| `src/launcher.js` | Start page router (home or player) and the home screen: search, engine switch, bookmarks, history |
| `src/player.js` | Full-screen hardware player: controls, batched seeking, resume, audio tracks, errors |
| `src/detect.js`, `src/picker.js`, `src/video.js` | Finding videos on a page, the "which video?" chooser, URL/format helpers |
| `src/polyfills/` | TV fixes: missing built-ins, page APIs, URL/abort helpers, observers |
| `src/pagelog.js`, `src/logpanel.js` | Recording page events (errors, failed downloads, requests) and the Page log screen |
| `src/compat.js`, `src/modal.js` | The "can't run on your TV's browser" notice, shared dialog |
| `src/site.js`, `src/toolbar.js` | On websites: remote keys, Green toolbar, Back, Home, Bookmark |
| `src/spatialnav.js` | Arrow keys move between links; scrolls when nothing is in reach |
| `src/adhide.js`, `src/filters.js` | Cosmetic filters; script fallback for sites whose CSP blocks `<style>` |
| `src/ui.js` | Toasts, "press Enter to type" fields, focus ring (all CSP-proof inline styles) |

## Remote controls

| Key | Start page | Website |
|---|---|---|
| Arrows | Move between search, bookmarks, history | Move between links; scroll when none nearby |
| Enter | Open / start typing in the search box | Open link; Enter on a text field types |
| Back | Previous page | Previous page (goes home if there's none) |
| Red | Jump to search box | Home (start page) |
| Green | Jump to search box | Open/close toolbar (address bar, back, forward, reload, ...) |
| Yellow | On a bookmark: press twice to remove | Bookmark this page |
| Blue | - | Send arrows/Back to the site instead (for sites with their own TV controls); press again to switch back |
| Play | - | Play the page's video on the TV player (only when the page has one) |

In the player:

| Key | Action |
|---|---|
| OK, Play/Pause | Play / pause (OK on a button presses it) |
| Left / Right, Rewind / Fast-forward | Skip -10 s / +30 s; repeated presses add up into one seek |
| Down / Up | Move between the seek bar and the buttons |
| Back | Hide the controls while playing; otherwise close the player |
| Stop | Close the player |
| Yellow | Next audio track (when the video has several) |
| Red | Start page |

Videos resume where you stopped (except in the first or last 30 seconds).

Our text fields stay read-only while focus passes over them so the TV keyboard doesn't pop up
everywhere: press Enter to start typing, Enter/Done to submit, Back to stop.

## Publish and install

**Install on the TV:** open TizenBrew, press **Green** for the module manager, choose
**Add GitHub Module**, type `jiljam/TizenShield`, then launch TizenShield.

The module is published from the root of the **public** repo
[`jiljam/TizenShield`](https://github.com/jiljam/TizenShield), because TizenBrew loads modules
through jsDelivr, which can't read private repos. If it's developed as a folder inside another
repo, publish that folder's history with:

```sh
git subtree split --prefix=tizenshield -b tizenshield-main
git push https://github.com/jiljam/TizenShield.git tizenshield-main:main
```

If the repo ends up under another name or owner, change `websiteURL` in `package.json` to match
(`gh%2F<owner>%2F<repo>`), rebuild and push.

**Updates:** `dist/` is committed because jsDelivr serves files straight from the repo. After
pushing a change, jsDelivr can keep serving the old files for several hours; to skip the wait,
open these once in any browser, then restart TizenBrew:
`https://purge.jsdelivr.net/gh/jiljam/TizenShield/dist/userScript.js`,
`https://purge.jsdelivr.net/gh/jiljam/TizenShield/dist/start.html` and
`https://purge.jsdelivr.net/gh/jiljam/TizenShield/package.json`.

## Development

```sh
npm install
npm run build   # dist/userScript.js + dist/start.html; fails on non-ES5 output or APIs Chrome 47 lacks
                #   (--no-minify for readable output)
npm test        # unit tests (address parsing, storage, video helpers, polyfills vs native)
npm run smoke   # end-to-end in desktop Chromium; needs Playwright; screenshots in test/out/
```

On a desktop keyboard: Esc = Back, F1-F4 = Red, Green, Yellow, Blue, Space or the media key =
Play/Pause. The smoke test generates its test video with `ffmpeg`.

Ad filters are in `src/filters.js`: generic selectors, plus a per-site map for extra ones. Keep
them to CSS3 selectors; on the TV, the script skips any its engine can't parse.

## First test on the TV

Desktop tests can't answer these; please note what happens:

1. **Launch:** does the start page appear, and do the color keys work on it?
2. **Typing:** press Enter in the search box: does the TV keyboard open, and does its Done
   button search?
3. **Brave Search on Chrome 47:** does it render? If not, highlight the engine button next to the
   search box and press Enter to switch to DuckDuckGo Lite.
4. **Browsing:** on a normal site, do arrows move a visible orange ring between links, and does
   Back work?
5. **Toolbar → Log:** shows the engine version, and an entry "Local link to TizenBrew: OK or
   blocked". If OK, a later version can store bookmarks in a TizenBrew service instead of the
   start page, which removes the extra page load when bookmarking.
6. **Speed:** is moving between links on a heavy site noticeably slow?
7. **Video:** open a page that links to an MP4 or MKV file (for example a public-domain film on
   archive.org: open a film's page, then its download options): does **Play on TV player**
   appear and play, do Play/Pause and Fast-forward on the remote work, and does seeking work?
   If a video has two audio languages, does Yellow switch them?
8. **TV fixes:** on a site that used to be blank or broken, press Green → **Log**: how many
   fixes were added? Does a site now work, or does the "can't run on your TV's browser" notice
   appear, and with which reason?
9. **Page log:** on a site that keeps loading, open **Log**: is anything listed under "Still
   waiting for a response", and which errors or failed downloads appear?

## Known limitations

- Ad hiding is cosmetic: DNS blocking does the real blocking. Ads served from the same domain as
  the content (YouTube, some streaming sites) aren't stopped; use TizenTube for YouTube.
- Bookmarking a page reloads it (it goes through the start page and back).
- History only records what's opened from the start page or the toolbar, not link clicks inside
  sites.
- Any website could send a `#go=`/`#add=` request to the start page, so it could open a site or
  add a bookmark; it can't run script there (only `http(s)` addresses are accepted, and
  everything is shown as text).
- Elements inside scrollable boxes on a page can be reached, but the box itself isn't scrolled
  by the arrows.
- The page is shown at the TV's default zoom; tiny desktop layouts stay tiny.
- TV fixes can't make sites built for modern browsers work when their code uses newer syntax;
  the notice explains those instead.
- The player can't play YouTube, Dailymotion or other sites that stream through Media Source;
  only plain video files and HLS links. It has no subtitles yet.
- Some hosts only serve a video to their own pages (they check the referring page or need a
  login cookie); those show "The video couldn't be downloaded". Hosts without HTTP range support
  can't be skipped through; the player says so.
