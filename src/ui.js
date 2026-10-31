import { ACCENT } from './config.js';
import { el } from './dom.js';
import { KEY, keyOf, swallow } from './keys.js';

// Inline styles for UI drawn on top of websites. `all:initial` stops the
// site's CSS from leaking into ours.
var RESET = 'all:initial;box-sizing:border-box;font-family:sans-serif;';
export var Z_TOP = 2147483647;

export var STYLE = {
  reset: RESET,
  toast: RESET + 'position:fixed;left:15%;right:15%;bottom:64px;z-index:' + Z_TOP + ';display:none;' +
    'padding:20px 36px;text-align:center;font-size:30px;line-height:1.3;' +
    'color:#f2f2f5;background:rgba(18,19,24,0.95);border:3px solid ' + ACCENT + ';border-radius:12px;',
  input: RESET + 'display:block;width:100%;height:72px;padding:0 24px;font-size:30px;color:#111;' +
    'background:#fff;border:4px solid #555;border-radius:10px;',
  inputFocus: 'border-color:' + ACCENT + ';',
  button: RESET + 'display:inline-block;margin:0 14px 0 0;padding:14px 26px;font-size:26px;color:#f2f2f5;' +
    'background:#2b2d36;border:4px solid #2b2d36;border-radius:10px;cursor:pointer;',
  buttonFocus: 'border-color:' + ACCENT + ';background:#3b3e4c;'
};

var toastNode = null;
var toastTimer = null;

export function toast(message, ms) {
  if (!toastNode) toastNode = el('div', { style: STYLE.toast, role: 'status' });
  // Single-page sites sometimes rebuild the whole document; re-attach if so.
  if (!toastNode.parentNode) document.documentElement.appendChild(toastNode);
  toastNode.textContent = message;
  toastNode.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastNode.style.display = 'none'; }, ms || 2600);
}

// Our text fields stay read-only (no TV keyboard) while focus passes over
// them; Enter starts typing, Enter/Done submits, Back/Cancel stops.
export function makeTypeable(input, onSubmit) {
  input.readOnly = true;
  input.setAttribute('data-tizenshield-field', '');
  input.addEventListener('blur', function () { input.readOnly = true; });
  input.addEventListener('keydown', function (event) {
    var key = keyOf(event);
    if (input.readOnly) {
      if (key !== KEY.ENTER) return;
      swallow(event);
      // Re-focusing after dropping read-only is what opens the TV keyboard.
      input.blur();
      input.readOnly = false;
      input.focus();
      try {
        input.setSelectionRange(0, input.value.length);
      } catch (e) {
        // Some input types don't support selection; nothing to do.
      }
      return;
    }
    if (key === KEY.ENTER || key === KEY.IME_DONE) {
      swallow(event);
      input.readOnly = true;
      onSubmit(input.value);
    } else if (key === KEY.BACK || key === KEY.IME_CANCEL) {
      swallow(event);
      input.readOnly = true;
    }
  });
  return input;
}

export function isOurField(node) {
  return !!(node && node.hasAttribute && node.hasAttribute('data-tizenshield-field'));
}

// Websites often remove focus outlines, which makes a remote unusable. Draw
// our own on whatever has focus (inline + !important beats the site's CSS).
export function installFocusRing(exclude) {
  var saved = null;
  function restore() {
    if (!saved) return;
    var s = saved.node.style;
    s.removeProperty('outline');
    s.removeProperty('outline-offset');
    if (saved.outline) s.setProperty('outline', saved.outline, saved.outlinePriority);
    if (saved.offset) s.setProperty('outline-offset', saved.offset, saved.offsetPriority);
    saved = null;
  }
  document.addEventListener('focusin', function (event) {
    var node = event.target;
    if (!node || !node.style || node === document.body || exclude.contains(node)) return;
    restore();
    var s = node.style;
    saved = {
      node: node,
      outline: s.getPropertyValue('outline'),
      outlinePriority: s.getPropertyPriority('outline'),
      offset: s.getPropertyValue('outline-offset'),
      offsetPriority: s.getPropertyPriority('outline-offset')
    };
    s.setProperty('outline', '4px solid ' + ACCENT, 'important');
    s.setProperty('outline-offset', '2px', 'important');
  }, true);
  document.addEventListener('focusout', function (event) {
    if (saved && saved.node === event.target) restore();
  }, true);
}
