import { ACCENT, SEARCH_ENGINES, VERSION, engineById } from './config.js';
import { el, hostOf } from './dom.js';
import { DIRECTION, KEY, isEditing, keyOf, swallow } from './keys.js';
import { move } from './spatialnav.js';
import {
  addBookmark, addHistory, clearHistory, getBookmarks, getHistory, getSettings, removeBookmark, setSetting
} from './storage.js';
import { PLAYER_CSS, showPlayer } from './player.js';
import { makeTypeable, toast } from './ui.js';
import { hopUrl, isWebUrl, looksLikeUrl, parseHash, resolveInput } from './url.js';
import { isVideoUrl } from './video.js';

var REMOVE_CONFIRM_MS = 3000;
var REDIRECT_DELAY_MS = 700;

// Chrome 47-safe CSS: no grid, flex gap, custom properties or sticky.
var CSS = [
  'html,body{margin:0;background:#16171d;color:#f2f2f5;font-family:sans-serif}',
  '#ts-launcher{padding:56px 96px 150px}',
  '.ts-header{display:flex;align-items:baseline;margin-bottom:36px}',
  '.ts-logo{font-size:52px;font-weight:bold}',
  '.ts-logo span{color:' + ACCENT + '}',
  '.ts-version{margin-left:20px;font-size:22px;color:#8a8c99}',
  '.ts-search{display:flex;margin-bottom:48px}',
  '.ts-search input{flex:1;height:84px;padding:0 28px;font-size:34px;color:#111;background:#fff;' +
    'border:4px solid #3a3d4a;border-radius:14px;outline:none}',
  '.ts-search input:focus{border-color:' + ACCENT + '}',
  '.ts-btn{margin-left:20px;padding:0 32px;height:84px;font-size:28px;color:#f2f2f5;background:#2b2d36;' +
    'border:4px solid #2b2d36;border-radius:14px;outline:none}',
  '.ts-btn-small{height:60px;font-size:24px;padding:0 24px}',
  '.ts-section-head{display:flex;align-items:center;margin-bottom:20px}',
  '.ts-section-head h2{flex:1;margin:0;font-size:32px;font-weight:normal;color:#c9cbd6}',
  '.ts-tiles{margin-bottom:40px}',
  '.ts-tile{display:inline-block;vertical-align:top;box-sizing:border-box;width:260px;height:150px;' +
    'margin:0 24px 24px 0;padding:22px;overflow:hidden;color:#f2f2f5;text-decoration:none;' +
    'background:#22242c;border:4px solid #22242c;border-radius:14px;outline:none}',
  '.ts-tile-title{display:block;max-height:70px;overflow:hidden;font-size:28px;line-height:1.25}',
  '.ts-tile-host{display:block;margin-top:12px;font-size:22px;color:#8a8c99;white-space:nowrap;' +
    'overflow:hidden;text-overflow:ellipsis}',
  '.ts-recent a{display:block;max-width:1400px;margin-bottom:12px;padding:16px 24px;font-size:26px;' +
    'color:#f2f2f5;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
    'background:#1d1f26;border:4px solid #1d1f26;border-radius:10px;outline:none}',
  '.ts-recent a span{margin-left:16px;color:#8a8c99}',
  '.ts-btn:focus,.ts-tile:focus,.ts-recent a:focus{border-color:' + ACCENT + ';background:#3b3e4c}',
  '.ts-empty{font-size:26px;color:#8a8c99}',
  '.ts-hints{position:fixed;left:0;right:0;bottom:0;padding:22px 96px;font-size:24px;color:#c9cbd6;background:#101116}',
  '.ts-hint{display:inline-block;margin-right:40px}',
  '.ts-dot{display:inline-block;width:22px;height:22px;margin-right:10px;border-radius:50%;vertical-align:-3px}',
  '.ts-message{padding:200px 96px;font-size:40px}'
].join('\n');

var HINTS = [
  ['#e53935', 'Home'],
  ['#43a047', 'Toolbar (on websites)'],
  ['#fdd835', 'Bookmark page / remove bookmark'],
  ['#1e88e5', 'Remote keys to site'],
  [null, 'Back: go back']
];

var currentView = null;

// The start page. Websites reach it with requests in the URL fragment (see
// hopUrl in url.js): #go= and #add= are handled once on load; #play= is a
// view, like the home screen, so Back from the player returns to wherever it
// was opened from (a website, or home).
export function startLauncher() {
  var params = parseHash(window.location.hash);
  var refused = false;
  if (params.go !== undefined) {
    var url = resolveInput(params.go, engineById(getSettings().engine));
    if (url && !isVideoUrl(url)) {
      addHistory(url, historyTitle(params.go));
      window.location.replace(url);
      return;
    }
    if (url) window.history.replaceState(null, '', playUrl(url, ''));
    else refused = true;
  }
  if (params.add !== undefined && isWebUrl(params.add)) {
    addBookmark(params.add, params.title);
    prepareBody();
    document.body.appendChild(el('div', { 'class': 'ts-message', text: 'Bookmarked: ' + (params.title || hostOf(params.add)) }));
    setTimeout(function () { window.location.replace(params.add); }, REDIRECT_DELAY_MS);
    return;
  }
  prepareBody();
  route();
  window.addEventListener('hashchange', route);
  if (refused) toast("Can't open that address.");
}

function route() {
  if (currentView) currentView.destroy();
  var params = parseHash(window.location.hash);
  if (params.play !== undefined && isWebUrl(params.play)) {
    currentView = showPlayer(params, { exit: function () { window.history.back(); }, home: goHome });
  } else {
    if (window.location.hash) clearHash();
    currentView = showHome();
  }
}

function clearHash() {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

function goHome() {
  clearHash();
  route();
}

function playUrl(url, title) {
  return hopUrl(window.location.href, { play: url, title: title || '' });
}

function historyTitle(text) {
  return looksLikeUrl(text.trim()) ? '' : 'Search: ' + text.trim();
}

// Opens a page, or a video in the player (a same-page fragment change, so it
// adds a history entry and Back returns home).
function openUrl(url, title) {
  if (isVideoUrl(url)) {
    window.location.href = playUrl(url, title);
    return;
  }
  addHistory(url, title);
  window.location.href = url;
}

var bodyPrepared = false;

function prepareBody() {
  if (bodyPrepared) return;
  bodyPrepared = true;
  var boot = document.getElementById('ts-boot');
  if (boot) boot.parentNode.removeChild(boot);
  var style = el('style');
  style.textContent = CSS + '\n' + PLAYER_CSS;
  document.head.appendChild(style);
}

function showHome() {
  var pendingRemove = { url: null, at: 0 };

  var search = makeTypeable(el('input', { type: 'text', spellcheck: 'false', autocomplete: 'off' }), function (text) {
    if (!text.trim()) return;
    var url = resolveInput(text, engineById(getSettings().engine));
    if (url) openUrl(url, historyTitle(text));
    else toast("Can't open that address.");
  });
  var engineButton = el('button', { type: 'button', 'class': 'ts-btn', onclick: cycleEngine });
  var tiles = el('div', { 'class': 'ts-tiles' });
  var recent = el('div', { 'class': 'ts-recent' });
  var clearButton = el('button', {
    type: 'button',
    'class': 'ts-btn ts-btn-small',
    text: 'Clear history',
    onclick: function () {
      clearHistory();
      renderRecent();
      search.focus();
    }
  });

  var root = el('div', { id: 'ts-launcher' }, [
    el('div', { 'class': 'ts-header' }, [
      el('div', { 'class': 'ts-logo' }, ['Tizen', el('span', { text: 'Shield' })]),
      el('div', { 'class': 'ts-version', text: 'v' + VERSION })
    ]),
    el('div', { 'class': 'ts-search' }, [search, engineButton]),
    el('div', { 'class': 'ts-section-head' }, [el('h2', { text: 'Bookmarks' })]),
    tiles,
    el('div', { 'class': 'ts-section-head' }, [el('h2', { text: 'Recent' }), clearButton]),
    recent
  ]);
  var hints = el('div', { 'class': 'ts-hints' }, HINTS.map(function (hint) {
    var parts = hint[0] ? [el('span', { 'class': 'ts-dot', style: 'background:' + hint[0] })] : [];
    return el('span', { 'class': 'ts-hint' }, parts.concat([hint[1]]));
  }));
  document.body.appendChild(root);
  document.body.appendChild(hints);

  showEngine();
  renderTiles();
  renderRecent();
  search.focus();
  window.addEventListener('keydown', onKey, true);

  function showEngine() {
    var engine = engineById(getSettings().engine);
    engineButton.textContent = engine.name;
    search.setAttribute('placeholder', 'Press Enter to search ' + engine.name + ' or type an address');
  }

  function cycleEngine() {
    var index = SEARCH_ENGINES.indexOf(engineById(getSettings().engine));
    setSetting('engine', SEARCH_ENGINES[(index + 1) % SEARCH_ENGINES.length].id);
    showEngine();
  }

  function renderTiles() {
    tiles.innerHTML = '';
    var list = getBookmarks();
    if (!list.length) {
      tiles.appendChild(el('p', { 'class': 'ts-empty', text: 'No bookmarks yet. On any website, press Yellow to add one.' }));
    }
    list.forEach(function (item) {
      var title = item.title || hostOf(item.url);
      tiles.appendChild(el('a', {
        'class': 'ts-tile',
        href: item.url,
        'data-url': item.url,
        'data-title': title,
        onclick: function (event) { openLink(event, item); }
      }, [
        el('span', { 'class': 'ts-tile-title', text: title }),
        el('span', { 'class': 'ts-tile-host', text: hostOf(item.url) })
      ]));
    });
  }

  function renderRecent() {
    recent.innerHTML = '';
    var list = getHistory();
    clearButton.style.display = list.length ? '' : 'none';
    if (!list.length) recent.appendChild(el('p', { 'class': 'ts-empty', text: 'Nothing yet.' }));
    list.slice(0, 10).forEach(function (item) {
      recent.appendChild(el('a', {
        href: item.url,
        onclick: function (event) { openLink(event, item); }
      }, [item.title || hostOf(item.url), el('span', { text: item.url })]));
    });
  }

  function openLink(event, item) {
    event.preventDefault();
    openUrl(item.url, item.title);
  }

  // Yellow on a bookmark asks for confirmation, a second Yellow removes it.
  function removeFocusedBookmark() {
    var active = document.activeElement;
    if (!active || !active.hasAttribute('data-url')) {
      toast('Highlight a bookmark, then press Yellow to remove it.');
      return;
    }
    var url = active.getAttribute('data-url');
    if (pendingRemove.url !== url || Date.now() - pendingRemove.at > REMOVE_CONFIRM_MS) {
      pendingRemove = { url: url, at: Date.now() };
      toast('Press Yellow again to remove "' + active.getAttribute('data-title') + '".');
      return;
    }
    var index = Array.prototype.indexOf.call(tiles.children, active);
    removeBookmark(url);
    pendingRemove = { url: null, at: 0 };
    renderTiles();
    var next = tiles.querySelectorAll('.ts-tile');
    (next[Math.min(index, next.length - 1)] || search).focus();
    toast('Bookmark removed.');
  }

  function onKey(event) {
    var key = keyOf(event);
    if (key === KEY.RED || key === KEY.GREEN) {
      swallow(event);
      window.scrollTo(0, 0);
      search.focus();
      return;
    }
    if (key === KEY.YELLOW) { swallow(event); removeFocusedBookmark(); return; }
    if (key === KEY.BLUE) { swallow(event); toast('Blue sends remote keys to a website. Open a site first.'); return; }

    var dir = DIRECTION[key];
    // Typing in the search box: everything except up/down goes to the field.
    if (isEditing(document.activeElement) && dir !== 'up' && dir !== 'down') return;
    if (key === KEY.BACK) { swallow(event); window.history.back(); return; }
    if (dir) { swallow(event); move(dir, { scope: root, scroll: true }); }
  }

  return {
    destroy: function () {
      window.removeEventListener('keydown', onKey, true);
      document.body.removeChild(root);
      document.body.removeChild(hints);
    }
  };
}
