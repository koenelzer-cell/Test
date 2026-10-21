// src/shared/storage-keys.js
var LOCAL = {
  TEST_CONFIG: "onsHelperConfig",
  // lokale testconfiguratie (beheer); wint van config.json
  UI_OVERRIDES: "onsHelper.uiOverrides",
  // door de UI-inspector herstelde selectors
  INSPECTOR_OPEN: "onsHelper.inspectorOpen",
  // UI-inspector blijft open bij paginawissel
  SNAPSHOT: "onsHelper.snapshot",
  // laatste weekstand (service worker; alleen getallen)
  REMINDER_SETTINGS: "onsHelper.reminders",
  // instellingen wekelijkse herinnering
  REMINDER_HANDLED: "onsHelper.reminderHandled",
  // tijdstip (ms) van de laatst afgehandelde herinnering
  FORMS: "onsHelper.forms"
  // registratievormen voor het rechtermuismenu
};

// node_modules/dompurify/dist/purify.es.mjs
function _OverloadYield(e, d) {
  this.v = e, this.k = d;
}
function _arrayLikeToArray(r, a) {
  (null == a || a > r.length) && (a = r.length);
  for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
  return n;
}
function _arrayWithHoles(r) {
  if (Array.isArray(r)) return r;
}
function _iterableToArrayLimit(r, l) {
  var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
  if (null != t) {
    var e, n, i, u, a = [], f = true, o = false;
    try {
      if (i = (t = t.call(r)).next, 0 === l) {
        if (Object(t) !== t) return;
        f = false;
      } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = true) ;
    } catch (r2) {
      o = true, n = r2;
    } finally {
      try {
        if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
      } finally {
        if (o) throw n;
      }
    }
    return a;
  }
}
function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _slicedToArray(r, e) {
  return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
}
function _unsupportedIterableToArray(r, a) {
  if (r) {
    if ("string" == typeof r) return _arrayLikeToArray(r, a);
    var t = {}.toString.call(r).slice(8, -1);
    return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
  }
}
function AsyncGenerator(e) {
  var t, n;
  function resume(t2, n2) {
    try {
      var r = e[t2](n2), o = r.value, u = o instanceof _OverloadYield;
      Promise.resolve(u ? o.v : o).then(function(n3) {
        if (u) {
          var i = "return" === t2 && o.k ? t2 : "next";
          if (!o.k || n3.done) return resume(i, n3);
          n3 = e[i](n3).value;
        }
        settle(!!r.done, n3);
      }, function(e2) {
        resume("throw", e2);
      });
    } catch (e2) {
      settle(2, e2);
    }
  }
  function settle(e2, r) {
    2 === e2 ? t.reject(r) : t.resolve({
      value: r,
      done: e2
    }), (t = t.next) ? resume(t.key, t.arg) : n = null;
  }
  this._invoke = function(e2, r) {
    return new Promise(function(o, u) {
      var i = {
        key: e2,
        arg: r,
        resolve: o,
        reject: u,
        next: null
      };
      n ? n = n.next = i : (t = n = i, resume(e2, r));
    });
  }, "function" != typeof e.return && (this.return = void 0);
}
AsyncGenerator.prototype["function" == typeof Symbol && Symbol.asyncIterator || "@@asyncIterator"] = function() {
  return this;
}, AsyncGenerator.prototype.next = function(e) {
  return this._invoke("next", e);
}, AsyncGenerator.prototype.throw = function(e) {
  return this._invoke("throw", e);
}, AsyncGenerator.prototype.return = function(e) {
  return this._invoke("return", e);
};
var entries = Object.entries;
var setPrototypeOf = Object.setPrototypeOf;
var isFrozen = Object.isFrozen;
var getPrototypeOf = Object.getPrototypeOf;
var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
var freeze = Object.freeze;
var seal = Object.seal;
var create = Object.create;
var _ref = typeof Reflect !== "undefined" && Reflect;
var apply = _ref.apply;
var construct = _ref.construct;
if (!freeze) freeze = function freeze2(x) {
  return x;
};
if (!seal) seal = function seal2(x) {
  return x;
};
if (!apply) apply = function apply2(func, thisArg) {
  for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) args[_key - 2] = arguments[_key];
  return func.apply(thisArg, args);
};
if (!construct) construct = function construct2(Func) {
  for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) args[_key2 - 1] = arguments[_key2];
  return new Func(...args);
};
var arrayForEach = unapply(Array.prototype.forEach);
Array.prototype.indexOf;
var arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
var arrayPop = unapply(Array.prototype.pop);
var arrayPush = unapply(Array.prototype.push);
var arraySlice = unapply(Array.prototype.slice);
var arraySplice = unapply(Array.prototype.splice);
var arrayIsArray = Array.isArray;
var setCreate = unconstruct(Set);
var setAdd = unapply(Set.prototype.add);
var setHas = unapply(Set.prototype.has);
var stringToLowerCase = unapply(String.prototype.toLowerCase);
var stringToString = unapply(String.prototype.toString);
var stringMatch = unapply(String.prototype.match);
var stringReplace = unapply(String.prototype.replace);
var stringIndexOf = unapply(String.prototype.indexOf);
var stringTrim = unapply(String.prototype.trim);
var numberToString = unapply(Number.prototype.toString);
var booleanToString = unapply(Boolean.prototype.toString);
var bigintToString = typeof BigInt === "undefined" ? null : unapply(BigInt.prototype.toString);
var symbolToString = typeof Symbol === "undefined" ? null : unapply(Symbol.prototype.toString);
var objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
var objectToString = unapply(Object.prototype.toString);
var regExpTest = unapply(RegExp.prototype.test);
var typeErrorCreate = unconstruct(TypeError);
function unapply(func) {
  return function(thisArg) {
    if (thisArg instanceof RegExp) thisArg.lastIndex = 0;
    for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) args[_key3 - 1] = arguments[_key3];
    return apply(func, thisArg, args);
  };
}
function unconstruct(Func) {
  return function() {
    for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) args[_key4] = arguments[_key4];
    return construct(Func, args);
  };
}
function addToSet(set, array) {
  let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
  if (setPrototypeOf) setPrototypeOf(set, null);
  if (!arrayIsArray(array)) return set;
  let l = array.length;
  while (l--) {
    let element = array[l];
    if (typeof element === "string") {
      const lcElement = transformCaseFunc(element);
      if (lcElement !== element) {
        if (!isFrozen(array)) array[l] = lcElement;
        element = lcElement;
      }
    }
    set[element] = true;
  }
  return set;
}
function cleanArray(array) {
  for (let index = 0; index < array.length; index++) if (!objectHasOwnProperty(array, index)) array[index] = null;
  return array;
}
function clone(object) {
  const newObject = create(null);
  for (const _ref2 of entries(object)) {
    var _ref3 = _slicedToArray(_ref2, 2);
    const property = _ref3[0];
    const value = _ref3[1];
    if (objectHasOwnProperty(object, property)) {
      if (arrayIsArray(value)) newObject[property] = cleanArray(value);
      else if (value && typeof value === "object" && value.constructor === Object) newObject[property] = clone(value);
      else newObject[property] = value;
    }
  }
  return newObject;
}
function stringifyValue(value) {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
      return numberToString(value);
    case "boolean":
      return booleanToString(value);
    case "bigint":
      return bigintToString ? bigintToString(value) : "0";
    case "symbol":
      return symbolToString ? symbolToString(value) : "Symbol()";
    case "undefined":
      return objectToString(value);
    case "function":
    case "object": {
      if (value === null) return objectToString(value);
      const valueAsRecord = value;
      const valueToString = lookupGetter(valueAsRecord, "toString");
      if (typeof valueToString === "function") {
        const stringified = valueToString(valueAsRecord);
        return typeof stringified === "string" ? stringified : objectToString(stringified);
      }
      return objectToString(value);
    }
    default:
      return objectToString(value);
  }
}
function lookupGetter(object, prop) {
  while (object !== null) {
    const desc = getOwnPropertyDescriptor(object, prop);
    if (desc) {
      if (desc.get) return unapply(desc.get);
      if (typeof desc.value === "function") return unapply(desc.value);
    }
    object = getPrototypeOf(object);
  }
  function fallbackValue() {
    return null;
  }
  return fallbackValue;
}
function lookupAccessor(object, prop) {
  while (object !== null) {
    const desc = getOwnPropertyDescriptor(object, prop);
    if (desc) return desc.get ? unapply(desc.get) : null;
    object = getPrototypeOf(object);
  }
  return null;
}
function isRegex(value) {
  try {
    regExpTest(value, "");
    return true;
  } catch (_unused) {
    return false;
  }
}
var html$1 = freeze([
  "a",
  "abbr",
  "acronym",
  "address",
  "area",
  "article",
  "aside",
  "audio",
  "b",
  "bdi",
  "bdo",
  "big",
  "blink",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "center",
  "cite",
  "code",
  "col",
  "colgroup",
  "content",
  "data",
  "datalist",
  "dd",
  "decorator",
  "del",
  "details",
  "dfn",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "element",
  "em",
  "fieldset",
  "figcaption",
  "figure",
  "font",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hgroup",
  "hr",
  "html",
  "i",
  "img",
  "input",
  "ins",
  "kbd",
  "label",
  "legend",
  "li",
  "main",
  "map",
  "mark",
  "marquee",
  "menu",
  "menuitem",
  "meter",
  "nav",
  "nobr",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "picture",
  "pre",
  "progress",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "search",
  "section",
  "select",
  "shadow",
  "slot",
  "small",
  "source",
  "spacer",
  "span",
  "strike",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "template",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "track",
  "tt",
  "u",
  "ul",
  "var",
  "video",
  "wbr"
]);
var svg$1 = freeze([
  "svg",
  "a",
  "altglyph",
  "altglyphdef",
  "altglyphitem",
  "animatecolor",
  "animatemotion",
  "animatetransform",
  "circle",
  "clippath",
  "defs",
  "desc",
  "ellipse",
  "enterkeyhint",
  "exportparts",
  "filter",
  "font",
  "g",
  "glyph",
  "glyphref",
  "hkern",
  "image",
  "inputmode",
  "line",
  "lineargradient",
  "marker",
  "mask",
  "metadata",
  "mpath",
  "part",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialgradient",
  "rect",
  "stop",
  "style",
  "switch",
  "symbol",
  "text",
  "textpath",
  "title",
  "tref",
  "tspan",
  "view",
  "vkern"
]);
var svgFilters = freeze([
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence"
]);
var svgDisallowed = freeze([
  "animate",
  "color-profile",
  "cursor",
  "discard",
  "font-face",
  "font-face-format",
  "font-face-name",
  "font-face-src",
  "font-face-uri",
  "foreignobject",
  "hatch",
  "hatchpath",
  "mesh",
  "meshgradient",
  "meshpatch",
  "meshrow",
  "missing-glyph",
  "script",
  "set",
  "solidcolor",
  "unknown",
  "use"
]);
var mathMl$1 = freeze([
  "math",
  "menclose",
  "merror",
  "mfenced",
  "mfrac",
  "mglyph",
  "mi",
  "mlabeledtr",
  "mmultiscripts",
  "mn",
  "mo",
  "mover",
  "mpadded",
  "mphantom",
  "mroot",
  "mrow",
  "ms",
  "mspace",
  "msqrt",
  "mstyle",
  "msub",
  "msup",
  "msubsup",
  "mtable",
  "mtd",
  "mtext",
  "mtr",
  "munder",
  "munderover",
  "mprescripts"
]);
var mathMlDisallowed = freeze([
  "maction",
  "maligngroup",
  "malignmark",
  "mlongdiv",
  "mscarries",
  "mscarry",
  "msgroup",
  "mstack",
  "msline",
  "msrow",
  "semantics",
  "annotation",
  "annotation-xml",
  "mprescripts",
  "none"
]);
var text = freeze(["#text"]);
var html = freeze([
  "accept",
  "action",
  "align",
  "alt",
  "autocapitalize",
  "autocomplete",
  "autopictureinpicture",
  "autoplay",
  "background",
  "bgcolor",
  "border",
  "capture",
  "cellpadding",
  "cellspacing",
  "checked",
  "cite",
  "class",
  "clear",
  "color",
  "cols",
  "colspan",
  "command",
  "commandfor",
  "controls",
  "controlslist",
  "coords",
  "crossorigin",
  "datetime",
  "decoding",
  "default",
  "dir",
  "disabled",
  "disablepictureinpicture",
  "disableremoteplayback",
  "download",
  "draggable",
  "enctype",
  "enterkeyhint",
  "exportparts",
  "face",
  "for",
  "headers",
  "height",
  "hidden",
  "high",
  "href",
  "hreflang",
  "id",
  "inert",
  "inputmode",
  "integrity",
  "ismap",
  "kind",
  "label",
  "lang",
  "list",
  "loading",
  "loop",
  "low",
  "max",
  "maxlength",
  "media",
  "method",
  "min",
  "minlength",
  "multiple",
  "muted",
  "name",
  "nonce",
  "noshade",
  "novalidate",
  "nowrap",
  "open",
  "optimum",
  "part",
  "pattern",
  "placeholder",
  "playsinline",
  "popover",
  "popovertarget",
  "popovertargetaction",
  "poster",
  "preload",
  "pubdate",
  "radiogroup",
  "readonly",
  "rel",
  "required",
  "rev",
  "reversed",
  "role",
  "rows",
  "rowspan",
  "spellcheck",
  "scope",
  "selected",
  "shape",
  "size",
  "sizes",
  "slot",
  "span",
  "srclang",
  "start",
  "src",
  "srcset",
  "step",
  "style",
  "summary",
  "tabindex",
  "title",
  "translate",
  "type",
  "usemap",
  "valign",
  "value",
  "width",
  "wrap",
  "xmlns"
]);
var svg = freeze([
  "accent-height",
  "accumulate",
  "additive",
  "alignment-baseline",
  "amplitude",
  "ascent",
  "attributename",
  "attributetype",
  "azimuth",
  "basefrequency",
  "baseline-shift",
  "begin",
  "bias",
  "by",
  "class",
  "clip",
  "clippathunits",
  "clip-path",
  "clip-rule",
  "color",
  "color-interpolation",
  "color-interpolation-filters",
  "color-profile",
  "color-rendering",
  "cx",
  "cy",
  "d",
  "dx",
  "dy",
  "diffuseconstant",
  "direction",
  "display",
  "divisor",
  "dominant-baseline",
  "dur",
  "edgemode",
  "elevation",
  "end",
  "exponent",
  "fill",
  "fill-opacity",
  "fill-rule",
  "filter",
  "filterunits",
  "flood-color",
  "flood-opacity",
  "font-family",
  "font-size",
  "font-size-adjust",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-weight",
  "fx",
  "fy",
  "g1",
  "g2",
  "glyph-name",
  "glyphref",
  "gradientunits",
  "gradienttransform",
  "height",
  "href",
  "id",
  "image-rendering",
  "in",
  "in2",
  "intercept",
  "k",
  "k1",
  "k2",
  "k3",
  "k4",
  "kerning",
  "keypoints",
  "keysplines",
  "keytimes",
  "lang",
  "lengthadjust",
  "letter-spacing",
  "kernelmatrix",
  "kernelunitlength",
  "lighting-color",
  "local",
  "marker-end",
  "marker-mid",
  "marker-start",
  "markerheight",
  "markerunits",
  "markerwidth",
  "maskcontentunits",
  "maskunits",
  "max",
  "mask",
  "mask-type",
  "media",
  "method",
  "mode",
  "min",
  "name",
  "numoctaves",
  "offset",
  "operator",
  "opacity",
  "order",
  "orient",
  "orientation",
  "origin",
  "overflow",
  "paint-order",
  "path",
  "pathlength",
  "patterncontentunits",
  "patterntransform",
  "patternunits",
  "pointer-events",
  "points",
  "preservealpha",
  "preserveaspectratio",
  "primitiveunits",
  "r",
  "rx",
  "ry",
  "radius",
  "refx",
  "refy",
  "repeatcount",
  "repeatdur",
  "restart",
  "result",
  "rotate",
  "scale",
  "seed",
  "shape-rendering",
  "slope",
  "specularconstant",
  "specularexponent",
  "spreadmethod",
  "startoffset",
  "stddeviation",
  "stitchtiles",
  "stop-color",
  "stop-opacity",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke",
  "stroke-width",
  "style",
  "surfacescale",
  "systemlanguage",
  "tabindex",
  "tablevalues",
  "targetx",
  "targety",
  "transform",
  "transform-origin",
  "text-anchor",
  "text-decoration",
  "text-orientation",
  "text-rendering",
  "textlength",
  "type",
  "u1",
  "u2",
  "unicode",
  "values",
  "vector-effect",
  "viewbox",
  "visibility",
  "version",
  "vert-adv-y",
  "vert-origin-x",
  "vert-origin-y",
  "width",
  "word-spacing",
  "wrap",
  "writing-mode",
  "xchannelselector",
  "ychannelselector",
  "x",
  "x1",
  "x2",
  "xmlns",
  "y",
  "y1",
  "y2",
  "z",
  "zoomandpan"
]);
var mathMl = freeze([
  "accent",
  "accentunder",
  "align",
  "bevelled",
  "close",
  "columnalign",
  "columnlines",
  "columnspacing",
  "columnspan",
  "denomalign",
  "depth",
  "dir",
  "display",
  "displaystyle",
  "encoding",
  "fence",
  "frame",
  "height",
  "href",
  "id",
  "largeop",
  "length",
  "linethickness",
  "lquote",
  "lspace",
  "mathbackground",
  "mathcolor",
  "mathsize",
  "mathvariant",
  "maxsize",
  "minsize",
  "movablelimits",
  "notation",
  "numalign",
  "open",
  "rowalign",
  "rowlines",
  "rowspacing",
  "rowspan",
  "rspace",
  "rquote",
  "scriptlevel",
  "scriptminsize",
  "scriptsizemultiplier",
  "selection",
  "separator",
  "separators",
  "stretchy",
  "subscriptshift",
  "supscriptshift",
  "symmetric",
  "voffset",
  "width",
  "xmlns"
]);
var xml = freeze([
  "xlink:href",
  "xml:id",
  "xlink:title",
  "xml:space",
  "xmlns:xlink"
]);
var MUSTACHE_EXPR = seal(/{{[\w\W]*|^[\w\W]*}}/g);
var ERB_EXPR = seal(/<%[\w\W]*|^[\w\W]*%>/g);
var TMPLIT_EXPR = seal(/\${[\w\W]*/g);
var DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
var ARIA_ATTR = seal(/^aria-[\-\w]+$/);
var IS_ALLOWED_URI = seal(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i);
var IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
var ATTR_WHITESPACE = seal(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g);
var DOCTYPE_NAME = seal(/^html$/i);
var CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
var ELEMENT_MARKUP_PROBE = seal(/<[/\w!]/g);
var COMMENT_MARKUP_PROBE = seal(/<[/\w]/g);
var FALLBACK_TAG_CLOSE = seal(/<\/no(script|embed|frames)/i);
var SELF_CLOSING_TAG = seal(/\/>/i);
var NODE_TYPE = {
  element: 1,
  attribute: 2,
  text: 3,
  cdataSection: 4,
  entityReference: 5,
  entityNode: 6,
  processingInstruction: 7,
  comment: 8,
  document: 9,
  documentType: 10,
  documentFragment: 11,
  notation: 12
};
var LITERAL_TEXT_ELEMENTS = freeze(addToSet({}, [
  "style",
  "script",
  "xmp",
  "iframe",
  "noembed",
  "noframes",
  "plaintext",
  "noscript"
]));
var getGlobal = function getGlobal2() {
  return typeof window === "undefined" ? null : window;
};
var _createTrustedTypesPolicy = function _createTrustedTypesPolicy2(trustedTypes, purifyHostElement) {
  if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") return null;
  let suffix = null;
  const ATTR_NAME = "data-tt-policy-suffix";
  if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) suffix = purifyHostElement.getAttribute(ATTR_NAME);
  const policyName = "dompurify" + (suffix ? "#" + suffix : "");
  try {
    return trustedTypes.createPolicy(policyName, {
      createHTML(html2) {
        return html2;
      },
      createScriptURL(scriptUrl) {
        return scriptUrl;
      }
    });
  } catch (_) {
    console.warn("TrustedTypes policy " + policyName + " could not be created.");
    return null;
  }
};
var _createHooksMap = function _createHooksMap2() {
  return {
    afterSanitizeAttributes: [],
    afterSanitizeElements: [],
    afterSanitizeShadowDOM: [],
    beforeSanitizeAttributes: [],
    beforeSanitizeElements: [],
    beforeSanitizeShadowDOM: [],
    uponSanitizeAttribute: [],
    uponSanitizeElement: [],
    uponSanitizeShadowNode: []
  };
};
var _resolveSetOption = function _resolveSetOption2(cfg, key, fallback, options) {
  return objectHasOwnProperty(cfg, key) && arrayIsArray(cfg[key]) ? addToSet(options.base ? clone(options.base) : {}, cfg[key], options.transform) : fallback;
};
var _resolveObjectOption = function _resolveObjectOption2(cfg, key, makeFallback) {
  const value = objectHasOwnProperty(cfg, key) ? cfg[key] : void 0;
  return value && typeof value === "object" ? clone(value) : makeFallback();
};
function createDOMPurify() {
  let window2 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
  const DOMPurify = (root) => createDOMPurify(root);
  DOMPurify.version = "3.4.17";
  DOMPurify.removed = [];
  if (!window2 || !window2.document || window2.document.nodeType !== NODE_TYPE.document || !window2.Element) {
    DOMPurify.isSupported = false;
    return DOMPurify;
  }
  let document2 = window2.document;
  const originalDocument = document2;
  const currentScript = originalDocument.currentScript;
  window2.DocumentFragment;
  const HTMLTemplateElement = window2.HTMLTemplateElement, Node = window2.Node, Element = window2.Element, NodeFilter = window2.NodeFilter;
  window2.NamedNodeMap === void 0 && (window2.NamedNodeMap || window2.MozNamedAttrMap);
  window2.HTMLFormElement;
  const DOMParser = window2.DOMParser, trustedTypes = window2.trustedTypes;
  const ElementPrototype = Element.prototype;
  const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
  const remove = lookupGetter(ElementPrototype, "remove");
  const removeAttributeNode = lookupGetter(ElementPrototype, "removeAttributeNode");
  const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
  const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
  const getParentNode = lookupGetter(ElementPrototype, "parentNode");
  const getShadowRoot = lookupGetter(ElementPrototype, "shadowRoot");
  const getAttributes = lookupGetter(ElementPrototype, "attributes");
  const getNodeType = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeType") : null;
  const getNodeName = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeName") : null;
  const getOwnerDocument = Node && Node.prototype ? lookupGetter(Node.prototype, "ownerDocument") : null;
  const _readNodeType = function _readNodeType2(node) {
    return getNodeType ? getNodeType(node) : node.nodeType;
  };
  const _readNodeName = function _readNodeName2(node) {
    return getNodeName ? getNodeName(node) : node.nodeName;
  };
  const getNamespaceURI = lookupAccessor(ElementPrototype, "namespaceURI");
  const _readNamespaceURI = function _readNamespaceURI2(element) {
    return getNamespaceURI ? getNamespaceURI(element) : element.namespaceURI;
  };
  if (typeof HTMLTemplateElement === "function") {
    const template = document2.createElement("template");
    if (template.content && template.content.ownerDocument) document2 = template.content.ownerDocument;
  }
  let trustedTypesPolicy;
  let emptyHTML = "";
  let defaultTrustedTypesPolicy;
  let defaultTrustedTypesPolicyResolved = false;
  let IN_TRUSTED_TYPES_POLICY = 0;
  const _assertNotInTrustedTypesPolicy = function _assertNotInTrustedTypesPolicy2() {
    if (IN_TRUSTED_TYPES_POLICY > 0) throw typeErrorCreate('A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.');
  };
  const _createTrustedHTML = function _createTrustedHTML2(html2) {
    _assertNotInTrustedTypesPolicy();
    IN_TRUSTED_TYPES_POLICY++;
    try {
      return trustedTypesPolicy.createHTML(html2);
    } finally {
      IN_TRUSTED_TYPES_POLICY--;
    }
  };
  const _createTrustedScriptURL = function _createTrustedScriptURL2(scriptUrl) {
    _assertNotInTrustedTypesPolicy();
    IN_TRUSTED_TYPES_POLICY++;
    try {
      return trustedTypesPolicy.createScriptURL(scriptUrl);
    } finally {
      IN_TRUSTED_TYPES_POLICY--;
    }
  };
  const _getDefaultTrustedTypesPolicy = function _getDefaultTrustedTypesPolicy2() {
    if (!defaultTrustedTypesPolicyResolved) {
      defaultTrustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
      defaultTrustedTypesPolicyResolved = true;
    }
    return defaultTrustedTypesPolicy;
  };
  const _document = document2, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
  const importNode = originalDocument.importNode;
  let hooks = _createHooksMap();
  DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
  const MUSTACHE_EXPR$1 = MUSTACHE_EXPR, ERB_EXPR$1 = ERB_EXPR, TMPLIT_EXPR$1 = TMPLIT_EXPR, DATA_ATTR$1 = DATA_ATTR, ARIA_ATTR$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$1 = ATTR_WHITESPACE, CUSTOM_ELEMENT$1 = CUSTOM_ELEMENT;
  let IS_ALLOWED_URI$1 = IS_ALLOWED_URI;
  let ALLOWED_TAGS = null;
  const DEFAULT_ALLOWED_TAGS = addToSet({}, [
    ...html$1,
    ...svg$1,
    ...svgFilters,
    ...mathMl$1,
    ...text
  ]);
  let ALLOWED_ATTR = null;
  const DEFAULT_ALLOWED_ATTR = addToSet({}, [
    ...html,
    ...svg,
    ...mathMl,
    ...xml
  ]);
  let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
    tagNameCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    attributeNameCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    allowCustomizedBuiltInElements: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: false
    }
  }));
  let FORBID_TAGS = null;
  let FORBID_ATTR = null;
  const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
    tagCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    attributeCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    }
  }));
  let ALLOW_ARIA_ATTR = true;
  let ALLOW_DATA_ATTR = true;
  let ALLOW_UNKNOWN_PROTOCOLS = false;
  let ALLOW_SELF_CLOSE_IN_ATTR = true;
  let SAFE_FOR_TEMPLATES = false;
  let SAFE_FOR_XML = true;
  let WHOLE_DOCUMENT = false;
  let SET_CONFIG = false;
  let SET_CONFIG_ALLOWED_TAGS = null;
  let SET_CONFIG_ALLOWED_ATTR = null;
  let FORCE_BODY = false;
  let RETURN_DOM = false;
  let RETURN_DOM_FRAGMENT = false;
  let RETURN_TRUSTED_TYPE = false;
  let SANITIZE_DOM = true;
  let SANITIZE_NAMED_PROPS = false;
  const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
  let KEEP_CONTENT = true;
  let IN_PLACE = false;
  let IN_PLACE_VISITED = null;
  let USE_PROFILES = {};
  let FORBID_CONTENTS = null;
  const DEFAULT_FORBID_CONTENTS = addToSet({}, [
    "annotation-xml",
    "audio",
    "colgroup",
    "desc",
    "foreignobject",
    "head",
    "iframe",
    "math",
    "mi",
    "mn",
    "mo",
    "ms",
    "mtext",
    "noembed",
    "noframes",
    "noscript",
    "plaintext",
    "script",
    "selectedcontent",
    "style",
    "svg",
    "template",
    "thead",
    "title",
    "video",
    "xmp"
  ]);
  let DATA_URI_TAGS = null;
  const DEFAULT_DATA_URI_TAGS = addToSet({}, [
    "audio",
    "video",
    "img",
    "source",
    "image",
    "track"
  ]);
  let URI_SAFE_ATTRIBUTES = null;
  const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, [
    "alt",
    "class",
    "for",
    "id",
    "label",
    "name",
    "pattern",
    "placeholder",
    "role",
    "summary",
    "title",
    "value",
    "style",
    "xmlns"
  ]);
  const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  let NAMESPACE = HTML_NAMESPACE;
  let IS_EMPTY_INPUT = false;
  let ALLOWED_NAMESPACES = null;
  const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [
    MATHML_NAMESPACE,
    SVG_NAMESPACE,
    HTML_NAMESPACE
  ], stringToString);
  const DEFAULT_MATHML_TEXT_INTEGRATION_POINTS = freeze([
    "mi",
    "mo",
    "mn",
    "ms",
    "mtext"
  ]);
  let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
  const DEFAULT_HTML_INTEGRATION_POINTS = freeze(["annotation-xml"]);
  let HTML_INTEGRATION_POINTS = addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
  const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, [
    "title",
    "style",
    "font",
    "a",
    "script"
  ]);
  let PARSER_MEDIA_TYPE = null;
  const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
  const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
  let transformCaseFunc = null;
  let CONFIG = null;
  const formElement = document2.createElement("form");
  const isRegexOrFunction = function isRegexOrFunction2(testValue) {
    return testValue instanceof RegExp || testValue instanceof Function;
  };
  const _parseConfig = function _parseConfig2() {
    let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    if (CONFIG && CONFIG === cfg) return;
    if (!cfg || typeof cfg !== "object") cfg = {};
    cfg = clone(cfg);
    PARSER_MEDIA_TYPE = SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
    transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
    ALLOWED_TAGS = _resolveSetOption(cfg, "ALLOWED_TAGS", DEFAULT_ALLOWED_TAGS, { transform: transformCaseFunc });
    ALLOWED_ATTR = _resolveSetOption(cfg, "ALLOWED_ATTR", DEFAULT_ALLOWED_ATTR, { transform: transformCaseFunc });
    ALLOWED_NAMESPACES = _resolveSetOption(cfg, "ALLOWED_NAMESPACES", DEFAULT_ALLOWED_NAMESPACES, { transform: stringToString });
    URI_SAFE_ATTRIBUTES = _resolveSetOption(cfg, "ADD_URI_SAFE_ATTR", DEFAULT_URI_SAFE_ATTRIBUTES, {
      transform: transformCaseFunc,
      base: DEFAULT_URI_SAFE_ATTRIBUTES
    });
    DATA_URI_TAGS = _resolveSetOption(cfg, "ADD_DATA_URI_TAGS", DEFAULT_DATA_URI_TAGS, {
      transform: transformCaseFunc,
      base: DEFAULT_DATA_URI_TAGS
    });
    FORBID_CONTENTS = _resolveSetOption(cfg, "FORBID_CONTENTS", DEFAULT_FORBID_CONTENTS, { transform: transformCaseFunc });
    FORBID_TAGS = _resolveSetOption(cfg, "FORBID_TAGS", clone({}), { transform: transformCaseFunc });
    FORBID_ATTR = _resolveSetOption(cfg, "FORBID_ATTR", clone({}), { transform: transformCaseFunc });
    USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES && typeof cfg.USE_PROFILES === "object" ? clone(cfg.USE_PROFILES) : cfg.USE_PROFILES : false;
    ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
    ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
    ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
    ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
    SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
    SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
    WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
    RETURN_DOM = cfg.RETURN_DOM || false;
    RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
    RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
    FORCE_BODY = cfg.FORCE_BODY || false;
    SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
    SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
    KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
    IN_PLACE = cfg.IN_PLACE || false;
    IS_ALLOWED_URI$1 = isRegex(cfg.ALLOWED_URI_REGEXP) ? cfg.ALLOWED_URI_REGEXP : IS_ALLOWED_URI;
    NAMESPACE = typeof cfg.NAMESPACE === "string" ? cfg.NAMESPACE : HTML_NAMESPACE;
    MATHML_TEXT_INTEGRATION_POINTS = _resolveObjectOption(cfg, "MATHML_TEXT_INTEGRATION_POINTS", () => addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS));
    HTML_INTEGRATION_POINTS = _resolveObjectOption(cfg, "HTML_INTEGRATION_POINTS", () => addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS));
    const customElementHandling = _resolveObjectOption(cfg, "CUSTOM_ELEMENT_HANDLING", () => create(null));
    CUSTOM_ELEMENT_HANDLING = create(null);
    if (objectHasOwnProperty(customElementHandling, "tagNameCheck") && isRegexOrFunction(customElementHandling.tagNameCheck)) CUSTOM_ELEMENT_HANDLING.tagNameCheck = customElementHandling.tagNameCheck;
    if (objectHasOwnProperty(customElementHandling, "attributeNameCheck") && isRegexOrFunction(customElementHandling.attributeNameCheck)) CUSTOM_ELEMENT_HANDLING.attributeNameCheck = customElementHandling.attributeNameCheck;
    if (objectHasOwnProperty(customElementHandling, "allowCustomizedBuiltInElements") && typeof customElementHandling.allowCustomizedBuiltInElements === "boolean") CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = customElementHandling.allowCustomizedBuiltInElements;
    seal(CUSTOM_ELEMENT_HANDLING);
    if (SAFE_FOR_TEMPLATES) ALLOW_DATA_ATTR = false;
    if (RETURN_DOM_FRAGMENT) RETURN_DOM = true;
    if (USE_PROFILES) {
      ALLOWED_TAGS = addToSet({}, text);
      ALLOWED_ATTR = create(null);
      if (USE_PROFILES.html === true) {
        addToSet(ALLOWED_TAGS, html$1);
        addToSet(ALLOWED_ATTR, html);
      }
      if (USE_PROFILES.svg === true) {
        addToSet(ALLOWED_TAGS, svg$1);
        addToSet(ALLOWED_ATTR, svg);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.svgFilters === true) {
        addToSet(ALLOWED_TAGS, svgFilters);
        addToSet(ALLOWED_ATTR, svg);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.mathMl === true) {
        addToSet(ALLOWED_TAGS, mathMl$1);
        addToSet(ALLOWED_ATTR, mathMl);
        addToSet(ALLOWED_ATTR, xml);
      }
    }
    EXTRA_ELEMENT_HANDLING.tagCheck = null;
    EXTRA_ELEMENT_HANDLING.attributeCheck = null;
    if (objectHasOwnProperty(cfg, "ADD_TAGS")) {
      if (typeof cfg.ADD_TAGS === "function") EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
      else if (arrayIsArray(cfg.ADD_TAGS)) {
        if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) ALLOWED_TAGS = clone(ALLOWED_TAGS);
        addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
      }
    }
    if (objectHasOwnProperty(cfg, "ADD_ATTR")) {
      if (typeof cfg.ADD_ATTR === "function") EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
      else if (arrayIsArray(cfg.ADD_ATTR)) {
        if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) ALLOWED_ATTR = clone(ALLOWED_ATTR);
        addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
      }
    }
    if (objectHasOwnProperty(cfg, "ADD_FORBID_CONTENTS") && arrayIsArray(cfg.ADD_FORBID_CONTENTS)) {
      if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) FORBID_CONTENTS = clone(FORBID_CONTENTS);
      addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
    }
    if (KEEP_CONTENT) ALLOWED_TAGS["#text"] = true;
    if (WHOLE_DOCUMENT) addToSet(ALLOWED_TAGS, [
      "html",
      "head",
      "body"
    ]);
    if (ALLOWED_TAGS.table) {
      addToSet(ALLOWED_TAGS, ["tbody"]);
      delete FORBID_TAGS.tbody;
    }
    if (cfg.TRUSTED_TYPES_POLICY) {
      if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');
      if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');
      const previousTrustedTypesPolicy = trustedTypesPolicy;
      trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
      try {
        emptyHTML = _createTrustedHTML("");
      } catch (error) {
        trustedTypesPolicy = previousTrustedTypesPolicy;
        throw error;
      }
    } else if (cfg.TRUSTED_TYPES_POLICY === null) {
      trustedTypesPolicy = void 0;
      emptyHTML = "";
    } else {
      if (trustedTypesPolicy === void 0) trustedTypesPolicy = _getDefaultTrustedTypesPolicy();
      if (trustedTypesPolicy && typeof emptyHTML === "string") emptyHTML = _createTrustedHTML("");
    }
    if (freeze) freeze(cfg);
    CONFIG = cfg;
  };
  const ALL_SVG_TAGS = addToSet({}, [
    ...svg$1,
    ...svgFilters,
    ...svgDisallowed
  ]);
  const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
  const _checkSvgNamespace = function _checkSvgNamespace2(tagName, parent, parentTagName) {
    if (parent.namespaceURI === HTML_NAMESPACE) return tagName === "svg";
    if (parent.namespaceURI === MATHML_NAMESPACE) return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
    return Boolean(ALL_SVG_TAGS[tagName]);
  };
  const _checkMathMlNamespace = function _checkMathMlNamespace2(tagName, parent, parentTagName) {
    if (parent.namespaceURI === HTML_NAMESPACE) return tagName === "math";
    if (parent.namespaceURI === SVG_NAMESPACE) return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
    return Boolean(ALL_MATHML_TAGS[tagName]);
  };
  const _checkHtmlNamespace = function _checkHtmlNamespace2(tagName, parent, parentTagName) {
    if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) return false;
    if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) return false;
    return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
  };
  const _checkValidNamespace = function _checkValidNamespace2(element) {
    const elementNamespace = _readNamespaceURI(element);
    const tagName = stringToLowerCase(_readNodeName(element));
    const parentNode = getParentNode(element);
    let parent;
    let parentTagName;
    if (parentNode && _readNodeType(parentNode) === NODE_TYPE.element) {
      parent = { namespaceURI: _readNamespaceURI(parentNode) };
      parentTagName = stringToLowerCase(_readNodeName(parentNode));
    } else {
      parent = { namespaceURI: NAMESPACE };
      parentTagName = "template";
    }
    if (!ALLOWED_NAMESPACES[elementNamespace]) return false;
    if (elementNamespace === SVG_NAMESPACE) return _checkSvgNamespace(tagName, parent, parentTagName);
    if (elementNamespace === MATHML_NAMESPACE) return _checkMathMlNamespace(tagName, parent, parentTagName);
    if (elementNamespace === HTML_NAMESPACE) return _checkHtmlNamespace(tagName, parent, parentTagName);
    if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[elementNamespace]) return true;
    return false;
  };
  const _forceRemove = function _forceRemove2(node) {
    arrayPush(DOMPurify.removed, { element: node });
    try {
      getParentNode(node).removeChild(node);
    } catch (_) {
      remove(node);
      if (!getParentNode(node)) throw typeErrorCreate("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place");
    }
  };
  const _stripAttributeNode = function _stripAttributeNode2(element, attribute, name) {
    try {
      removeAttributeNode(element, attribute);
    } catch (_) {
      try {
        element.removeAttribute(name);
      } catch (_2) {
      }
    }
  };
  const _neutralizeRoot = function _neutralizeRoot2(root) {
    _neutralizeSubtree(root);
    const childNodes = getChildNodes(root);
    if (childNodes) arrayForEach(arraySlice(childNodes), (child) => {
      try {
        remove(child);
      } catch (_) {
      }
    });
    const attributes = _readNodeType(root) === NODE_TYPE.element ? getAttributes(root) : null;
    if (attributes) for (let i = attributes.length - 1; i >= 0; --i) {
      const attribute = attributes[i];
      const name = attribute && attribute.name;
      if (typeof name === "string") _stripAttributeNode(root, attribute, name);
    }
  };
  const _removeAttribute = function _removeAttribute2(name, element, attr) {
    if (!attr) try {
      attr = element.getAttributeNode(name);
    } catch (_) {
      attr = null;
    }
    arrayPush(DOMPurify.removed, {
      attribute: attr || null,
      from: element
    });
    try {
      if (attr) removeAttributeNode(element, attr);
      else element.removeAttribute(name);
    } catch (_) {
      try {
        element.removeAttribute(name);
      } catch (_2) {
      }
    }
    if (name === "is") {
      if (RETURN_DOM || RETURN_DOM_FRAGMENT) try {
        _forceRemove(element);
      } catch (_) {
      }
      else try {
        element.setAttribute(name, "");
      } catch (_) {
      }
    }
  };
  const _stripDisallowedAttributes = function _stripDisallowedAttributes2(element) {
    const attributes = getAttributes(element);
    if (!attributes) return;
    for (let i = attributes.length - 1; i >= 0; --i) {
      const attribute = attributes[i];
      const name = attribute && attribute.name;
      if (typeof name !== "string" || ALLOWED_ATTR[transformCaseFunc(name)]) continue;
      _stripAttributeNode(element, attribute, name);
    }
  };
  const _walkTree = function _walkTree2(root, visit) {
    let intoShadow = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      if (visit(node) === false) continue;
      if (intoShadow && _readNodeType(node) === NODE_TYPE.element) {
        const shadowRoot = getShadowRoot(node);
        if (_isDocumentFragment(shadowRoot)) stack.push(shadowRoot);
      }
      const childNodes = getChildNodes(node);
      if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push(childNodes[i]);
    }
  };
  const _neutralizeSubtree = function _neutralizeSubtree2(root) {
    _walkTree(root, (node) => {
      if (_readNodeType(node) === NODE_TYPE.element) _stripDisallowedAttributes(node);
    });
  };
  const _collectLiveNodes = function _collectLiveNodes2(root) {
    const nodes = [];
    _walkTree(root, (node) => {
      nodes.push(node);
    }, true);
    return nodes;
  };
  const _neutralizeEscapedElements = function _neutralizeEscapedElements2(root, before) {
    const reachable = setCreate();
    arrayForEach(_collectLiveNodes(root), (node) => {
      if (_readNodeType(node) === NODE_TYPE.element) setAdd(reachable, node);
    });
    arrayForEach(before, (node) => {
      if (_readNodeType(node) === NODE_TYPE.element && !setHas(reachable, node)) _stripDisallowedAttributes(node);
    });
  };
  const _neutralizeDiscarded = function _neutralizeDiscarded2(root, before) {
    let rootRemoved = false;
    arrayForEach(DOMPurify.removed, (entry) => {
      if (entry.element) {
        rootRemoved = rootRemoved || entry.element === root;
        _neutralizeSubtree(entry.element);
      }
    });
    _neutralizeEscapedElements(root, before);
    return rootRemoved;
  };
  const MAX_UNVISITED_ROUNDS = 8;
  const _sanitizeUnvisitedNodes = function _sanitizeUnvisitedNodes2(root, before) {
    const visited = IN_PLACE_VISITED;
    let original = null;
    const getOriginal = () => {
      if (!original) {
        original = setCreate();
        arrayForEach(before, (beforeNode) => {
          setAdd(original, beforeNode);
        });
      }
      return original;
    };
    for (let round = 0; ; round++) {
      const live = _collectLiveNodes(root);
      const containers = [root];
      let pending = false;
      arrayForEach(live, (node) => {
        if (_readNodeType(node) === NODE_TYPE.documentFragment) arrayPush(containers, node);
        else if (!pending && !setHas(visited, node)) pending = setHas(getOriginal(), node);
      });
      if (!pending) return;
      if (round >= MAX_UNVISITED_ROUNDS) throw typeErrorCreate("the tree kept changing during in-place sanitization; refusing to return it");
      arrayForEach(containers, (container, index) => {
        _sanitizeUnvisitedIn(container, index > 0, root, getOriginal());
      });
    }
  };
  const _sanitizeUnvisitedIn = function _sanitizeUnvisitedIn2(container, inShadow, root, original) {
    const iterator = _createNodeIterator(container);
    let node;
    while (node = iterator.nextNode()) {
      if (!setHas(original, node) || setHas(IN_PLACE_VISITED, node)) continue;
      if (inShadow) _executeHooks(hooks.uponSanitizeShadowNode, node, null);
      _sanitizeElements(node, root);
      _sanitizeAttributes(node, root);
      if (_isDocumentFragment(node.content)) _sanitizeShadowDOM2(node.content);
    }
  };
  const _markVisited = function _markVisited2(node) {
    if (IN_PLACE_VISITED) setAdd(IN_PLACE_VISITED, node);
  };
  const _isPatchLinkageAttribute = function _isPatchLinkageAttribute2(lcName, lcTag) {
    if (!SAFE_FOR_XML) return false;
    if (lcName === "patchsrc") return true;
    return lcName === "for" && lcTag !== "label" && lcTag !== "output";
  };
  const _neutralizePatchLinkage = function _neutralizePatchLinkage2(root) {
    if (!SAFE_FOR_XML) return;
    _walkTree(root, (node) => {
      const nodeType = _readNodeType(node);
      if (nodeType === NODE_TYPE.processingInstruction || nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, node.data)) {
        try {
          remove(node);
        } catch (_) {
        }
        return false;
      }
      if (nodeType === NODE_TYPE.element) {
        const element = node;
        const lcTag = transformCaseFunc(_readNodeName(node));
        try {
          if (element.hasAttribute && element.hasAttribute("patchsrc")) element.removeAttribute("patchsrc");
          if (element.hasAttribute && element.hasAttribute("for") && _isPatchLinkageAttribute("for", lcTag)) element.removeAttribute("for");
        } catch (_) {
        }
      }
      return true;
    });
  };
  const _initDocument = function _initDocument2(dirty) {
    let doc = null;
    let leadingWhitespace = null;
    if (FORCE_BODY) dirty = "<remove></remove>" + dirty;
    else {
      const matches = stringMatch(dirty, /^[\r\n\t ]+/);
      leadingWhitespace = matches && matches[0];
    }
    if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) dirty = '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>' + dirty + "</body></html>";
    const dirtyPayload = trustedTypesPolicy ? _createTrustedHTML(dirty) : dirty;
    if (NAMESPACE === HTML_NAMESPACE) try {
      doc = new DOMParser().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
    } catch (_) {
    }
    if (!doc || !doc.documentElement) {
      doc = implementation.createDocument(NAMESPACE, "template", null);
      try {
        doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
      } catch (_) {
      }
    }
    const body = doc.body || doc.documentElement;
    if (dirty && leadingWhitespace) body.insertBefore(document2.createTextNode(leadingWhitespace), body.childNodes[0] || null);
    if (NAMESPACE === HTML_NAMESPACE) return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
    return WHOLE_DOCUMENT ? doc.documentElement : body;
  };
  const _createNodeIterator = function _createNodeIterator2(root) {
    const doc = getOwnerDocument ? getOwnerDocument(root) : root.ownerDocument;
    return createNodeIterator.call(doc || root, root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION, null);
  };
  const _stripTemplateExpressions = function _stripTemplateExpressions2(value) {
    value = stringReplace(value, MUSTACHE_EXPR$1, " ");
    value = stringReplace(value, ERB_EXPR$1, " ");
    value = stringReplace(value, TMPLIT_EXPR$1, " ");
    return value;
  };
  const _scrubTemplateExpressions2 = function _scrubTemplateExpressions(node) {
    var _node$querySelectorAl;
    _scrubOwnCharacterData(node);
    const templates = (_node$querySelectorAl = node.querySelectorAll) === null || _node$querySelectorAl === void 0 ? void 0 : _node$querySelectorAl.call(node, "template");
    if (templates) arrayForEach(templates, (tmpl) => {
      if (_isDocumentFragment(tmpl.content)) _scrubTemplateExpressions2(tmpl.content);
    });
  };
  const _scrubOwnCharacterData = function _scrubOwnCharacterData2(node) {
    node.normalize();
    const doc = getOwnerDocument ? getOwnerDocument(node) : node.ownerDocument;
    const walker = createNodeIterator.call(doc || node, node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_PROCESSING_INSTRUCTION, null);
    let currentNode = walker.nextNode();
    while (currentNode) {
      currentNode.data = _stripTemplateExpressions(currentNode.data);
      currentNode = walker.nextNode();
    }
  };
  const _isClobbered = function _isClobbered2(element) {
    const realTagName = getNodeName ? getNodeName(element) : null;
    if (typeof realTagName !== "string") return false;
    if (transformCaseFunc(realTagName) !== "form") return false;
    return typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || element.attributes !== getAttributes(element) || typeof element.removeAttribute !== "function" || typeof element.removeAttributeNode !== "function" || typeof element.getAttributeNode !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function" || element.nodeType !== getNodeType(element) || element.childNodes !== getChildNodes(element);
  };
  const _isDocumentFragment = function _isDocumentFragment2(value) {
    if (!getNodeType || typeof value !== "object" || value === null) return false;
    try {
      return getNodeType(value) === NODE_TYPE.documentFragment;
    } catch (_) {
      return false;
    }
  };
  const _isNode = function _isNode2(value) {
    if (!getNodeType || typeof value !== "object" || value === null) return false;
    try {
      return typeof getNodeType(value) === "number";
    } catch (_) {
      return false;
    }
  };
  function _executeHooks(hooks2, currentNode, data) {
    if (hooks2.length === 0) return;
    arrayForEach(hooks2, (hook) => {
      hook.call(DOMPurify, currentNode, data, CONFIG);
    });
  }
  const _isUnsafeNode = function _isUnsafeNode2(currentNode, tagName) {
    if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.textContent) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.innerHTML)) return true;
    if (SAFE_FOR_XML && LITERAL_TEXT_ELEMENTS[tagName] && _readNodeType(currentNode) === NODE_TYPE.element && _readNamespaceURI(currentNode) === HTML_NAMESPACE && (_isNode(currentNode.firstElementChild) || typeof currentNode.textContent === "string" && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.textContent))) return true;
    if (currentNode.nodeType === NODE_TYPE.processingInstruction) return true;
    if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, currentNode.data)) return true;
    return false;
  };
  const _matchesNameCheck = function _matchesNameCheck2(check, name) {
    if (check instanceof RegExp) return regExpTest(check, name);
    if (check instanceof Function) {
      for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) args[_key - 2] = arguments[_key];
      return Boolean(check(name, ...args));
    }
    return false;
  };
  const _sanitizeDisallowedNode = function _sanitizeDisallowedNode2(currentNode, tagName, root) {
    if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) return false;
    if (KEEP_CONTENT && !FORBID_CONTENTS[tagName] && !FORBID_CONTENTS[stringToLowerCase(tagName)]) {
      const parentNode = getParentNode(currentNode);
      const childNodes = getChildNodes(currentNode);
      if (childNodes && parentNode) {
        const childCount = childNodes.length;
        for (let i = childCount - 1; i >= 0; --i) {
          const hoisted = currentNode === root ? cloneNode(childNodes[i], true) : childNodes[i];
          parentNode.insertBefore(hoisted, getNextSibling(currentNode));
        }
      }
    }
    _forceRemove(currentNode);
    return true;
  };
  const _forkSharedAllowlist = function _forkSharedAllowlist2(hookList, set, defaultSet, setConfigSet) {
    if (hookList.length === 0) return set;
    return set === defaultSet || set === setConfigSet ? clone(set) : set;
  };
  const _handleHookDetachedNode = function _handleHookDetachedNode2(currentNode, root) {
    if (currentNode === root || getParentNode(currentNode) !== null) return false;
    if (IN_PLACE) _neutralizeSubtree(currentNode);
    return true;
  };
  const _sanitizeElements = function _sanitizeElements2(currentNode, root) {
    _markVisited(currentNode);
    _executeHooks(hooks.beforeSanitizeElements, currentNode, null);
    if (_handleHookDetachedNode(currentNode, root)) return true;
    if (_isClobbered(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    const tagName = transformCaseFunc(_readNodeName(currentNode));
    ALLOWED_TAGS = _forkSharedAllowlist(hooks.uponSanitizeElement, ALLOWED_TAGS, DEFAULT_ALLOWED_TAGS, SET_CONFIG_ALLOWED_TAGS);
    _executeHooks(hooks.uponSanitizeElement, currentNode, {
      tagName,
      allowedTags: ALLOWED_TAGS
    });
    if (_handleHookDetachedNode(currentNode, root)) return true;
    if (_isUnsafeNode(currentNode, tagName)) {
      _forceRemove(currentNode);
      return true;
    }
    if (FORBID_TAGS[tagName] || !(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && !ALLOWED_TAGS[tagName]) {
      const removed = _sanitizeDisallowedNode(currentNode, tagName, root);
      if (removed === false) {
        _executeHooks(hooks.afterSanitizeElements, currentNode, null);
        if (_handleHookDetachedNode(currentNode, root)) return true;
      }
      return removed;
    }
    if (_readNodeType(currentNode) === NODE_TYPE.element && !_checkValidNamespace(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(FALLBACK_TAG_CLOSE, currentNode.innerHTML)) {
      _forceRemove(currentNode);
      return true;
    }
    if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
      const content = _stripTemplateExpressions(currentNode.textContent);
      if (currentNode.textContent !== content) {
        arrayPush(DOMPurify.removed, { element: currentNode.cloneNode() });
        currentNode.textContent = content;
      }
    }
    _executeHooks(hooks.afterSanitizeElements, currentNode, null);
    return _handleHookDetachedNode(currentNode, root);
  };
  const _isValidAttribute = function _isValidAttribute2(lcTag, lcName, value) {
    if (FORBID_ATTR[lcName]) return false;
    if (_isPatchLinkageAttribute(lcName, lcTag)) return false;
    if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document2 || value in formElement)) return false;
    const nameIsPermitted = ALLOWED_ATTR[lcName] || EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag);
    if (ALLOW_DATA_ATTR && regExpTest(DATA_ATTR$1, lcName)) return true;
    if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$1, lcName)) return true;
    if (!nameIsPermitted) return _isBasicCustomElement(lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName, lcTag) || lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value);
    if (URI_SAFE_ATTRIBUTES[lcName]) return true;
    if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) return true;
    if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) return true;
    if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) return true;
    return !value;
  };
  const RESERVED_CUSTOM_ELEMENT_NAMES = addToSet({}, [
    "annotation-xml",
    "color-profile",
    "font-face",
    "font-face-format",
    "font-face-name",
    "font-face-src",
    "font-face-uri",
    "missing-glyph"
  ]);
  const _isBasicCustomElement = function _isBasicCustomElement2(tagName) {
    return !RESERVED_CUSTOM_ELEMENT_NAMES[stringToLowerCase(tagName)] && regExpTest(CUSTOM_ELEMENT$1, tagName);
  };
  const _applyTrustedTypesToAttribute = function _applyTrustedTypesToAttribute2(lcTag, lcName, namespaceURI, value) {
    if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function" && !namespaceURI) switch (trustedTypes.getAttributeType(lcTag, lcName)) {
      case "TrustedHTML":
        return _createTrustedHTML(value);
      case "TrustedScriptURL":
        return _createTrustedScriptURL(value);
    }
    return value;
  };
  const _setAttributeValue = function _setAttributeValue2(currentNode, name, namespaceURI, value) {
    try {
      if (namespaceURI) currentNode.setAttributeNS(namespaceURI, name, value);
      else currentNode.setAttribute(name, value);
      if (_isClobbered(currentNode)) {
        _forceRemove(currentNode);
        return false;
      }
      return true;
    } catch (_) {
      _removeAttribute(name, currentNode);
      return false;
    }
  };
  const _isUnsafeAttributeValue = function _isUnsafeAttributeValue2(name, value) {
    if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, value)) return true;
    return stringToLowerCase(name) === "attributename" && stringMatch(value, "href") !== null;
  };
  const _sanitizeAttributes = function _sanitizeAttributes2(currentNode, root) {
    _executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
    if (_handleHookDetachedNode(currentNode, root)) return;
    const attributes = currentNode.attributes;
    if (!attributes || _isClobbered(currentNode)) return;
    ALLOWED_ATTR = _forkSharedAllowlist(hooks.uponSanitizeAttribute, ALLOWED_ATTR, DEFAULT_ALLOWED_ATTR, SET_CONFIG_ALLOWED_ATTR);
    const hookEvent = {
      attrName: "",
      attrValue: "",
      keepAttr: true,
      allowedAttributes: ALLOWED_ATTR,
      forceKeepAttr: void 0
    };
    let l = attributes.length;
    const lcTag = transformCaseFunc(currentNode.nodeName);
    while (l--) {
      const attr = attributes[l];
      const name = attr.name, namespaceURI = attr.namespaceURI, attrValue = attr.value;
      const lcName = transformCaseFunc(name);
      const initValue = attrValue;
      let value = name === "value" ? initValue : stringTrim(initValue);
      let recreatedNamedProp = false;
      hookEvent.attrName = lcName;
      hookEvent.attrValue = value;
      hookEvent.keepAttr = true;
      hookEvent.forceKeepAttr = void 0;
      _executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
      value = hookEvent.attrValue;
      if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name") && stringIndexOf(value, SANITIZE_NAMED_PROPS_PREFIX) !== 0) {
        _removeAttribute(name, currentNode, attr);
        value = SANITIZE_NAMED_PROPS_PREFIX + value;
        recreatedNamedProp = true;
      }
      if (_isUnsafeAttributeValue(name, value)) {
        _removeAttribute(name, currentNode, attr);
        continue;
      }
      if (hookEvent.forceKeepAttr) continue;
      if (!hookEvent.keepAttr) {
        _removeAttribute(name, currentNode, attr);
        continue;
      }
      if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(SELF_CLOSING_TAG, value)) {
        _removeAttribute(name, currentNode, attr);
        continue;
      }
      if (SAFE_FOR_TEMPLATES) value = _stripTemplateExpressions(value);
      if (!_isValidAttribute(lcTag, lcName, value)) {
        _removeAttribute(name, currentNode, attr);
        continue;
      }
      value = _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value);
      if (value !== initValue) {
        if (_setAttributeValue(currentNode, name, namespaceURI, value) && recreatedNamedProp) arrayPop(DOMPurify.removed);
      }
    }
    _executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
    _handleHookDetachedNode(currentNode, root);
  };
  const _sanitizeShadowDOM2 = function _sanitizeShadowDOM(fragment) {
    let shadowNode = null;
    const shadowIterator = _createNodeIterator(fragment);
    _executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
    while (shadowNode = shadowIterator.nextNode()) {
      _executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
      _sanitizeElements(shadowNode, fragment);
      _sanitizeAttributes(shadowNode, fragment);
      if (_isDocumentFragment(shadowNode.content)) _sanitizeShadowDOM2(shadowNode.content);
      if (_readNodeType(shadowNode) === NODE_TYPE.element) {
        const innerSr = getShadowRoot(shadowNode);
        if (_isDocumentFragment(innerSr)) {
          _sanitizeAttachedShadowRoots(innerSr);
          _sanitizeShadowDOM2(innerSr);
        }
      }
    }
    if (SAFE_FOR_TEMPLATES) _scrubOwnCharacterData(fragment);
    _executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
  };
  const _sanitizeAttachedShadowRoots = function _sanitizeAttachedShadowRoots2(root) {
    const stack = [{
      node: root,
      shadow: null
    }];
    while (stack.length > 0) {
      const item = stack.pop();
      if (item.shadow) {
        _sanitizeShadowDOM2(item.shadow);
        continue;
      }
      const node = item.node;
      const isElement = _readNodeType(node) === NODE_TYPE.element;
      const childNodes = getChildNodes(node);
      if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push({
        node: childNodes[i],
        shadow: null
      });
      if (isElement) {
        const rootName = getNodeName ? getNodeName(node) : null;
        if (typeof rootName === "string" && transformCaseFunc(rootName) === "template") {
          const content = node.content;
          if (_isDocumentFragment(content)) stack.push({
            node: content,
            shadow: null
          });
        }
      }
      if (isElement) {
        const sr = getShadowRoot(node);
        if (_isDocumentFragment(sr)) stack.push({
          node: null,
          shadow: sr
        }, {
          node: sr,
          shadow: null
        });
      }
    }
  };
  DOMPurify.sanitize = function(dirty) {
    let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    let body = null;
    let importedNode = null;
    let currentNode = null;
    let returnNode = null;
    IS_EMPTY_INPUT = !dirty;
    if (IS_EMPTY_INPUT) dirty = "<!-->";
    if (typeof dirty !== "string" && !_isNode(dirty)) {
      dirty = stringifyValue(dirty);
      if (typeof dirty !== "string") throw typeErrorCreate("dirty is not a string, aborting");
    }
    if (!DOMPurify.isSupported) return dirty;
    if (SET_CONFIG) {
      ALLOWED_TAGS = SET_CONFIG_ALLOWED_TAGS;
      ALLOWED_ATTR = SET_CONFIG_ALLOWED_ATTR;
    } else _parseConfig(cfg);
    if (hooks.uponSanitizeElement.length > 0 || hooks.uponSanitizeAttribute.length > 0) ALLOWED_TAGS = clone(ALLOWED_TAGS);
    if (hooks.uponSanitizeAttribute.length > 0) ALLOWED_ATTR = clone(ALLOWED_ATTR);
    DOMPurify.removed = [];
    const inPlace = IN_PLACE && typeof dirty !== "string" && _isNode(dirty);
    let inPlaceNodes = [];
    const outerVisited = IN_PLACE_VISITED;
    if (inPlace) {
      _neutralizePatchLinkage(dirty);
      const nn = _readNodeName(dirty);
      if (typeof nn === "string") {
        const tagName = transformCaseFunc(nn);
        if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
          _neutralizeRoot(dirty);
          throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
        }
      }
      if (_isClobbered(dirty)) {
        _neutralizeRoot(dirty);
        throw typeErrorCreate("root node is clobbered and cannot be sanitized in-place");
      }
      inPlaceNodes = _collectLiveNodes(dirty);
      IN_PLACE_VISITED = setCreate();
    } else if (_isNode(dirty)) {
      body = _initDocument("<!---->");
      importedNode = body.ownerDocument.importNode(dirty, true);
      if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") body = importedNode;
      else if (importedNode.nodeName === "HTML") body = importedNode;
      else body.appendChild(importedNode);
      _sanitizeAttachedShadowRoots(body);
    } else {
      if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && dirty.indexOf("<") === -1) return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(dirty) : dirty;
      body = _initDocument(dirty);
      if (!body) return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
    }
    if (body && FORCE_BODY) _forceRemove(body.firstChild);
    const walkRoot = inPlace ? dirty : body;
    try {
      if (inPlace) _sanitizeAttachedShadowRoots(dirty);
      const nodeIterator = _createNodeIterator(walkRoot);
      while (currentNode = nodeIterator.nextNode()) {
        _sanitizeElements(currentNode, walkRoot);
        _sanitizeAttributes(currentNode, walkRoot);
        if (_isDocumentFragment(currentNode.content)) _sanitizeShadowDOM2(currentNode.content);
      }
      if (inPlace) _sanitizeUnvisitedNodes(dirty, inPlaceNodes);
    } catch (error) {
      if (inPlace) {
        _neutralizeRoot(dirty);
        _neutralizeDiscarded(dirty, inPlaceNodes);
      }
      throw error;
    } finally {
      IN_PLACE_VISITED = outerVisited;
    }
    if (inPlace) {
      if (_neutralizeDiscarded(dirty, inPlaceNodes)) throw typeErrorCreate("a node selected for removal could not be safely returned; refusing to sanitize in place");
      if (SAFE_FOR_TEMPLATES) _scrubTemplateExpressions2(dirty);
      return dirty;
    }
    if (RETURN_DOM) {
      if (SAFE_FOR_TEMPLATES) _scrubTemplateExpressions2(body);
      if (RETURN_DOM_FRAGMENT) {
        returnNode = createDocumentFragment.call(body.ownerDocument);
        while (body.firstChild) returnNode.appendChild(body.firstChild);
      } else returnNode = body;
      if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) returnNode = importNode.call(originalDocument, returnNode, true);
      return returnNode;
    }
    let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
    if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + ">\n" + serializedHTML;
    if (SAFE_FOR_TEMPLATES) serializedHTML = _stripTemplateExpressions(serializedHTML);
    return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(serializedHTML) : serializedHTML;
  };
  DOMPurify.setConfig = function() {
    let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    _parseConfig(cfg);
    SET_CONFIG = true;
    SET_CONFIG_ALLOWED_TAGS = ALLOWED_TAGS;
    SET_CONFIG_ALLOWED_ATTR = ALLOWED_ATTR;
  };
  DOMPurify.clearConfig = function() {
    CONFIG = null;
    SET_CONFIG = false;
    SET_CONFIG_ALLOWED_TAGS = null;
    SET_CONFIG_ALLOWED_ATTR = null;
    trustedTypesPolicy = defaultTrustedTypesPolicy;
    emptyHTML = "";
  };
  DOMPurify.isValidAttribute = function(tag, attr, value) {
    if (!CONFIG) _parseConfig({});
    const lcTag = transformCaseFunc(tag);
    const lcName = transformCaseFunc(attr);
    if (typeof value === "string" && (_isUnsafeAttributeValue(attr, value) || !ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(SELF_CLOSING_TAG, value))) return false;
    return _isValidAttribute(lcTag, lcName, value);
  };
  DOMPurify.addHook = function(entryPoint, hookFunction) {
    if (typeof hookFunction !== "function") return;
    if (!objectHasOwnProperty(hooks, entryPoint)) return;
    arrayPush(hooks[entryPoint], hookFunction);
  };
  DOMPurify.removeHook = function(entryPoint, hookFunction) {
    if (!objectHasOwnProperty(hooks, entryPoint)) return;
    if (hookFunction !== void 0) {
      const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
      return index === -1 ? void 0 : arraySplice(hooks[entryPoint], index, 1)[0];
    }
    return arrayPop(hooks[entryPoint]);
  };
  DOMPurify.removeHooks = function(entryPoint) {
    if (!objectHasOwnProperty(hooks, entryPoint)) return;
    hooks[entryPoint] = [];
  };
  DOMPurify.removeAllHooks = function() {
    hooks = _createHooksMap();
  };
  return DOMPurify;
}
var purify_default = createDOMPurify();

// src/shared/veilige-html.js
function zetHtml(el, html2) {
  el.innerHTML = purify_default.sanitize(String(html2 == null ? "" : html2));
  return el;
}

// src/ui-inspector/index.js
var inspector = null;
function openInspector() {
  if (!inspector) inspector = maakInspector();
  inspector.open();
}
function maakInspector() {
  const OVERRIDE_KEY = LOCAL.UI_OVERRIDES;
  const PERSIST_KEY = LOCAL.INSPECTOR_OPEN;
  function setPersist(v) {
    try {
      chrome.storage.local.set({ [PERSIST_KEY]: v });
    } catch (e) {
    }
  }
  let overrides = {};
  try {
    if (chrome && chrome.storage && chrome.storage.local) chrome.storage.local.get([OVERRIDE_KEY], (r) => {
      overrides = r && r[OVERRIDE_KEY] || {};
    });
  } catch (e) {
  }
  function deepQueryAll(selector) {
    const out = [], seen = /* @__PURE__ */ new Set();
    const walk = (root2) => {
      if (!root2 || seen.has(root2)) return;
      seen.add(root2);
      try {
        out.push.apply(out, root2.querySelectorAll(selector));
      } catch (e) {
        return;
      }
      let all;
      try {
        all = root2.querySelectorAll("*");
      } catch (e) {
        return;
      }
      for (const el of all) if (el.shadowRoot) walk(el.shadowRoot);
    };
    walk(document);
    try {
      for (const fr of document.querySelectorAll("iframe,frame")) {
        try {
          if (fr.contentDocument) walk(fr.contentDocument);
        } catch (e) {
        }
      }
    } catch (e) {
    }
    return out;
  }
  function norm(s) {
    return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase();
  }
  function vis(el) {
    try {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
    } catch (e) {
      return false;
    }
  }
  function inOwnUi(el) {
    return !!(root && root.contains(el));
  }
  function controlsUnderLabel(labelTexts, controlSel) {
    const want = (Array.isArray(labelTexts) ? labelTexts : [labelTexts]).map(norm);
    const out = [], seen = /* @__PURE__ */ new Set();
    deepQueryAll("label,div,span,p").forEach((lb) => {
      if (inOwnUi(lb) || !vis(lb) || want.indexOf(norm(lb.textContent)) < 0) return;
      let lr;
      try {
        lr = lb.getBoundingClientRect();
      } catch (e) {
        return;
      }
      deepQueryAll(controlSel).forEach((c) => {
        if (inOwnUi(c) || seen.has(c) || !vis(c)) return;
        let cr;
        try {
          cr = c.getBoundingClientRect();
        } catch (e) {
          return;
        }
        if (cr.top >= lr.bottom - 14 && cr.top <= lr.bottom + 100 && Math.abs(cr.left - lr.left) <= 140) {
          seen.add(c);
          out.push(c);
        }
      });
    });
    return out;
  }
  function controlsByHint(re, sel) {
    return deepQueryAll(sel).filter((el) => {
      if (inOwnUi(el) || !vis(el)) return false;
      const hay = [el.getAttribute && el.getAttribute("placeholder"), el.getAttribute && el.getAttribute("aria-label"), el.getAttribute && el.getAttribute("title"), el.textContent].map(norm).join(" ");
      return re.test(hay);
    });
  }
  const CTRL = 'uc-select,uc-multi-select,ue-activity-select,[role="combobox"],input,select,[class*="select" i]';
  function isLocationCtrl(el) {
    try {
      const dq = el.getAttribute && el.getAttribute("data-qa");
      if (dq && /location|locatie/i.test(dq)) return true;
      const al = el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("aria-description")) || "";
      if (/locatie|location/i.test(al)) return true;
      if (/zoek naar locaties/.test(norm(el.textContent))) return true;
    } catch (e) {
    }
    return false;
  }
  function controlsByText(texts, sel, exclude) {
    const want = texts.map(norm);
    return deepQueryAll(sel).filter((el) => !inOwnUi(el) && vis(el) && !(exclude && exclude(el)) && want.some((w) => norm(el.textContent).indexOf(w) >= 0));
  }
  function nearestUnderLabel(labelTexts, sel, exclude) {
    const all = controlsUnderLabel(labelTexts, sel).filter((el) => !(exclude && exclude(el)));
    all.sort((a, b) => {
      try {
        return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
      } catch (e) {
        return 0;
      }
    });
    return all.length ? [all[0]] : [];
  }
  const labelsMatcher = () => {
    const exact = controlsByText(["zoek naar labels", "zoek naar etiketten"], CTRL, isLocationCtrl);
    if (exact.length) return exact;
    const near = nearestUnderLabel(["labels", "label", "etiket", "etiketten"], CTRL, isLocationCtrl);
    if (near.length) return near;
    return controlsByHint(/label|etiket/, CTRL).filter((el) => !isLocationCtrl(el));
  };
  const uursoortMatcher = () => {
    const fixed = deepQueryAll('uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"], [data-qa="hour_type_select"], [role="combobox"][aria-label="Uursoort"]').filter((el) => vis(el) && !inOwnUi(el) && !isLocationCtrl(el));
    if (fixed.length) return fixed;
    const exact = controlsByText(["zoek naar uursoorten"], CTRL, isLocationCtrl);
    if (exact.length) return exact;
    const near = nearestUnderLabel(["uursoort", "uursoorten", "hour type"], CTRL, isLocationCtrl);
    return near.length ? near : controlsByHint(/uursoort|hour type/, CTRL).filter((el) => !isLocationCtrl(el));
  };
  const clientNameMatcher = () => deepQueryAll('ul[data-qa="selected_clients"] [class*="_invitee-name_"], ul[class*="_selected-clients_"] [class*="_invitee-name_"]').filter((el) => vis(el) && !inOwnUi(el));
  const addButtonMatcher = () => {
    const cands = deepQueryAll("uc-button, button").filter((el) => {
      if (inOwnUi(el) || !vis(el)) return false;
      const hasAdd = el.querySelector && el.querySelector('uc-icon[icon="add"], [icon="add"]') || el.shadowRoot && el.shadowRoot.querySelector && el.shadowRoot.querySelector('uc-icon[icon="add"], [icon="add"]');
      return /(^|[^a-z])toevoegen([^a-z]|$)/.test(norm(el.textContent)) || !!hasAdd;
    });
    const withText = cands.filter((el) => /(^|[^a-z])toevoegen([^a-z]|$)/.test(norm(el.textContent)));
    let base = withText.length ? withText : cands;
    if (modalIsOpen()) {
      const modals = deepQueryAll('dialog[open], uc-modal, [role="dialog"]').filter((m) => vis(m) && !inOwnUi(m));
      base = base.filter((el) => modals.some((m) => {
        try {
          return m.contains(el);
        } catch (e) {
          return false;
        }
      }));
    }
    return base;
  };
  function inputsUnderLabelText(labelTexts, sel) {
    const want = (Array.isArray(labelTexts) ? labelTexts : [labelTexts]).map(norm);
    const out = [], seen = /* @__PURE__ */ new Set();
    deepQueryAll("label,div,span,p").forEach((lb) => {
      if (inOwnUi(lb) || !vis(lb) || want.indexOf(norm(lb.textContent)) < 0) return;
      let lr;
      try {
        lr = lb.getBoundingClientRect();
      } catch (e) {
        return;
      }
      deepQueryAll(sel).forEach((c) => {
        if (inOwnUi(c) || seen.has(c) || !vis(c)) return;
        let cr;
        try {
          cr = c.getBoundingClientRect();
        } catch (e) {
          return;
        }
        if (cr.top >= lr.bottom - 18 && cr.top <= lr.bottom + 120 && Math.abs(cr.left - lr.left) <= 240) {
          seen.add(c);
          out.push(c);
        }
      });
    });
    return out;
  }
  const beginTimeMatcher = () => {
    const h = deepQueryAll('uc-time-input[aria-label^="Begintijd" i]').filter((el) => vis(el) && !inOwnUi(el));
    return h.length ? h : inputsUnderLabelText(["begintijd", "begintijd*"], 'input[placeholder="uu:mm"]');
  };
  const eindTimeMatcher = () => {
    const h = deepQueryAll('uc-time-input[aria-label^="Eindtijd" i]').filter((el) => vis(el) && !inOwnUi(el));
    return h.length ? h : inputsUnderLabelText(["eindtijd", "eindtijd*"], 'input[placeholder="uu:mm"]');
  };
  const travelHeenMatcher = () => {
    const d = deepQueryAll('input[aria-label="Reistijd heen" i]').filter((el) => vis(el) && !inOwnUi(el));
    return d.length ? d : inputsUnderLabelText(["reistijd heen"], "input");
  };
  const travelTerugMatcher = () => {
    const d = deepQueryAll('input[aria-label="Reistijd terug" i]').filter((el) => vis(el) && !inOwnUi(el));
    return d.length ? d : inputsUnderLabelText(["reistijd terug"], "input");
  };
  const recurrenceHeaderMatcher = () => deepQueryAll("button[aria-expanded]").filter((b) => {
    if (inOwnUi(b) || !vis(b)) return false;
    let spans;
    try {
      spans = b.querySelectorAll("span");
    } catch (e) {
      return false;
    }
    for (const s of spans) if (norm(s.textContent) === "herhaling") return true;
    return false;
  });
  const HOOKS = [
    ["Agenda", "Dagkolom", ".day.js_day", "agDayColumn", "rel"],
    ["Agenda", "Dagkolom-cel", "td.calendar_day", "agDayCell", "rel"],
    ["Agenda", "Afspraak-blok", ".js_calendar_occurrence.calendar_occurrence_base", "agOccurrence", "rel"],
    ["Agenda", "Afspraak met titel", ".calendar_occurrence--has-title", "agOccurrenceTitle", "rel"],
    ["Agenda", "Afspraak-titel", ".appointment-title", "agApptTitle", "rel"],
    ["Agenda", "Label met title-attr", ".labels .label[title]", "agLabelTitle", "rel"],
    ["Agenda", "Detailpopup", '[data-qa="occurrence-popover"]', "agPopover", "rel"],
    ["Agenda", "Labelchip in detailpopup", ".labels uc-tag", "agPopoverLabel", "rel"],
    ["Agenda", "Registreren-knop in detailpopup", '[data-qa="occurrence-popover-primary"]', "agDeclare", "rel"],
    ["Agenda", "Status-vlag", "[data-status]"],
    ["Afspraak (modal)", "Modal / dialog", 'uc-modal,[role="dialog"],dialog', "modalPanelSelector"],
    ["Afspraak (modal)", "Uursoort-veld", uursoortMatcher, "uursoortFieldSelector"],
    ["Afspraak (modal)", "Labels-veld", labelsMatcher, "etiketFieldSelector"],
    ["Afspraak (modal)", "Labels-chips (verwijderknoppen)", 'button[aria-label^="Verwijder label" i], [data-qa="label_tags"] button', "afsLabelChips", "rel"],
    ["Afspraak (modal)", "Toevoegen-knop", addButtonMatcher],
    ["Afspraak (modal)", "Cliëntlijst", 'ul[class*="_selected-clients_"] > li, ul[data-qa="selected_clients"] > li, [data-qa="selected_clients"]', "afsClientList", "rel"],
    ["Afspraak (modal)", "Cliëntnaam", clientNameMatcher, "afsClientName", "rel"],
    ["Afspraak (modal)", "Uitklap-cliëntvelden", '[data-qa="toggle-invitee-fields-button"]', "afsInviteeToggle", "rel"],
    ["Afspraak (modal)", "Datumveld", 'uc-date-input[aria-label="Datum*"], uc-date-input[aria-label="Datum"]', "afsDatum"],
    ["Afspraak (modal)", "Begintijd", beginTimeMatcher, "afsBegintijd"],
    ["Afspraak (modal)", "Eindtijd", eindTimeMatcher, "afsEindtijd"],
    ["Afspraak (modal)", "Reistijd heen", travelHeenMatcher, "afsTravelBefore"],
    ["Afspraak (modal)", "Reistijd terug", travelTerugMatcher, "afsTravelAfter"],
    ["Afspraak (modal)", "Titelveld", 'input[aria-label*="Titel" i], input[name*="title" i]', "afsTitel"],
    ["Afspraak (modal)", "Sluitknop", 'uc-button[aria-label*="sluit" i], button[aria-label*="sluit" i]', "afsCloseButton"],
    ["Afspraak (modal)", "Opslaan/submit", 'button[type="submit"], uc-button[type="submit"]', "afsOpslaan"],
    ["Afspraak (modal)", "Herhaling-kop (doorplannen)", recurrenceHeaderMatcher, "recurrenceHeader"],
    ["Afspraak (modal)", "Herhaling-keuze (type)", '[data-qa="recurrence-type"]', "recurrenceType"],
    ["Registratie", "Cliënt-formulier", "div.client_form[data-invitee-id]"],
    ["Registratie", "Uursoort-veld", 'select[id*="hour_type"], [data-qa="hour_type_select"]'],
    ["Registratie", "Verplichte rij", "tr.required"],
    ["Registratie", "Begintijd", '#declaration_start_time_display, input[name*="start_time" i]', "regStart"],
    ["Registratie", "Eindtijd", '#declaration_end_time_display, input[name*="end_time" i]', "regEnd"],
    ["Registratie", "Directe tijd", '#declaration_direct_time, input[name*="direct_time" i]:not([name*="indirect" i])', "regDirect"],
    ["Registratie", "Indirecte tijd", '#declaration_indirect_time, input[name*="indirect_time" i]', "regIndirect"],
    ["Registratie", "Reistijd heen", '#declaration_travel_time_before, input[name*="travel_time_before" i]', "regTravelBefore"],
    ["Registratie", "Reistijd terug", '#declaration_travel_time_after, input[name*="travel_time_after" i]', "regTravelAfter"],
    ["Registratie", "Reistijd toevoegen", "#js_add_travel_time", "regTravelAdd"],
    ["Registratie", "Rapportageveld", '[id$="__dossier_report_comment"], textarea[id*="report_comment" i], textarea[name*="report" i]', "regReport"],
    ["Registratie", "select2 wisknop", ".select2-selection__clear"],
    ["Vragenlijst", "Survey-titel", '[data-survey-title], [data-react-component="SurveyResultHeader"][data-props]', "surveyTitleSelector"],
    ["Vragenlijst", "Vraag", ".survey_question, tr.required", "surveyQuestionSelector", "rel"],
    ["Vragenlijst", "Leeftijd (cliënt) → {clientLeeftijd}", '[data-testid*="birthdate" i], [class*="birthdate" i], [datetime], [aria-label*="geboorte" i]', "surveyAgeSelector"],
    ["Vragenlijst", "Vraagtekst (alle vragen) → {vraag}", ".question-text", "surveyQuestionTextSelector", "rel"],
    ["Vragenlijst", "Naam (cliënt) → {clientNaam}", '.base-card__name-tags, [data-testid="client-details-name"], [data-testid="client-name"], .client-name', "surveyClientNameSelector"],
    ["Vragenlijst", "Volgende status", 'button[title="Volgende status"], button[aria-label="Volgende status"]', "surveyNextStatusSelector"]
  ];
  const C = { ok: "#1e8449", miss: "#c0392b", pick: "#cc087d" };
  let highlightsOn = true, onlyMissing = false, pickHook = null, root = null, panel = null, ov = null, refreshTimer = null, rowUpdaters = [];
  let moObserver = null, domDirty = true, lastFull = 0;
  function css(el, s) {
    Object.assign(el.style, s);
    return el;
  }
  function overrideSel(h) {
    return h[3] && overrides[h[3]] ? overrides[h[3]] : null;
  }
  function matches(h) {
    const o = overrideSel(h);
    try {
      if (o) return deepQueryAll(o);
      if (typeof h[2] === "function") return h[2]() || [];
      return deepQueryAll(h[2]);
    } catch (e) {
      return [];
    }
  }
  function visEls(h) {
    return matches(h).filter((el) => !inOwnUi(el) && vis(el));
  }
  function defaultEls(h) {
    try {
      const r = typeof h[2] === "function" ? h[2]() || [] : deepQueryAll(h[2]);
      return r.filter((el) => !inOwnUi(el) && vis(el));
    } catch (e) {
      return [];
    }
  }
  const PW = 380;
  function setDock(on) {
    const de = document.documentElement;
    try {
      if (on) {
        de.style.setProperty("width", "calc(100vw - " + PW + "px)", "important");
        de.style.setProperty("min-width", "0", "important");
        de.style.setProperty("max-width", "calc(100vw - " + PW + "px)", "important");
        de.style.setProperty("overflow-x", "hidden", "important");
        de.style.setProperty("transform", "translateZ(0)", "important");
        de.style.setProperty("transform-origin", "top left", "important");
      } else {
        ["width", "min-width", "max-width", "overflow-x", "transform", "transform-origin"].forEach((p) => de.style.removeProperty(p));
      }
    } catch (e) {
    }
  }
  function hostFor() {
    try {
      const d = deepQueryAll("dialog[open]").filter((x) => vis(x));
      if (d.length) return d[d.length - 1];
    } catch (e) {
    }
    return document.body;
  }
  function modalIsOpen() {
    try {
      return deepQueryAll('dialog[open], uc-modal, [role="dialog"]').some((x) => vis(x) && !inOwnUi(x));
    } catch (e) {
      return false;
    }
  }
  function reattachIfNeeded() {
    if (!root) return;
    const host = hostFor();
    if (root.parentNode !== host) {
      try {
        root.hidePopover();
      } catch (e) {
      }
      host.appendChild(root);
      try {
        root.showPopover();
      } catch (e) {
      }
    } else if (!root.isConnected) {
      document.body.appendChild(root);
      try {
        root.showPopover();
      } catch (e) {
      }
    }
  }
  function ensureRoot() {
    if (root && root.isConnected) {
      setDock(true);
      reattachIfNeeded();
      return;
    }
    setDock(true);
    root = document.createElement("div");
    root.id = "__ons-ins-root";
    try {
      root.setAttribute("popover", "manual");
    } catch (e) {
    }
    css(root, { position: "fixed", inset: "0", width: "100vw", height: "100vh", maxWidth: "none", maxHeight: "none", margin: "0", padding: "0", border: "0", background: "transparent", overflow: "visible", pointerEvents: "none", zIndex: "2147483646" });
    ov = document.createElement("div");
    ov.style.pointerEvents = "none";
    root.appendChild(ov);
    hostFor().appendChild(root);
    try {
      root.showPopover();
    } catch (e) {
    }
  }
  function removeRoot() {
    setDock(false);
    if (root) {
      try {
        root.hidePopover();
      } catch (e) {
      }
      root.remove();
      root = null;
      ov = null;
      panel = null;
    }
  }
  function drawHighlights() {
    if (!ov) return;
    ov.innerHTML = "";
    if (!highlightsOn) return;
    const mOpen = modalIsOpen();
    HOOKS.forEach((h) => {
      if (mOpen && h[0] === "Agenda") return;
      const els = visEls(h).slice(0, 40);
      const over = !!overrideSel(h);
      els.forEach((el, idx) => {
        let r;
        try {
          r = el.getBoundingClientRect();
        } catch (e) {
          return;
        }
        if (!r || r.width === 0 && r.height === 0) return;
        const primary = idx === 0;
        const col = over ? C.pick : C.ok;
        const b = document.createElement("div");
        css(b, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", border: (primary ? "2px solid " : "2px dashed ") + col, borderRadius: "3px", background: primary ? "rgba(30,132,73,.10)" : "transparent", opacity: primary ? "1" : ".5", pointerEvents: "none", boxSizing: "border-box" });
        const t = document.createElement("div");
        t.textContent = h[1] + (primary && els.length > 1 ? " ★" : "");
        css(t, { position: "absolute", top: "-15px", left: "0", font: '10px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: "#fff", background: col, padding: "1px 4px", borderRadius: "3px", whiteSpace: "nowrap", opacity: primary ? "1" : ".7" });
        b.appendChild(t);
        ov.appendChild(b);
      });
    });
  }
  function flash(h) {
    const el = visEls(h)[0];
    if (!el) {
      setStatus("Niet op dit scherm.");
      return;
    }
    try {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch (e) {
    }
    setTimeout(() => {
      let r;
      try {
        r = el.getBoundingClientRect();
      } catch (e) {
        return;
      }
      const f = document.createElement("div");
      css(f, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", border: "3px solid " + C.pick, borderRadius: "4px", pointerEvents: "none", transition: "opacity .8s", opacity: "1" });
      ov.appendChild(f);
      setTimeout(() => {
        f.style.opacity = "0";
      }, 500);
      setTimeout(() => f.remove(), 1400);
      drawHighlights();
    }, 260);
  }
  function pickTarget(e) {
    try {
      const p = e.composedPath && e.composedPath();
      if (p && p.length && p[0] && p[0].nodeType === 1) return p[0];
    } catch (ex) {
    }
    return e.target;
  }
  function buildSelector(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return "#" + el.id;
    const tag = el.tagName.toLowerCase();
    try {
      if (/-/.test(tag) && deepQueryAll(tag).length === 1) return tag;
    } catch (ex) {
    }
    for (const a of ["data-qa", "aria-label", "name", "placeholder", "icon", "title"]) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) {
        const s = tag + "[" + a + '="' + String(v).replace(/"/g, '\\"') + '"]';
        if (deepQueryAll(s).length === 1) return s;
      }
    }
    const cls = el.className && typeof el.className === "string" ? el.className.trim().split(/\s+/).filter((c) => /^[A-Za-z][\w-]*$/.test(c)) : [];
    if (cls.length) {
      const s = tag + "." + cls.slice(0, 3).join(".");
      if (deepQueryAll(s).length === 1) return s;
    }
    let node = el, parts = [];
    while (node && node.nodeType === 1 && parts.length < 4) {
      let s = node.tagName.toLowerCase();
      const p = node.parentElement;
      if (p) {
        const sib = [...p.children].filter((c) => c.tagName === node.tagName);
        if (sib.length > 1) s += ":nth-of-type(" + (sib.indexOf(node) + 1) + ")";
      }
      parts.unshift(s);
      node = p;
    }
    return parts.join(" > ");
  }
  function buildClassSelector(el) {
    if (!el || el.nodeType !== 1) return "";
    const cls = el.className && typeof el.className === "string" ? el.className.trim().split(/\s+/).filter((c) => /^[A-Za-z][\w-]*$/.test(c)) : [];
    if (cls.length) return "." + cls.slice(0, 3).join(".");
    for (const a of ["data-qa", "data-testid", "aria-label"]) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) return el.tagName.toLowerCase() + "[" + a + '="' + String(v).replace(/"/g, '\\"') + '"]';
    }
    return el.tagName.toLowerCase();
  }
  function inShadow(el) {
    try {
      const rn = el.getRootNode && el.getRootNode();
      return !!(rn && rn.nodeType === 11 && rn.host);
    } catch (e) {
      return false;
    }
  }
  function isIconLeaf(el) {
    const tag = el && el.tagName ? el.tagName.toLowerCase() : "";
    return /^(svg|path|use|g|polygon|polyline|circle|ellipse|rect|line)$/.test(tag);
  }
  function customHostAncestor(el) {
    let n = el;
    for (let i = 0; n && i < 8; i++) {
      const rn = n.getRootNode && n.getRootNode();
      if (rn && rn.nodeType === 11 && rn.host) {
        n = rn.host;
        const tag = (n.tagName || "").toLowerCase();
        if (/-/.test(tag)) return n;
        continue;
      }
      break;
    }
    return null;
  }
  function _elemIdentity(n) {
    return n && n.getAttribute && (n.getAttribute("data-qa") || n.getAttribute("data-testid") || n.getAttribute("aria-label") || n.id && /^[A-Za-z][\w-]*$/.test(n.id));
  }
  function resolveMeaningfulTarget(el) {
    if (!el || el.nodeType !== 1) return el;
    if (!_elemIdentity(el) && inShadow(el)) {
      const host = customHostAncestor(el);
      if (host) return host;
    }
    if (!isIconLeaf(el)) return el;
    let n = el;
    for (let i = 0; n && n.nodeType === 1 && i < 6; i++) {
      const tag = n.tagName.toLowerCase();
      if (_elemIdentity(n)) return n;
      if (/^(button|a)$/.test(tag) || n.getAttribute && n.getAttribute("role") === "button") return n;
      if (/-/.test(tag) && !isIconLeaf(n)) return n;
      const parent = n.parentElement || n.getRootNode && n.getRootNode().host;
      if (!parent) break;
      n = parent;
    }
    return el.parentElement || el;
  }
  function selectorInfo(sel, el) {
    if (!sel) return { count: 0, brittle: false, shadow: false, invalid: false, empty: true };
    let list;
    try {
      list = deepQueryAll(sel).filter((x) => vis(x) && !inOwnUi(x));
    } catch (e) {
      return { count: -1, brittle: true, shadow: false, invalid: true };
    }
    const brittle = /nth-of-type/.test(sel) || / > /.test(sel);
    const shadow = el ? inShadow(el) && list.length === 0 : false;
    return { count: list.length, brittle, shadow, invalid: false };
  }
  function saveOverride(k, s) {
    overrides[k] = s;
    try {
      chrome.storage.local.set({ [OVERRIDE_KEY]: overrides });
    } catch (e) {
    }
  }
  function clearOverride(k) {
    delete overrides[k];
    try {
      chrome.storage.local.set({ [OVERRIDE_KEY]: overrides });
    } catch (e) {
    }
  }
  function exportOverrides() {
    const payload = { uiSelectors: overrides || {} };
    const json = JSON.stringify(payload, null, 2);
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ui-selectors.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4e3);
      setStatus("ui-selectors.json geëxporteerd. Laad dit in het beheerscherm.");
    } catch (e) {
      try {
        navigator.clipboard.writeText(json);
        setStatus("Kon niet downloaden; JSON naar klembord gekopieerd.");
      } catch (e2) {
        setStatus("Export mislukt.");
      }
    }
  }
  let pickBox = null, pickBanner = null;
  function enterPick(h) {
    pickHook = h;
    if (panel) panel.style.display = "none";
    pickBanner = document.createElement("div");
    css(pickBanner, { position: "fixed", top: "0", left: "0", right: "0", padding: "12px", background: C.pick, color: "#fff", font: '700 14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', textAlign: "center", pointerEvents: "none" });
    pickBanner.textContent = "Klik het juiste element aan voor: " + h[1] + "   (Esc = annuleren)";
    ov.appendChild(pickBanner);
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
  }
  function exitPick() {
    pickHook = null;
    if (pickBox) {
      pickBox.remove();
      pickBox = null;
    }
    if (pickBanner) {
      pickBanner.remove();
      pickBanner = null;
    }
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    if (panel) panel.style.display = "";
    renderPanel();
    drawHighlights();
  }
  function inUi(el) {
    return panel && panel.contains(el) || root && root.contains(el);
  }
  function onMove(e) {
    const el = pickTarget(e);
    if (!el || inUi(el)) return;
    let r;
    try {
      r = el.getBoundingClientRect();
    } catch (ex) {
      return;
    }
    if (!pickBox) {
      pickBox = document.createElement("div");
      ov.appendChild(pickBox);
    }
    css(pickBox, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", border: "2px dashed " + C.pick, background: "rgba(204,8,125,.10)", pointerEvents: "none", boxSizing: "border-box" });
  }
  function onClick(e) {
    const raw = pickTarget(e);
    if (inUi(raw)) return;
    e.preventDefault();
    e.stopPropagation();
    const hook = pickHook;
    const tgt = resolveMeaningfulTarget(raw);
    const s = hook && hook[4] === "rel" ? buildClassSelector(tgt) : buildSelector(tgt);
    exitPick();
    if (s && hook && hook[3]) {
      pendingPick = { hook, selector: s, el: tgt };
      renderPanel();
    } else {
      setStatus("Kon geen bruikbare selector maken.");
    }
  }
  function onKey(e) {
    if (e.key === "Escape") {
      setStatusLater("Aanwijzen geannuleerd.");
      exitPick();
    }
  }
  let _pending = "";
  function setStatusLater(t) {
    _pending = t;
  }
  let pendingPick = null;
  function setStatus(t) {
    const s = panel && panel.querySelector(".__st");
    if (s) s.textContent = t;
  }
  function mini(txt, fn, primary) {
    const b = document.createElement("button");
    b.textContent = txt;
    css(b, { border: "1px solid " + (primary ? C.pick : "#ccc"), background: primary ? C.pick : "#fafafa", color: primary ? "#fff" : "#333", borderRadius: "6px", padding: "3px 8px", cursor: "pointer", font: '600 11px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' });
    b.onclick = (e) => {
      e.stopPropagation();
      fn();
    };
    return b;
  }
  function updateSummary() {
    if (!panel) return;
    let found = 0, total = 0;
    rowUpdaters.forEach((fn) => {
      total++;
      if (fn()) found++;
    });
    const sum = panel.querySelector(".__sum");
    if (sum) zetHtml(sum, '<span style="color:' + (found === total ? C.ok : "#b9770e") + '">' + found + " van " + total + "</span> hooks gevonden op dit scherm.");
  }
  function openPanel() {
    ensureRoot();
    try {
      if (chrome && chrome.storage && chrome.storage.local) chrome.storage.local.get([OVERRIDE_KEY], (r) => {
        overrides = r && r[OVERRIDE_KEY] || {};
        if (root && panel) {
          drawHighlights();
          renderPanel();
        }
      });
    } catch (e) {
    }
    panel = document.createElement("div");
    css(panel, { position: "fixed", top: "0", bottom: "0", left: "calc(100vw - " + PW + "px)", width: PW + "px", overflow: "auto", background: "#fff", color: "#222", borderLeft: "1px solid #ccc", boxShadow: "-6px 0 24px rgba(0,0,0,.15)", font: '13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', pointerEvents: "auto" });
    root.appendChild(panel);
    renderPanel();
    window.addEventListener("scroll", drawHighlights, true);
    window.addEventListener("resize", drawHighlights, true);
    drawHighlights();
    domDirty = true;
    lastFull = 0;
    try {
      moObserver = new MutationObserver(() => {
        domDirty = true;
      });
      moObserver.observe(document.documentElement, { subtree: true, childList: true });
    } catch (e) {
      moObserver = null;
    }
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (!root || pickHook) return;
      reattachIfNeeded();
      const now = Date.now();
      if (!domDirty && now - lastFull < 2e3) return;
      domDirty = false;
      lastFull = now;
      drawHighlights();
      updateSummary();
    }, 500);
    if (_pending) {
      setStatus(_pending);
      _pending = "";
    }
    setPersist(true);
  }
  function closePanel() {
    if (pickHook) exitPick();
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    if (moObserver) {
      try {
        moObserver.disconnect();
      } catch (e) {
      }
      moObserver = null;
    }
    window.removeEventListener("scroll", drawHighlights, true);
    window.removeEventListener("resize", drawHighlights, true);
    removeRoot();
    setPersist(false);
  }
  function renderPanel() {
    if (!panel) return;
    panel.innerHTML = "";
    rowUpdaters = [];
    let found = 0, total = 0;
    HOOKS.forEach((h) => {
      total++;
      if (visEls(h).length) found++;
    });
    const head = css(document.createElement("div"), { position: "sticky", top: "0", zIndex: "1", background: "#262229", color: "#fff", padding: "11px 13px", display: "flex", alignItems: "center", gap: "8px" });
    const title = document.createElement("div");
    zetHtml(title, "<b>UI-inspector</b>");
    title.style.flex = "1";
    const x = mini("Sluiten", closePanel);
    css(x, { border: "1px solid #fff6", background: "transparent", color: "#fff" });
    head.append(title, x);
    panel.appendChild(head);
    const body = css(document.createElement("div"), { padding: "11px 13px" });
    const sum = css(document.createElement("div"), { fontSize: "13px", fontWeight: "700", margin: "0 0 4px" });
    sum.className = "__sum";
    zetHtml(sum, '<span style="color:' + (found === total ? C.ok : "#b9770e") + '">' + found + " van " + total + "</span> hooks gevonden op dit scherm.");
    body.appendChild(sum);
    const live = css(document.createElement("div"), { fontSize: "10px", color: "#999", margin: "0 0 6px" });
    live.textContent = "↻ ververst automatisch elke 0,5 s";
    body.appendChild(live);
    const st = css(document.createElement("div"), { fontSize: "11px", color: "#666", minHeight: "14px", margin: "0 0 8px" });
    st.className = "__st";
    st.textContent = 'Klik een regel om het element te laten oplichten. "Herstel" = wijs het juiste element aan.';
    body.appendChild(st);
    if (pendingPick) {
      const h = pendingPick.hook;
      const pk = css(document.createElement("div"), { border: "2px solid " + C.pick, background: "#fff0f8", borderRadius: "8px", padding: "9px", margin: "0 0 10px" });
      const hd = document.createElement("div");
      zetHtml(hd, "<b>Herstel bevestigen: " + h[1] + "</b>");
      hd.style.margin = "0 0 6px";
      pk.appendChild(hd);
      const inp = document.createElement("input");
      inp.value = pendingPick.selector;
      css(inp, { width: "100%", boxSizing: "border-box", font: "11px Consolas, monospace", padding: "5px 6px", border: "1px solid #ccc", borderRadius: "5px", margin: "0 0 6px" });
      pk.appendChild(inp);
      const nMatch = (sel) => {
        try {
          return deepQueryAll(sel).filter((x2) => vis(x2) && !inOwnUi(x2)).length;
        } catch (e) {
          return 0;
        }
      };
      const specificSel = buildSelector(pendingPick.el);
      const broadSel = buildClassSelector(pendingPick.el);
      const quick = css(document.createElement("div"), { display: "flex", gap: "6px", flexWrap: "wrap", margin: "0 0 7px" });
      const fill = (sel) => {
        inp.value = sel;
        inp.dispatchEvent(new Event("input"));
      };
      quick.append(
        mini("Alleen dit (" + nMatch(specificSel) + ")", () => fill(specificSel)),
        mini("Alle vergelijkbare (" + nMatch(broadSel) + ")", () => fill(broadSel))
      );
      pk.appendChild(quick);
      const fb = css(document.createElement("div"), { fontSize: "11px", minHeight: "16px", margin: "0 0 7px" });
      pk.appendChild(fb);
      const save = mini("Opslaan & toepassen", () => {
        const v = inp.value.trim();
        if (!v) return;
        if (!window.confirm("Weet je het zeker? Dit is niet terug te draaien. Maak daarom altijd een kopie van de vorige selectors.")) return;
        saveOverride(h[3], v);
        pendingPick = null;
        drawHighlights();
        renderPanel();
        setStatus("✓ Hersteld en direct toegepast: " + h[1]);
      }, true);
      const cancel = mini("Annuleer", () => {
        pendingPick = null;
        renderPanel();
      });
      const btns = css(document.createElement("div"), { display: "flex", gap: "6px" });
      btns.append(save, cancel);
      pk.appendChild(btns);
      const isRel = h[4] === "rel";
      const refresh = () => {
        const info = selectorInfo(inp.value.trim(), pendingPick && pendingPick.el);
        let msg = "", col = "#666", ok = true;
        if (info.empty) {
          msg = "Voer een selector in.";
          col = C.miss;
          ok = false;
        } else if (info.invalid) {
          msg = "⚠ Ongeldige selector.";
          col = C.miss;
          ok = false;
        } else if (isRel) {
          msg = info.count === 0 ? "⚠ Matcht niets op dit scherm." : "✓ Wordt toegepast op alle vergelijkbare elementen (" + info.count + " gevonden).";
          col = info.count === 0 ? "#d98a0b" : C.ok;
        } else if (info.count === 0) {
          msg = "⚠ Matcht niets op dit scherm.";
          col = "#d98a0b";
        } else if (info.count === 1) {
          msg = "✓ Matcht precies 1 element.";
          col = C.ok;
        } else {
          msg = "⚠ Matcht " + info.count + " elementen — mogelijk niet uniek.";
          col = "#d98a0b";
        }
        if (!info.empty && !info.invalid && !isRel) {
          if (info.brittle) msg += " · broze positie-selector (kan breken bij ONS-updates).";
          if (info.shadow && / > /.test(inp.value)) msg += " · shadow-DOM: een descendant-pad piercet de shadow-grens mogelijk niet.";
        }
        fb.textContent = msg;
        fb.style.color = col;
        save.disabled = !ok;
        save.style.opacity = ok ? "1" : ".5";
        save.style.cursor = ok ? "pointer" : "not-allowed";
      };
      inp.oninput = refresh;
      refresh();
      body.appendChild(pk);
    }
    const bar = css(document.createElement("div"), { display: "flex", gap: "6px", margin: "0 0 8px", flexWrap: "wrap" });
    bar.append(
      mini(highlightsOn ? "Highlights uit" : "Highlights aan", () => {
        highlightsOn = !highlightsOn;
        drawHighlights();
        renderPanel();
      }),
      mini(onlyMissing ? "Toon alle" : "Alleen ontbrekend", () => {
        onlyMissing = !onlyMissing;
        renderPanel();
      }),
      mini("Herscan", () => {
        drawHighlights();
        renderPanel();
      }),
      mini("Exporteer selectors", exportOverrides)
    );
    body.appendChild(bar);
    const ovKeys = Object.keys(overrides || {}).filter((k) => overrides[k]);
    if (ovKeys.length) {
      const box = css(document.createElement("div"), { border: "1px solid #e7c9dd", background: "#faf3f8", borderRadius: "8px", padding: "8px 9px", margin: "0 0 10px" });
      const bh = css(document.createElement("div"), { display: "flex", alignItems: "center", gap: "6px", margin: "0 0 6px" });
      const bt = document.createElement("div");
      zetHtml(bt, "<b>Actieve herstellingen (" + ovKeys.length + ")</b>");
      bt.style.flex = "1";
      bt.style.fontSize = "12px";
      bh.append(bt, mini("Alles wissen", () => {
        ovKeys.forEach((k) => clearOverride(k));
        drawHighlights();
        renderPanel();
      }));
      box.appendChild(bh);
      ovKeys.forEach((k) => {
        const hook = HOOKS.find((h) => h[3] === k);
        const name = hook ? hook[1] : k;
        const r = css(document.createElement("div"), { display: "flex", alignItems: "center", gap: "6px", padding: "3px 0" });
        const lab = document.createElement("span");
        lab.style.flex = "1";
        lab.style.fontSize = "11px";
        const broken = !!(hook && selectorInfo(overrides[k], null).count === 0 && defaultEls(hook).length > 0);
        const flag = broken ? ' <span style="color:#d98a0b;font-weight:700">⚠ werkt niet meer</span>' : "";
        const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
        zetHtml(lab, "<b>" + esc(name) + "</b>" + flag + '<br><span style="color:#8a5a76;word-break:break-all">' + esc(overrides[k]) + "</span>");
        r.append(lab, mini("Verwijder", () => {
          clearOverride(k);
          drawHighlights();
          renderPanel();
        }));
        box.appendChild(r);
      });
      body.appendChild(box);
    }
    let grp = "";
    HOOKS.forEach((h) => {
      if (h[0] !== grp) {
        grp = h[0];
        const g = css(document.createElement("div"), { fontWeight: "800", fontSize: "10px", color: "#888", margin: "10px 0 2px" });
        g.textContent = grp;
        body.appendChild(g);
      }
      const o = overrideSel(h);
      const row = css(document.createElement("div"), { display: "flex", alignItems: "center", gap: "7px", padding: "5px 4px", borderBottom: "1px solid #f2f2f2", borderRadius: "6px" });
      const dot = css(document.createElement("span"), { minWidth: "26px", textAlign: "center", fontWeight: "800" });
      const lbl = document.createElement("span");
      lbl.style.flex = "1";
      lbl.textContent = h[1] + (o ? " •" : "");
      lbl.title = o || (typeof h[2] === "function" ? "(heuristisch)" : h[2]);
      row.append(dot, lbl);
      if (h[3]) {
        row.append(mini(o ? "Opnieuw" : "Herstel", () => enterPick(h), true));
        if (o) row.append(mini("Reset", () => {
          clearOverride(h[3]);
          drawHighlights();
          renderPanel();
        }));
      }
      row.onmouseenter = () => {
        if (row.dataset.on === "1") row.style.background = "#f7eef4";
      };
      row.onmouseleave = () => {
        row.style.background = "";
      };
      row.onclick = () => {
        if (row.dataset.on === "1") flash(h);
      };
      body.appendChild(row);
      const update = () => {
        const na = h[0] === "Agenda" && modalIsOpen();
        if (na) {
          row.dataset.on = "0";
          row.style.cursor = "default";
          row.style.display = onlyMissing ? "none" : "flex";
          row.style.opacity = ".45";
          dot.textContent = "–";
          dot.style.color = "#999";
          return true;
        }
        row.style.opacity = "";
        const n = visEls(h).length;
        const on = n > 0;
        row.dataset.on = on ? "1" : "0";
        row.style.cursor = on ? "pointer" : "default";
        row.style.display = onlyMissing && on ? "none" : "flex";
        if (overrideSel(h) && !on && defaultEls(h).length > 0) {
          dot.textContent = "⚠";
          dot.style.color = "#d98a0b";
          row.style.display = "flex";
          lbl.title = "Herstelling werkt niet meer (standaard vindt hier wél iets): " + overrideSel(h);
        } else {
          dot.textContent = on ? "✓" + n : "✗";
          dot.style.color = on ? C.ok : C.miss;
        }
        return on;
      };
      update();
      rowUpdaters.push(update);
    });
    const note = css(document.createElement("div"), { fontSize: "10px", color: "#999", marginTop: "10px" });
    note.textContent = "★ = het element dat de extensie gebruikt (bij meerdere treffers). ⚠ = herstelling wijst niets meer aan. Herstellingen worden direct toegepast (geen herladen nodig). Herstelbaar zijn de meeste velden (modal, uursoort, labels, datum, begin-/eindtijd, reistijd, titel, opslaan en de registratie-tijden). Structurele/heuristische hooks (cliëntlijst, cliëntnaam, toevoegen-knop, agenda-elementen) zijn alleen diagnose.";
    body.appendChild(note);
    panel.appendChild(body);
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[OVERRIDE_KEY]) return;
    overrides = changes[OVERRIDE_KEY].newValue || {};
    if (root) {
      drawHighlights();
      renderPanel();
    }
  });
  return { open() {
    if (!(root && panel)) openPanel();
  } };
}
export {
  openInspector
};
/*! Bundled license information:

dompurify/dist/purify.es.mjs:
  (*! @license DOMPurify 3.4.17 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.17/LICENSE *)
  (*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE *)
*/
