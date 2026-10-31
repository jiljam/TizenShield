import { ACCENT } from './config.js';
import { el, focusStyle } from './dom.js';
import { STYLE, Z_TOP, makeTypeable } from './ui.js';

var BAR = STYLE.reset + 'position:fixed;left:0;right:0;top:0;z-index:' + Z_TOP + ';display:none;' +
  'padding:24px 40px 10px;background:rgba(18,19,24,0.97);border-bottom:4px solid ' + ACCENT + ';';
var ROW = STYLE.reset + 'display:block;margin-top:18px;';
var HINT = STYLE.reset + 'display:block;margin:4px 0 8px;font-size:22px;color:#a9abb8;';
var BUTTON = STYLE.button + 'margin-bottom:14px;';

// The toolbar that the Green key opens over any website. `actions` holds the
// handlers; label functions are re-read each time the toolbar opens.
export function createToolbar(actions) {
  var previousFocus = null;
  var root = el('div', { id: 'tizenshield-toolbar', style: BAR });

  var address = el('input', { type: 'text', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Address or search' });
  focusStyle(address, STYLE.input, STYLE.inputFocus);
  makeTypeable(address, function (text) { actions.open(text); });
  root.appendChild(address);

  var row = el('div', { style: ROW });
  var dynamic = [];
  actions.buttons.forEach(function (spec) {
    var button = el('button', { type: 'button', onclick: spec.run });
    focusStyle(button, BUTTON, STYLE.buttonFocus);
    button.textContent = typeof spec.label === 'function' ? spec.label() : spec.label;
    if (typeof spec.label === 'function') dynamic.push({ node: button, label: spec.label });
    row.appendChild(button);
  });
  root.appendChild(row);
  root.appendChild(el('div', {
    style: HINT,
    text: 'Enter on the address bar to type. Arrows move, Enter selects, Back or Green closes.'
  }));

  function isOpen() {
    return root.style.display === 'block';
  }

  function open() {
    // Single-page sites sometimes rebuild the whole document; re-attach if so.
    if (!root.parentNode) document.documentElement.appendChild(root);
    dynamic.forEach(function (d) { d.node.textContent = d.label(); });
    address.value = window.location.href;
    previousFocus = document.activeElement;
    root.style.display = 'block';
    address.focus();
  }

  function close() {
    root.style.display = 'none';
    if (root.contains(document.activeElement)) document.activeElement.blur();
    if (previousFocus && previousFocus !== document.body && document.documentElement.contains(previousFocus)) {
      previousFocus.focus();
    }
    previousFocus = null;
  }

  return {
    root: root,
    isOpen: isOpen,
    open: open,
    close: close,
    toggle: function () { if (isOpen()) close(); else open(); }
  };
}
