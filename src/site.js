import { START_URL, VERSION } from './config.js';
import { startAdHiding } from './adhide.js';
import { findVideos, videoLinkFor } from './detect.js';
import { DIRECTION, KEY, isEditing, keyOf, swallow } from './keys.js';
import { createPicker } from './picker.js';
import { move } from './spatialnav.js';
import { adHidingOff, setAdHidingOff } from './storage.js';
import { createToolbar } from './toolbar.js';
import { installFocusRing, toast } from './ui.js';
import { hopUrl } from './url.js';

var LOCAL_PROBE_URL = 'http://127.0.0.1:8081/';
var VIDEO_HINT_DELAY_MS = 1500;

// Runs on every website the user opens (TizenBrew injects it into each page).
export function startSite() {
  var adOff = adHidingOff();
  var passThrough = false;
  var videos = [];
  if (!adOff) startAdHiding(window.location.hostname);

  var picker = createPicker(playVideo);
  var toolbar = createToolbar({
    open: function (text) {
      // The start page knows the chosen search engine and keeps history.
      if (text.trim()) window.location.href = hopUrl(START_URL, { go: text });
    },
    onOpen: function () { videos = findVideos(); },
    buttons: [
      {
        label: function () { return videos.length > 1 ? 'Play on TV player (' + videos.length + ')' : 'Play on TV player'; },
        visible: function () { return videos.length > 0; },
        primary: true,
        run: playFromPage
      },
      { label: 'Back', run: goBack },
      { label: 'Forward', run: function () { window.history.forward(); } },
      { label: 'Reload', run: function () { window.location.reload(); } },
      { label: 'Home', run: goHome },
      { label: 'Bookmark', run: bookmark },
      { label: function () { return adOff ? 'Ad hiding: off' : 'Ad hiding: on'; }, run: toggleAdHiding },
      { label: function () { return passThrough ? 'Remote: to site' : 'Remote: browse'; }, run: togglePassThrough },
      { label: 'Info', run: diagnostics }
    ]
  });
  document.documentElement.appendChild(toolbar.root);
  installFocusRing({ contains: function (node) { return toolbar.root.contains(node) || picker.root.contains(node); } });
  window.addEventListener('keydown', onKey, true);
  // OK on a link to a video file plays it here instead of downloading it.
  document.addEventListener('click', function (event) {
    var video = videoLinkFor(event.target);
    if (!video) return;
    event.preventDefault();
    playVideo(video);
  }, true);
  setTimeout(function () {
    if (findVideos().length) toast('Video found. Press Play on the remote to watch it on the TV player.', 5000);
  }, VIDEO_HINT_DELAY_MS);

  function onKey(event) {
    var key = keyOf(event);
    if (key === KEY.GREEN) { swallow(event); picker.close(); toolbar.toggle(); return; }
    if (key === KEY.RED) { swallow(event); goHome(); return; }
    if (key === KEY.YELLOW) { swallow(event); bookmark(); return; }
    if (key === KEY.BLUE) { swallow(event); togglePassThrough(); return; }
    if ((key === KEY.PLAY || key === KEY.PLAY_PAUSE) && !passThrough) {
      // Only take over Play when there's something for our player.
      videos = findVideos();
      if (videos.length) { swallow(event); playFromPage(); }
      return;
    }

    var active = document.activeElement;
    var dir = DIRECTION[key];
    if (picker.isOpen()) {
      if (key === KEY.BACK) { swallow(event); picker.close(); return; }
      if (dir) { swallow(event); move(dir, { scope: picker.root }); }
      return;
    }
    if (toolbar.isOpen()) {
      if (isEditing(active)) return; // the address bar handles its own keys
      if (key === KEY.BACK) { swallow(event); toolbar.close(); return; }
      if (dir) { swallow(event); move(dir, { scope: toolbar.root }); }
      return;
    }
    if (passThrough) return;
    if (isEditing(active)) {
      if (key === KEY.BACK) { swallow(event); active.blur(); return; }
      // Left/right move the cursor and typing goes to the field; up/down leave it.
      if (dir !== 'up' && dir !== 'down') return;
    }
    if (key === KEY.BACK) { swallow(event); goBack(); return; }
    if (dir) { swallow(event); move(dir, { scope: document, exclude: toolbar.root, scroll: true }); }
  }

  function goHome() {
    window.location.href = START_URL;
  }

  function playFromPage() {
    if (!videos.length) {
      toast('No video files found on this page.');
      return;
    }
    if (toolbar.isOpen()) toolbar.close();
    if (videos.length === 1) playVideo(videos[0]);
    else picker.open(videos);
  }

  // The player lives on the start page: no site scripts competing for the
  // TV's limited memory, and no site security policy blocking it.
  function playVideo(video) {
    toast('Opening the TV player...');
    window.location.href = hopUrl(START_URL, { play: video.url, title: video.title, from: window.location.href });
  }

  // history.back() does nothing on the first page of the history; go home then.
  function goBack() {
    var before = window.location.href;
    var left = false;
    window.addEventListener('pagehide', function () { left = true; });
    window.history.back();
    setTimeout(function () {
      if (!left && window.location.href === before) goHome();
    }, 800);
  }

  function bookmark() {
    toast('Saving bookmark...');
    // replace(): the start page sends us straight back, leaving history as it was.
    window.location.replace(hopUrl(START_URL, { add: window.location.href, title: document.title || '' }));
  }

  function toggleAdHiding() {
    setAdHidingOff(!adOff);
    window.location.reload();
  }

  function togglePassThrough() {
    passThrough = !passThrough;
    if (toolbar.isOpen()) toolbar.close();
    toast(passThrough
      ? 'Arrow keys and Back now go to the site. Press Blue to switch back.'
      : 'Arrow keys move between links again.');
  }

  // Reports the engine version, and whether this page may reach TizenBrew's
  // local server (decides whether a future version can sync bookmarks
  // through a TizenBrew service instead of the start page).
  function diagnostics() {
    var match = /Chrome\/(\d+)/.exec(navigator.userAgent);
    var summary = 'TizenShield ' + VERSION + ' | Chrome ' + (match ? match[1] : '?');
    if (typeof window.fetch !== 'function') {
      toast(summary + ' | no fetch()', 8000);
      return;
    }
    toast(summary + ' | testing local link...', 8000);
    window.fetch(LOCAL_PROBE_URL, { mode: 'no-cors' }).then(function () {
      toast(summary + ' | local link: OK', 8000);
    }, function () {
      toast(summary + ' | local link: blocked', 8000);
    });
  }
}
