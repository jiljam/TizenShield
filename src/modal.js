import { ACCENT } from './config.js';
import { el, focusStyle } from './dom.js';
import { STYLE, Z_TOP } from './ui.js';

// A centred card over a dimmed website, drawn with inline styles so strict
// site security policies can't block it. Used by the video chooser and the
// compatibility notice.

var R = STYLE.reset;
export var MODAL = {
  backdrop: R + 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:' + Z_TOP + ';display:none;' +
    'background:rgba(8,9,12,0.8);',
  card: R + 'display:block;width:1100px;margin:120px auto 0;padding:44px 48px 36px;color:#f2f2f5;' +
    'background:#16171d;border:3px solid #3a3d4a;border-radius:18px;',
  alertCard: 'border-top:6px solid ' + ACCENT + ';',
  heading: R + 'display:block;font-size:36px;font-weight:bold;line-height:1.25;color:#f2f2f5;',
  sub: R + 'display:block;margin:10px 0 28px;font-size:24px;line-height:1.4;color:#a9abb8;',
  text: R + 'display:block;margin:16px 0 0;font-size:28px;line-height:1.4;color:#f2f2f5;',
  muted: R + 'display:block;margin:14px 0 0;font-size:22px;line-height:1.4;color:#a9abb8;',
  row: R + 'display:block;margin-top:32px;',
  hint: R + 'display:block;margin-top:14px;font-size:22px;color:#a9abb8;'
};

var BUTTON = STYLE.button + 'margin:0 18px 0 0;padding:16px 30px;font-size:28px;border-radius:44px;';

export function modalButton(text, onClick) {
  var button = el('button', { type: 'button', text: text, onclick: onClick });
  return focusStyle(button, BUTTON, STYLE.buttonFocus);
}

export function createModal(id, alert) {
  var card = el('div', { style: MODAL.card + (alert ? MODAL.alertCard : '') });
  var root = el('div', { id: id, style: MODAL.backdrop, role: 'dialog' }, [card]);

  return {
    root: root,
    card: card,
    open: function (focusTarget) {
      if (!root.parentNode) document.documentElement.appendChild(root);
      root.style.display = 'block';
      if (focusTarget) focusTarget.focus();
    },
    close: function () {
      root.style.display = 'none';
      if (root.contains(document.activeElement)) document.activeElement.blur();
    },
    isOpen: function () {
      return root.style.display === 'block';
    }
  };
}
