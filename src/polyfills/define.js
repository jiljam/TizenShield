// Polyfills fill in what the 2017 TV engine (Chrome 47) lacks on websites.
// Each one is added only when missing, and non-enumerable like the real
// thing, so for...in loops and the site's own feature checks behave.
// This folder is exempt from the build's "API not in Chrome 47" lint, since
// it names those APIs on purpose; its own code must still only use what
// Chrome 47 has.

export function define(target, name, value, added, label) {
  if (!target || name in target) return;
  Object.defineProperty(target, name, { value: value, writable: true, configurable: true, enumerable: false });
  added.push(label || name);
}

export function defineGetter(target, name, get, added, label) {
  if (!target || name in target) return;
  Object.defineProperty(target, name, { get: get, configurable: true, enumerable: false });
  added.push(label || name);
}
