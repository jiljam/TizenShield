# TizenShield

A remote-friendly web browser with ad hiding for Samsung Tizen TVs, built as a
[TizenBrew](https://github.com/reisxd/TizenBrew) module. It's not a port of Brave (that isn't
possible on Tizen): it gives the TV's built-in web engine a Brave-like start page, remote-control
browsing and cosmetic ad hiding, on top of DNS-level ad blocking (NextDNS, AdGuard DNS or Pi-hole).

Status: first version built and tested in desktop Chromium (`npm test`, `npm run smoke`).
Not yet tried on a TV; see [First test on the TV](#first-test-on-the-tv).

| Decision | Choice |
|---|---|
| Target TV | 2017 (Tizen 3.0, Chrome 47 engine), so output is ES5 |
| Scope | Start page + toolbar over websites + ad hiding |
| Build | Plain JS, esbuild bundle, Babel to ES5, checked by an ES5-only parser |
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
  `start.html#go=<typed text>` (open/search and record it) and `start.html#add=<url>&title=<t>`
  (bookmark it, then return).

```
 TizenBrew ──opens──▶ start.html ◀──#go= / #add=──┐
                       │ launcher (launcher.js)      │
                       └──link / search──▶ any website ── userScript.js re-injected:
                                                       toolbar, remote navigation, ad hiding
```

| File | Role |
|---|---|
| `src/main.js` | Entry: decides start page vs. website vs. frame; skips TizenBrew's own pages |
| `src/launcher.js` | Start page: search box, engine switch, bookmark tiles, recent history |
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

Our text fields stay read-only while focus passes over them so the TV keyboard doesn't pop up
everywhere: press Enter to start typing, Enter/Done to submit, Back to stop.

## Publish and install

The module must live at the root of a **public** repo. This folder is in a private repo, so
export it:

1. On GitHub, create an empty public repo `jiljam/TizenShield` (no README).
2. Push this folder's history to it:
   ```sh
   git clone https://github.com/jiljam/RandomIdeasRepo.git && cd RandomIdeasRepo
   git checkout ccr-758c7cca-ei7qyo
   git subtree split --prefix=tizenshield -b tizenshield-main
   git push https://github.com/jiljam/TizenShield.git tizenshield-main:main
   ```
3. On the TV: open TizenBrew, press **Green** for the module manager, choose
   **Add GitHub Module**, type `jiljam/TizenShield`, then launch TizenShield.

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
npm test        # unit tests (address parsing, storage)
npm run smoke   # end-to-end in desktop Chromium; needs Playwright; screenshots in test/out/
```

On a desktop keyboard: Esc = Back, F1-F4 = Red, Green, Yellow, Blue.

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
5. **Toolbar → Info:** shows the engine version and whether "local link" is OK or blocked. If
   OK, a later version can store bookmarks in a TizenBrew service instead of the start page,
   which removes the extra page load when bookmarking.
6. **Speed:** is moving between links on a heavy site noticeably slow?

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
