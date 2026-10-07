// Kleine DOM-hulp voor de popup. Altijd textContent, nooit HTML.
export function el(tag, props, text) {
  const n = document.createElement(tag);
  if (props) Object.keys(props).forEach(function (k) { n.setAttribute(k, props[k]); });
  if (text != null) n.textContent = text;
  return n;
}
