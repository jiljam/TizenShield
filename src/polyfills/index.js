import { installCore } from './core.js';
import { installDom } from './dom.js';
import { installNet } from './net.js';
import { installObservers } from './observers.js';

// Installs every polyfill the page is missing; returns the names added. One
// failing group (an odd page, a frozen prototype) doesn't stop the others.
export function installPolyfills(win) {
  var added = [];
  [installCore, installDom, installNet, installObservers].forEach(function (install) {
    try {
      install(win, added);
    } catch (e) {
      // Leave this group out on this page.
    }
  });
  return added;
}
