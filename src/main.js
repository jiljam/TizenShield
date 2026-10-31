import { startAdHiding } from './adhide.js';
import { onReady } from './dom.js';
import { startLauncher } from './launcher.js';
import { startPageLog } from './pagelog.js';
import { installPolyfills } from './polyfills/index.js';
import { startSite } from './site.js';
import { polyfillsOff } from './storage.js';

// TizenBrew evaluates this script in every new page and frame. The start page
// also loads it with a <script> tag, so guard against running twice.
var TIZENBREW_SERVER = '127.0.0.1:8081';

(function () {
  if (window.__tizenShield) return;
  window.__tizenShield = true;

  var loc = window.location;
  // Leaves TizenBrew's own screens (file:// and friends) alone.
  if (loc.protocol !== 'http:' && loc.protocol !== 'https:') return;

  // Right away, not on DOM ready: TizenBrew injects us as each page starts,
  // so polyfills usually land before the site's scripts run, and the page
  // log records from the start. Not on TizenBrew's own server (our start
  // page and other modules), whose code doesn't need either.
  if (loc.host !== TIZENBREW_SERVER) {
    window.__tizenShieldFixes = polyfillsOff() ? [] : installPolyfills(window);
    if (window.top === window) startPageLog(window.__tizenShieldFixes);
  }

  onReady(function () {
    var isStartPage = document.documentElement.getAttribute('data-tizenshield') === 'start';
    // Other TizenBrew app modules are served from the same local server.
    if (!isStartPage && loc.host === TIZENBREW_SERVER) return;
    if (window.top !== window) {
      // Inside a frame: just hide ads; the remote is handled by the top page.
      if (!isStartPage) startAdHiding(loc.hostname);
      return;
    }
    if (isStartPage) startLauncher();
    else startSite();
  });
})();
