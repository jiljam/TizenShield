// Small DOM helpers. Styles are always set through element.style (CSSOM),
// never a style attribute, because strict Content-Security-Policy headers on
// some sites block style attributes and <style> tags but not CSSOM writes.

export function el(tag, props, children) {
  var node = document.createElement(tag);
  if (props) {
    Object.keys(props).forEach(function (name) {
      var value = props[name];
      if (name === 'text') node.textContent = value;
      else if (name === 'style') node.style.cssText = value;
      else if (name.indexOf('on') === 0) node.addEventListener(name.slice(2), value);
      else node.setAttribute(name, value);
    });
  }
  (children || []).forEach(function (child) {
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

export function toArray(list) {
  return Array.prototype.slice.call(list);
}

export function onReady(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
  else fn();
}

// Gives an element one inline style when idle and another while focused.
export function focusStyle(node, base, focused) {
  node.style.cssText = base;
  node.addEventListener('focus', function () { node.style.cssText = base + focused; });
  node.addEventListener('blur', function () { node.style.cssText = base; });
  return node;
}

export function hostOf(url) {
  var match = /^[a-z]+:\/\/([^\/?#]+)/i.exec(url);
  return match ? match[1].replace(/^www\./, '') : url;
}
