// Remote key codes on Samsung Tizen TVs. The four color keys only reach web
// pages because package.json lists them under "keys", which TizenBrew
// registers before it opens the module.
export var KEY = {
  ENTER: 13,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  BACK: 10009,
  RED: 403,
  GREEN: 404,
  YELLOW: 405,
  BLUE: 406,
  IME_DONE: 65376,
  IME_CANCEL: 65385
};

// Desktop stand-ins so the module can be driven from a keyboard while
// developing: Esc = Back, F1-F4 = Red, Green, Yellow, Blue.
var DESKTOP = { 27: KEY.BACK, 112: KEY.RED, 113: KEY.GREEN, 114: KEY.YELLOW, 115: KEY.BLUE };

export var DIRECTION = {};
DIRECTION[KEY.LEFT] = 'left';
DIRECTION[KEY.UP] = 'up';
DIRECTION[KEY.RIGHT] = 'right';
DIRECTION[KEY.DOWN] = 'down';

export function keyOf(event) {
  var code = event.keyCode || event.which;
  return DESKTOP[code] || code;
}

export function swallow(event) {
  event.preventDefault();
  event.stopPropagation();
  if (event.stopImmediatePropagation) event.stopImmediatePropagation();
}

var TEXT_TYPES = /^(text|search|url|email|password|tel|number)$/i;

// True when the element is a text field the user is currently typing into.
// Our own fields stay read-only until Enter is pressed, so the TV keyboard
// doesn't pop up every time focus passes over them.
export function isEditing(node) {
  if (!node) return false;
  if (node.isContentEditable) return true;
  var tag = node.tagName;
  if (tag === 'TEXTAREA') return !node.readOnly;
  if (tag === 'INPUT') return TEXT_TYPES.test(node.type || 'text') && !node.readOnly;
  return false;
}
