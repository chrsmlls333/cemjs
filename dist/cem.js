'use strict';

function _mergeNamespaces(n, m) {
  m.forEach(function (e) {
    e && typeof e !== 'string' && !Array.isArray(e) && Object.keys(e).forEach(function (k) {
      if (k !== 'default' && !(k in n)) {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  });
  return Object.freeze(n);
}

// Time functions //////////////////////////////////////////////////////

const millis = () => {
  return window.performance.now();
};

const getTimeStamp = () => {
  let date = new Date();
  const offset = date.getTimezoneOffset();
  date = new Date(date.getTime() - (offset*60*1000));
  const {
      H, HH, M, MM, S, SS, SSS, d, dd, m, mm, timezone, yy, yyyy
  } = date.toISOString().match(
          /^(?<yyyy>\d\d(?<yy>\d\d))-(?<mm>0?(?<m>\d+))-(?<dd>0?(?<d>\d+))T(?<HH>0?(?<H>\d+)):(?<MM>0?(?<M>\d+)):(?<SSS>(?<SS>0?(?<S>\d+))\.\d+)(?<timezone>[A-Z][\dA-Z.-:]*)$/
      ).groups;
  return `${yyyy}${mm}${dd}-${HH}${MM}${SS}`
};

// == ////////////////////////////////////////////////////////////////////

class Clock { 
  constructor(autoStart = true) {
    this.autoStart = autoStart;
    this.startTime = 0;
    this.oldTime = 0;
    this.elapsedTime = 0;

    this.running = false;
  }

  start() {
    this.startTime = (performance || Date).now();
    this.oldTime = this.startTime;
    this.elapsedTime = 0;
    this.running = true;
  }

  stop() {
    this.getElapsedTime();
    this.running = false;
  }

  getElapsedTime() {
    this.getDelta();
    return this.elapsedTime;
  }

  getDelta() {
    let diff = 0;
    if (this.autoStart && !this.running) {
      this.start();
    }
    if (this.running) {
      let newTime = (performance || Date).now();
      diff = (newTime - this.oldTime) / 1000;
      this.oldTime = newTime;
      this.elapsedTime += diff;
    }
    return diff;
  }
}

class ExpiringData {
    #expiry = 0;
    #data;
    #generator;
    constructor(callback) {
        if (callback) {
            this.registerDataCallback(callback);
            this.update(0);
        }
    }
    registerDataCallback(callback) {
        // TODO check for null or function type, return success, and use in the constructor
        if (callback)
            this.#generator = callback;
    }
    update(expiry = Date.now(), data) {
        this.#expiry = expiry;
        if (data !== undefined)
            this.#data = data;
        else if (this.#generator)
            this.#data = this.#generator();
        // else leave alone
        return data;
    }
    set(data, expiry = 0) { return this.update(expiry, data); }
    getFresh() { this.#data = this.#generator ? this.#generator() : this.#data; return this.#data; }
    getStale() { return this.#data; }
    get(now = Date.now(), maxAge = 0) {
        if (this.isExpired(now, maxAge))
            return this.update(now);
        else
            return this.getStale();
    }
    isExpired(now, maxAge = 0) { return now > (this.#expiry + maxAge); }
    isFresh(now, maxAge = 0) { return !this.isExpired(now, maxAge); }
}
class p5FrameData {
    #ed;
    #pInst;
    #getFrameCount = () => this.#pInst.frameCount;
    constructor(p5Instance, callback) {
        this.#ed = new ExpiringData(callback);
        this.#pInst = p5Instance;
    }
    registerDataCallback = (callback) => this.#ed.registerDataCallback(callback);
    update = (data) => this.#ed.update(this.#getFrameCount(), data);
    set = this.update;
    getFresh = () => this.#ed.getFresh();
    getStale = () => this.#ed.getStale();
    get = (maxAge = 0) => this.#ed.get(this.#getFrameCount(), maxAge);
    isExpired = (maxAge = 0) => this.#ed.isExpired(this.#getFrameCount(), maxAge);
    isFresh = (maxAge = 0) => !this.isExpired(maxAge);
}

const averageArray = (array) => {
    let sum = array.reduce((a, b) => a + b, 0);
    let avg = (sum * 1.0 / array.length) || 0;
    return avg;
};
class Queue {
    array;
    constructor(from = []) {
        if (from && !Array.isArray(from))
            throw new TypeError("Queue requires a parameter 'from' of type Array, or skip it.");
        if (!from) {
            this.array = [];
            return;
        }
        this.array = from;
    }
    enqueue(e) { this.array.push(e); }
    dequeue() { return this.array.shift(); }
    tick(e) {
        this.enqueue(e);
        this.dequeue();
        return this.length();
    }
    peek() {
        if (!this.isEmpty())
            return this.array[0];
        else
            return undefined;
    }
    length() { return this.array.length; }
    isEmpty() { return this.array.length === 0; }
    toArray() { return Array.from(this.array); }
}
class RecentAverage {
    #history;
    #historySamples;
    constructor(historySamples = 100, defaultValue = 60) {
        this.#historySamples = historySamples;
        this.#history = new Queue(Array(historySamples).fill(defaultValue));
    }
    tick(latestValue, samples = this.#historySamples) {
        this.#history.tick(latestValue);
        this.#history.array;
        return this.average(samples);
    }
    average(samples = this.#history.array.length) {
        let len = Math.min(samples, this.#history.array.length);
        return averageArray(this.#history.array.slice(-len));
    }
}

// Trackable Timers //////////////////////////////////////////////////////////

let timeoutArray = [];

const clearTimers = () => {
  if (typeof timeoutArray !== 'undefined') {
    if (timeoutArray.length > 0) {
      for (let i = 0; i < timeoutArray.length; i++) {
        clearTimeout(timeoutArray[i]);
      }
      timeoutArray = [];
    }
  } else {
    timeoutArray = [];
  }
};

const newTimer = (function_, delay_) => {
  if (delay_ == 0) { function_(); return null }
  let t = setTimeout(function_, delay_);
  timeoutArray.push(t);
  return t;
};

// Easing Functions (from jQuery Easing v1.3 - http://gsgd.co.uk/sandbox/jquery/easing/)

const Easing = {
  // t: current time, b: begInnIng value, c: change In value, d: duration

  easeInQuad: function (t, b, c, d) {
    return c * (t /= d) * t + b;
  },
  easeOutQuad: function (t, b, c, d) {
    return -c * (t /= d) * (t - 2) + b;
  },
  easeInOutQuad: function (t, b, c, d) {
    if ((t /= d / 2) < 1) return c / 2 * t * t + b;
    return -c / 2 * ((--t) * (t - 2) - 1) + b;
  },
  easeInCubic: function (t, b, c, d) {
    return c * (t /= d) * t * t + b;
  },
  easeOutCubic: function (t, b, c, d) {
    return c * ((t = t / d - 1) * t * t + 1) + b;
  },
  easeInOutCubic: function (t, b, c, d) {
    if ((t /= d / 2) < 1) return c / 2 * t * t * t + b;
    return c / 2 * ((t -= 2) * t * t + 2) + b;
  },
  easeInQuart: function (t, b, c, d) {
    return c * (t /= d) * t * t * t + b;
  },
  easeOutQuart: function (t, b, c, d) {
    return -c * ((t = t / d - 1) * t * t * t - 1) + b;
  },
  easeInOutQuart: function (t, b, c, d) {
    if ((t /= d / 2) < 1) return c / 2 * t * t * t * t + b;
    return -c / 2 * ((t -= 2) * t * t * t - 2) + b;
  },
  easeInQuint: function (t, b, c, d) {
    return c * (t /= d) * t * t * t * t + b;
  },
  easeOutQuint: function (t, b, c, d) {
    return c * ((t = t / d - 1) * t * t * t * t + 1) + b;
  },
  easeInOutQuint: function (t, b, c, d) {
    if ((t /= d / 2) < 1) return c / 2 * t * t * t * t * t + b;
    return c / 2 * ((t -= 2) * t * t * t * t + 2) + b;
  },
  easeInSine: function (t, b, c, d) {
    return -c * Math.cos(t / d * (Math.PI / 2)) + c + b;
  },
  easeOutSine: function (t, b, c, d) {
    return c * Math.sin(t / d * (Math.PI / 2)) + b;
  },
  easeInOutSine: function (t, b, c, d) {
    return -c / 2 * (Math.cos(Math.PI * t / d) - 1) + b;
  },
  easeInExpo: function (t, b, c, d) {
    return (t == 0) ? b : c * Math.pow(2, 10 * (t / d - 1)) + b;
  },
  easeOutExpo: function (t, b, c, d) {
    return (t == d) ? b + c : c * (-Math.pow(2, -10 * t / d) + 1) + b;
  },
  easeInOutExpo: function (t, b, c, d) {
    if (t == 0) return b;
    if (t == d) return b + c;
    if ((t /= d / 2) < 1) return c / 2 * Math.pow(2, 10 * (t - 1)) + b;
    return c / 2 * (-Math.pow(2, -10 * --t) + 2) + b;
  },
  easeInCirc: function (t, b, c, d) {
    return -c * (Math.sqrt(1 - (t /= d) * t) - 1) + b;
  },
  easeOutCirc: function (t, b, c, d) {
    return c * Math.sqrt(1 - (t = t / d - 1) * t) + b;
  },
  easeInOutCirc: function (t, b, c, d) {
    if ((t /= d / 2) < 1) return -c / 2 * (Math.sqrt(1 - t * t) - 1) + b;
    return c / 2 * (Math.sqrt(1 - (t -= 2) * t) + 1) + b;
  },
  easeInElastic: function (t, b, c, d) {
    var s = 1.70158;
    var p = 0;
    var a = c;
    if (t == 0) return b;
    if ((t /= d) == 1) return b + c;
    if (!p) p = d * .3;
    if (a < Math.abs(c)) {
      a = c;
      var s = p / 4;
    } else var s = p / (2 * Math.PI) * Math.asin(c / a);
    return -(a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
  },
  easeOutElastic: function (t, b, c, d) {
    var s = 1.70158;
    var p = 0;
    var a = c;
    if (t == 0) return b;
    if ((t /= d) == 1) return b + c;
    if (!p) p = d * .3;
    if (a < Math.abs(c)) {
      a = c;
      var s = p / 4;
    } else var s = p / (2 * Math.PI) * Math.asin(c / a);
    return a * Math.pow(2, -10 * t) * Math.sin((t * d - s) * (2 * Math.PI) / p) + c + b;
  },
  easeInOutElastic: function (t, b, c, d) {
    var s = 1.70158;
    var p = 0;
    var a = c;
    if (t == 0) return b;
    if ((t /= d / 2) == 2) return b + c;
    if (!p) p = d * (.3 * 1.5);
    if (a < Math.abs(c)) {
      a = c;
      var s = p / 4;
    } else var s = p / (2 * Math.PI) * Math.asin(c / a);
    if (t < 1) return -.5 * (a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
    return a * Math.pow(2, -10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p) * .5 + c + b;
  },
  easeInBack: function (t, b, c, d, s) {
    if (s == undefined) s = 1.70158;
    return c * (t /= d) * t * ((s + 1) * t - s) + b;
  },
  easeOutBack: function (t, b, c, d, s) {
    if (s == undefined) s = 1.70158;
    return c * ((t = t / d - 1) * t * ((s + 1) * t + s) + 1) + b;
  },
  easeInOutBack: function (t, b, c, d, s) {
    if (s == undefined) s = 1.70158;
    if ((t /= d / 2) < 1) return c / 2 * (t * t * (((s *= (1.525)) + 1) * t - s)) + b;
    return c / 2 * ((t -= 2) * t * (((s *= (1.525)) + 1) * t + s) + 2) + b;
  },
  easeInBounce: function (t, b, c, d) {
    return c - this.easeOutBounce(d - t, 0, c, d) + b;
  },
  easeOutBounce: function (t, b, c, d) {
    if ((t /= d) < (1 / 2.75)) {
      return c * (7.5625 * t * t) + b;
    } else if (t < (2 / 2.75)) {
      return c * (7.5625 * (t -= (1.5 / 2.75)) * t + .75) + b;
    } else if (t < (2.5 / 2.75)) {
      return c * (7.5625 * (t -= (2.25 / 2.75)) * t + .9375) + b;
    } else {
      return c * (7.5625 * (t -= (2.625 / 2.75)) * t + .984375) + b;
    }
  },
  easeInOutBounce: function (t, b, c, d) {
    if (t < d / 2) return this.easeInBounce(t * 2, 0, c, d) * .5 + b;
    return this.easeOutBounce(t * 2 - d, 0, c, d) * .5 + c * .5 + b;
  }
};

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

var freeGlobal$1 = freeGlobal;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal$1 || freeSelf || Function('return this')();

var root$1 = root;

/** Built-in value references. */
var Symbol = root$1.Symbol;

var Symbol$1 = Symbol;

/** Used for built-in method references. */
var objectProto$b = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty$8 = objectProto$b.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString$1 = objectProto$b.toString;

/** Built-in value references. */
var symToStringTag$1 = Symbol$1 ? Symbol$1.toStringTag : undefined;

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = hasOwnProperty$8.call(value, symToStringTag$1),
      tag = value[symToStringTag$1];

  try {
    value[symToStringTag$1] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = nativeObjectToString$1.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag$1] = tag;
    } else {
      delete value[symToStringTag$1];
    }
  }
  return result;
}

/** Used for built-in method references. */
var objectProto$a = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto$a.toString;

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return nativeObjectToString.call(value);
}

/** `Object#toString` result references. */
var nullTag = '[object Null]',
    undefinedTag = '[object Undefined]';

/** Built-in value references. */
var symToStringTag = Symbol$1 ? Symbol$1.toStringTag : undefined;

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return (symToStringTag && symToStringTag in Object(value))
    ? getRawTag(value)
    : objectToString(value);
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray$1 = Array.isArray;

var isArray$2 = isArray$1;

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

/** `Object#toString` result references. */
var asyncTag = '[object AsyncFunction]',
    funcTag$1 = '[object Function]',
    genTag = '[object GeneratorFunction]',
    proxyTag = '[object Proxy]';

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  if (!isObject(value)) {
    return false;
  }
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 9 which returns 'object' for typed arrays and other constructors.
  var tag = baseGetTag(value);
  return tag == funcTag$1 || tag == genTag || tag == asyncTag || tag == proxyTag;
}

/** Used to detect overreaching core-js shims. */
var coreJsData = root$1['__core-js_shared__'];

var coreJsData$1 = coreJsData;

/** Used to detect methods masquerading as native. */
var maskSrcKey = (function() {
  var uid = /[^.]+$/.exec(coreJsData$1 && coreJsData$1.keys && coreJsData$1.keys.IE_PROTO || '');
  return uid ? ('Symbol(src)_1.' + uid) : '';
}());

/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */
function isMasked(func) {
  return !!maskSrcKey && (maskSrcKey in func);
}

/** Used for built-in method references. */
var funcProto$1 = Function.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString$1 = funcProto$1.toString;

/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to convert.
 * @returns {string} Returns the source code.
 */
function toSource(func) {
  if (func != null) {
    try {
      return funcToString$1.call(func);
    } catch (e) {}
    try {
      return (func + '');
    } catch (e) {}
  }
  return '';
}

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used for built-in method references. */
var funcProto = Function.prototype,
    objectProto$9 = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty$7 = objectProto$9.hasOwnProperty;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty$7).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */
function baseIsNative(value) {
  if (!isObject(value) || isMasked(value)) {
    return false;
  }
  var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource(value));
}

/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key];
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = getValue(object, key);
  return baseIsNative(value) ? value : undefined;
}

/* Built-in method references that are verified to be native. */
var WeakMap = getNative(root$1, 'WeakMap');

var WeakMap$1 = WeakMap;

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER$1 = 9007199254740991;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  var type = typeof value;
  length = length == null ? MAX_SAFE_INTEGER$1 : length;

  return !!length &&
    (type == 'number' ||
      (type != 'symbol' && reIsUint.test(value))) &&
        (value > -1 && value % 1 == 0 && value < length);
}

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/** Used for built-in method references. */
var objectProto$8 = Object.prototype;

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto$8;

  return value === proto;
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/** `Object#toString` result references. */
var argsTag$2 = '[object Arguments]';

/**
 * The base implementation of `_.isArguments`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 */
function baseIsArguments(value) {
  return isObjectLike(value) && baseGetTag(value) == argsTag$2;
}

/** Used for built-in method references. */
var objectProto$7 = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty$6 = objectProto$7.hasOwnProperty;

/** Built-in value references. */
var propertyIsEnumerable$1 = objectProto$7.propertyIsEnumerable;

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
var isArguments = baseIsArguments(function() { return arguments; }()) ? baseIsArguments : function(value) {
  return isObjectLike(value) && hasOwnProperty$6.call(value, 'callee') &&
    !propertyIsEnumerable$1.call(value, 'callee');
};

var isArguments$1 = isArguments;

/**
 * This method returns `false`.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {boolean} Returns `false`.
 * @example
 *
 * _.times(2, _.stubFalse);
 * // => [false, false]
 */
function stubFalse() {
  return false;
}

/** Detect free variable `exports`. */
var freeExports$1 = typeof exports == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule$1 = freeExports$1 && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports$1 = freeModule$1 && freeModule$1.exports === freeExports$1;

/** Built-in value references. */
var Buffer = moduleExports$1 ? root$1.Buffer : undefined;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;

/**
 * Checks if `value` is a buffer.
 *
 * @static
 * @memberOf _
 * @since 4.3.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
 * @example
 *
 * _.isBuffer(new Buffer(2));
 * // => true
 *
 * _.isBuffer(new Uint8Array(2));
 * // => false
 */
var isBuffer = nativeIsBuffer || stubFalse;

var isBuffer$1 = isBuffer;

/** `Object#toString` result references. */
var argsTag$1 = '[object Arguments]',
    arrayTag$1 = '[object Array]',
    boolTag$1 = '[object Boolean]',
    dateTag$1 = '[object Date]',
    errorTag$1 = '[object Error]',
    funcTag = '[object Function]',
    mapTag$2 = '[object Map]',
    numberTag$2 = '[object Number]',
    objectTag$2 = '[object Object]',
    regexpTag$1 = '[object RegExp]',
    setTag$2 = '[object Set]',
    stringTag$2 = '[object String]',
    weakMapTag$1 = '[object WeakMap]';

var arrayBufferTag$1 = '[object ArrayBuffer]',
    dataViewTag$2 = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag$1] = typedArrayTags[arrayTag$1] =
typedArrayTags[arrayBufferTag$1] = typedArrayTags[boolTag$1] =
typedArrayTags[dataViewTag$2] = typedArrayTags[dateTag$1] =
typedArrayTags[errorTag$1] = typedArrayTags[funcTag] =
typedArrayTags[mapTag$2] = typedArrayTags[numberTag$2] =
typedArrayTags[objectTag$2] = typedArrayTags[regexpTag$1] =
typedArrayTags[setTag$2] = typedArrayTags[stringTag$2] =
typedArrayTags[weakMapTag$1] = false;

/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */
function baseIsTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
}

/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function(value) {
    return func(value);
  };
}

/** Detect free variable `exports`. */
var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Detect free variable `process` from Node.js. */
var freeProcess = moduleExports && freeGlobal$1.process;

/** Used to access faster Node.js helpers. */
var nodeUtil = (function() {
  try {
    // Use `util.types` for Node.js 10+.
    var types = freeModule && freeModule.require && freeModule.require('util').types;

    if (types) {
      return types;
    }

    // Legacy `process.binding('util')` for Node.js < 10.
    return freeProcess && freeProcess.binding && freeProcess.binding('util');
  } catch (e) {}
}());

var nodeUtil$1 = nodeUtil;

/* Node.js helper references. */
var nodeIsTypedArray = nodeUtil$1 && nodeUtil$1.isTypedArray;

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

var isTypedArray$1 = isTypedArray;

/** Used for built-in method references. */
var objectProto$6 = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty$5 = objectProto$6.hasOwnProperty;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  var isArr = isArray$2(value),
      isArg = !isArr && isArguments$1(value),
      isBuff = !isArr && !isArg && isBuffer$1(value),
      isType = !isArr && !isArg && !isBuff && isTypedArray$1(value),
      skipIndexes = isArr || isArg || isBuff || isType,
      result = skipIndexes ? baseTimes(value.length, String) : [],
      length = result.length;

  for (var key in value) {
    if ((inherited || hasOwnProperty$5.call(value, key)) &&
        !(skipIndexes && (
           // Safari 9 has enumerable `arguments.length` in strict mode.
           key == 'length' ||
           // Node.js 0.10 has enumerable non-index properties on buffers.
           (isBuff && (key == 'offset' || key == 'parent')) ||
           // PhantomJS 2 has enumerable non-index properties on typed arrays.
           (isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) ||
           // Skip index properties.
           isIndex(key, length)
        ))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = overArg(Object.keys, Object);

var nativeKeys$1 = nativeKeys;

/** Used for built-in method references. */
var objectProto$5 = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty$4 = objectProto$5.hasOwnProperty;

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys$1(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty$4.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

/* Built-in method references that are verified to be native. */
var nativeCreate = getNative(Object, 'create');

var nativeCreate$1 = nativeCreate;

/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */
function hashClear() {
  this.__data__ = nativeCreate$1 ? nativeCreate$1(null) : {};
  this.size = 0;
}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  var result = this.has(key) && delete this.__data__[key];
  this.size -= result ? 1 : 0;
  return result;
}

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED$2 = '__lodash_hash_undefined__';

/** Used for built-in method references. */
var objectProto$4 = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty$3 = objectProto$4.hasOwnProperty;

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(key) {
  var data = this.__data__;
  if (nativeCreate$1) {
    var result = data[key];
    return result === HASH_UNDEFINED$2 ? undefined : result;
  }
  return hasOwnProperty$3.call(data, key) ? data[key] : undefined;
}

/** Used for built-in method references. */
var objectProto$3 = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty$2 = objectProto$3.hasOwnProperty;

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(key) {
  var data = this.__data__;
  return nativeCreate$1 ? (data[key] !== undefined) : hasOwnProperty$2.call(data, key);
}

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED$1 = '__lodash_hash_undefined__';

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */
function hashSet(key, value) {
  var data = this.__data__;
  this.size += this.has(key) ? 0 : 1;
  data[key] = (nativeCreate$1 && value === undefined) ? HASH_UNDEFINED$1 : value;
  return this;
}

/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Hash(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `Hash`.
Hash.prototype.clear = hashClear;
Hash.prototype['delete'] = hashDelete;
Hash.prototype.get = hashGet;
Hash.prototype.has = hashHas;
Hash.prototype.set = hashSet;

/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = [];
  this.size = 0;
}

/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype;

/** Built-in value references. */
var splice = arrayProto.splice;

/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function listCacheDelete(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }
  --this.size;
  return true;
}

/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function listCacheGet(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  return index < 0 ? undefined : data[index][1];
}

/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function listCacheHas(key) {
  return assocIndexOf(this.__data__, key) > -1;
}

/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */
function listCacheSet(key, value) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    ++this.size;
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}

/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function ListCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `ListCache`.
ListCache.prototype.clear = listCacheClear;
ListCache.prototype['delete'] = listCacheDelete;
ListCache.prototype.get = listCacheGet;
ListCache.prototype.has = listCacheHas;
ListCache.prototype.set = listCacheSet;

/* Built-in method references that are verified to be native. */
var Map$1 = getNative(root$1, 'Map');

var Map$2 = Map$1;

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapCacheClear() {
  this.size = 0;
  this.__data__ = {
    'hash': new Hash,
    'map': new (Map$2 || ListCache),
    'string': new Hash
  };
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
    ? (value !== '__proto__')
    : (value === null);
}

/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */
function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable(key)
    ? data[typeof key == 'string' ? 'string' : 'hash']
    : data.map;
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapCacheDelete(key) {
  var result = getMapData(this, key)['delete'](key);
  this.size -= result ? 1 : 0;
  return result;
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapCacheGet(key) {
  return getMapData(this, key).get(key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapCacheHas(key) {
  return getMapData(this, key).has(key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */
function mapCacheSet(key, value) {
  var data = getMapData(this, key),
      size = data.size;

  data.set(key, value);
  this.size += data.size == size ? 0 : 1;
  return this;
}

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function MapCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `MapCache`.
MapCache.prototype.clear = mapCacheClear;
MapCache.prototype['delete'] = mapCacheDelete;
MapCache.prototype.get = mapCacheGet;
MapCache.prototype.has = mapCacheHas;
MapCache.prototype.set = mapCacheSet;

/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = new ListCache;
  this.size = 0;
}

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  var data = this.__data__,
      result = data['delete'](key);

  this.size = data.size;
  return result;
}

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  return this.__data__.get(key);
}

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  return this.__data__.has(key);
}

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache instance.
 */
function stackSet(key, value) {
  var data = this.__data__;
  if (data instanceof ListCache) {
    var pairs = data.__data__;
    if (!Map$2 || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
      pairs.push([key, value]);
      this.size = ++data.size;
      return this;
    }
    data = this.__data__ = new MapCache(pairs);
  }
  data.set(key, value);
  this.size = data.size;
  return this;
}

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Stack(entries) {
  var data = this.__data__ = new ListCache(entries);
  this.size = data.size;
}

// Add methods to `Stack`.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

/**
 * A specialized version of `_.filter` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {Array} Returns the new filtered array.
 */
function arrayFilter(array, predicate) {
  var index = -1,
      length = array == null ? 0 : array.length,
      resIndex = 0,
      result = [];

  while (++index < length) {
    var value = array[index];
    if (predicate(value, index, array)) {
      result[resIndex++] = value;
    }
  }
  return result;
}

/**
 * This method returns a new empty array.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {Array} Returns the new empty array.
 * @example
 *
 * var arrays = _.times(2, _.stubArray);
 *
 * console.log(arrays);
 * // => [[], []]
 *
 * console.log(arrays[0] === arrays[1]);
 * // => false
 */
function stubArray() {
  return [];
}

/** Used for built-in method references. */
var objectProto$2 = Object.prototype;

/** Built-in value references. */
var propertyIsEnumerable = objectProto$2.propertyIsEnumerable;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeGetSymbols = Object.getOwnPropertySymbols;

/**
 * Creates an array of the own enumerable symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of symbols.
 */
var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
  if (object == null) {
    return [];
  }
  object = Object(object);
  return arrayFilter(nativeGetSymbols(object), function(symbol) {
    return propertyIsEnumerable.call(object, symbol);
  });
};

var getSymbols$1 = getSymbols;

/**
 * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
 * `keysFunc` and `symbolsFunc` to get the enumerable property names and
 * symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @param {Function} symbolsFunc The function to get the symbols of `object`.
 * @returns {Array} Returns the array of property names and symbols.
 */
function baseGetAllKeys(object, keysFunc, symbolsFunc) {
  var result = keysFunc(object);
  return isArray$2(object) ? result : arrayPush(result, symbolsFunc(object));
}

/**
 * Creates an array of own enumerable property names and symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names and symbols.
 */
function getAllKeys(object) {
  return baseGetAllKeys(object, keys, getSymbols$1);
}

/* Built-in method references that are verified to be native. */
var DataView$1 = getNative(root$1, 'DataView');

var DataView$2 = DataView$1;

/* Built-in method references that are verified to be native. */
var Promise$1 = getNative(root$1, 'Promise');

var Promise$2 = Promise$1;

/* Built-in method references that are verified to be native. */
var Set$1 = getNative(root$1, 'Set');

var Set$2 = Set$1;

/** `Object#toString` result references. */
var mapTag$1 = '[object Map]',
    objectTag$1 = '[object Object]',
    promiseTag = '[object Promise]',
    setTag$1 = '[object Set]',
    weakMapTag = '[object WeakMap]';

var dataViewTag$1 = '[object DataView]';

/** Used to detect maps, sets, and weakmaps. */
var dataViewCtorString = toSource(DataView$2),
    mapCtorString = toSource(Map$2),
    promiseCtorString = toSource(Promise$2),
    setCtorString = toSource(Set$2),
    weakMapCtorString = toSource(WeakMap$1);

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
var getTag = baseGetTag;

// Fallback for data views, maps, sets, and weak maps in IE 11 and promises in Node.js < 6.
if ((DataView$2 && getTag(new DataView$2(new ArrayBuffer(1))) != dataViewTag$1) ||
    (Map$2 && getTag(new Map$2) != mapTag$1) ||
    (Promise$2 && getTag(Promise$2.resolve()) != promiseTag) ||
    (Set$2 && getTag(new Set$2) != setTag$1) ||
    (WeakMap$1 && getTag(new WeakMap$1) != weakMapTag)) {
  getTag = function(value) {
    var result = baseGetTag(value),
        Ctor = result == objectTag$1 ? value.constructor : undefined,
        ctorString = Ctor ? toSource(Ctor) : '';

    if (ctorString) {
      switch (ctorString) {
        case dataViewCtorString: return dataViewTag$1;
        case mapCtorString: return mapTag$1;
        case promiseCtorString: return promiseTag;
        case setCtorString: return setTag$1;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

var getTag$1 = getTag;

/** Built-in value references. */
var Uint8Array = root$1.Uint8Array;

var Uint8Array$1 = Uint8Array;

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/**
 * Adds `value` to the array cache.
 *
 * @private
 * @name add
 * @memberOf SetCache
 * @alias push
 * @param {*} value The value to cache.
 * @returns {Object} Returns the cache instance.
 */
function setCacheAdd(value) {
  this.__data__.set(value, HASH_UNDEFINED);
  return this;
}

/**
 * Checks if `value` is in the array cache.
 *
 * @private
 * @name has
 * @memberOf SetCache
 * @param {*} value The value to search for.
 * @returns {number} Returns `true` if `value` is found, else `false`.
 */
function setCacheHas(value) {
  return this.__data__.has(value);
}

/**
 *
 * Creates an array cache object to store unique values.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function SetCache(values) {
  var index = -1,
      length = values == null ? 0 : values.length;

  this.__data__ = new MapCache;
  while (++index < length) {
    this.add(values[index]);
  }
}

// Add methods to `SetCache`.
SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
SetCache.prototype.has = setCacheHas;

/**
 * A specialized version of `_.some` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check,
 *  else `false`.
 */
function arraySome(array, predicate) {
  var index = -1,
      length = array == null ? 0 : array.length;

  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a `cache` value for `key` exists.
 *
 * @private
 * @param {Object} cache The cache to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function cacheHas(cache, key) {
  return cache.has(key);
}

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG$3 = 1,
    COMPARE_UNORDERED_FLAG$1 = 2;

/**
 * A specialized version of `baseIsEqualDeep` for arrays with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Array} array The array to compare.
 * @param {Array} other The other array to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `array` and `other` objects.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 */
function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
  var isPartial = bitmask & COMPARE_PARTIAL_FLAG$3,
      arrLength = array.length,
      othLength = other.length;

  if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
    return false;
  }
  // Check that cyclic values are equal.
  var arrStacked = stack.get(array);
  var othStacked = stack.get(other);
  if (arrStacked && othStacked) {
    return arrStacked == other && othStacked == array;
  }
  var index = -1,
      result = true,
      seen = (bitmask & COMPARE_UNORDERED_FLAG$1) ? new SetCache : undefined;

  stack.set(array, other);
  stack.set(other, array);

  // Ignore non-index properties.
  while (++index < arrLength) {
    var arrValue = array[index],
        othValue = other[index];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, arrValue, index, other, array, stack)
        : customizer(arrValue, othValue, index, array, other, stack);
    }
    if (compared !== undefined) {
      if (compared) {
        continue;
      }
      result = false;
      break;
    }
    // Recursively compare arrays (susceptible to call stack limits).
    if (seen) {
      if (!arraySome(other, function(othValue, othIndex) {
            if (!cacheHas(seen, othIndex) &&
                (arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
              return seen.push(othIndex);
            }
          })) {
        result = false;
        break;
      }
    } else if (!(
          arrValue === othValue ||
            equalFunc(arrValue, othValue, bitmask, customizer, stack)
        )) {
      result = false;
      break;
    }
  }
  stack['delete'](array);
  stack['delete'](other);
  return result;
}

/**
 * Converts `map` to its key-value pairs.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the key-value pairs.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

/**
 * Converts `set` to an array of its values.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the values.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG$2 = 1,
    COMPARE_UNORDERED_FLAG = 2;

/** `Object#toString` result references. */
var boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    mapTag = '[object Map]',
    numberTag$1 = '[object Number]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag$1 = '[object String]',
    symbolTag = '[object Symbol]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]';

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol$1 ? Symbol$1.prototype : undefined,
    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;

/**
 * A specialized version of `baseIsEqualDeep` for comparing objects of
 * the same `toStringTag`.
 *
 * **Note:** This function only supports comparing values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {string} tag The `toStringTag` of the objects to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
  switch (tag) {
    case dataViewTag:
      if ((object.byteLength != other.byteLength) ||
          (object.byteOffset != other.byteOffset)) {
        return false;
      }
      object = object.buffer;
      other = other.buffer;

    case arrayBufferTag:
      if ((object.byteLength != other.byteLength) ||
          !equalFunc(new Uint8Array$1(object), new Uint8Array$1(other))) {
        return false;
      }
      return true;

    case boolTag:
    case dateTag:
    case numberTag$1:
      // Coerce booleans to `1` or `0` and dates to milliseconds.
      // Invalid dates are coerced to `NaN`.
      return eq(+object, +other);

    case errorTag:
      return object.name == other.name && object.message == other.message;

    case regexpTag:
    case stringTag$1:
      // Coerce regexes to strings and treat strings, primitives and objects,
      // as equal. See http://www.ecma-international.org/ecma-262/7.0/#sec-regexp.prototype.tostring
      // for more details.
      return object == (other + '');

    case mapTag:
      var convert = mapToArray;

    case setTag:
      var isPartial = bitmask & COMPARE_PARTIAL_FLAG$2;
      convert || (convert = setToArray);

      if (object.size != other.size && !isPartial) {
        return false;
      }
      // Assume cyclic values are equal.
      var stacked = stack.get(object);
      if (stacked) {
        return stacked == other;
      }
      bitmask |= COMPARE_UNORDERED_FLAG;

      // Recursively compare objects (susceptible to call stack limits).
      stack.set(object, other);
      var result = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
      stack['delete'](object);
      return result;

    case symbolTag:
      if (symbolValueOf) {
        return symbolValueOf.call(object) == symbolValueOf.call(other);
      }
  }
  return false;
}

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG$1 = 1;

/** Used for built-in method references. */
var objectProto$1 = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty$1 = objectProto$1.hasOwnProperty;

/**
 * A specialized version of `baseIsEqualDeep` for objects with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
  var isPartial = bitmask & COMPARE_PARTIAL_FLAG$1,
      objProps = getAllKeys(object),
      objLength = objProps.length,
      othProps = getAllKeys(other),
      othLength = othProps.length;

  if (objLength != othLength && !isPartial) {
    return false;
  }
  var index = objLength;
  while (index--) {
    var key = objProps[index];
    if (!(isPartial ? key in other : hasOwnProperty$1.call(other, key))) {
      return false;
    }
  }
  // Check that cyclic values are equal.
  var objStacked = stack.get(object);
  var othStacked = stack.get(other);
  if (objStacked && othStacked) {
    return objStacked == other && othStacked == object;
  }
  var result = true;
  stack.set(object, other);
  stack.set(other, object);

  var skipCtor = isPartial;
  while (++index < objLength) {
    key = objProps[index];
    var objValue = object[key],
        othValue = other[key];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, objValue, key, other, object, stack)
        : customizer(objValue, othValue, key, object, other, stack);
    }
    // Recursively compare objects (susceptible to call stack limits).
    if (!(compared === undefined
          ? (objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack))
          : compared
        )) {
      result = false;
      break;
    }
    skipCtor || (skipCtor = key == 'constructor');
  }
  if (result && !skipCtor) {
    var objCtor = object.constructor,
        othCtor = other.constructor;

    // Non `Object` object instances with different constructors are not equal.
    if (objCtor != othCtor &&
        ('constructor' in object && 'constructor' in other) &&
        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
      result = false;
    }
  }
  stack['delete'](object);
  stack['delete'](other);
  return result;
}

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    objectTag = '[object Object]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * A specialized version of `baseIsEqual` for arrays and objects which performs
 * deep comparisons and tracks traversed objects enabling objects with circular
 * references to be compared.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
  var objIsArr = isArray$2(object),
      othIsArr = isArray$2(other),
      objTag = objIsArr ? arrayTag : getTag$1(object),
      othTag = othIsArr ? arrayTag : getTag$1(other);

  objTag = objTag == argsTag ? objectTag : objTag;
  othTag = othTag == argsTag ? objectTag : othTag;

  var objIsObj = objTag == objectTag,
      othIsObj = othTag == objectTag,
      isSameTag = objTag == othTag;

  if (isSameTag && isBuffer$1(object)) {
    if (!isBuffer$1(other)) {
      return false;
    }
    objIsArr = true;
    objIsObj = false;
  }
  if (isSameTag && !objIsObj) {
    stack || (stack = new Stack);
    return (objIsArr || isTypedArray$1(object))
      ? equalArrays(object, other, bitmask, customizer, equalFunc, stack)
      : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
  }
  if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
    var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
        othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

    if (objIsWrapped || othIsWrapped) {
      var objUnwrapped = objIsWrapped ? object.value() : object,
          othUnwrapped = othIsWrapped ? other.value() : other;

      stack || (stack = new Stack);
      return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
    }
  }
  if (!isSameTag) {
    return false;
  }
  stack || (stack = new Stack);
  return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
}

/**
 * The base implementation of `_.isEqual` which supports partial comparisons
 * and tracks traversed objects.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {boolean} bitmask The bitmask flags.
 *  1 - Unordered comparison
 *  2 - Partial comparison
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {Object} [stack] Tracks traversed `value` and `other` objects.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */
function baseIsEqual(value, other, bitmask, customizer, stack) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || (!isObjectLike(value) && !isObjectLike(other))) {
    return value !== value && other !== other;
  }
  return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
}

/** `Object#toString` result references. */
var stringTag = '[object String]';

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a string, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray$2(value) && isObjectLike(value) && baseGetTag(value) == stringTag);
}

/**
 * Performs a deep comparison between two values to determine if they are
 * equivalent.
 *
 * **Note:** This method supports comparing arrays, array buffers, booleans,
 * date objects, error objects, maps, numbers, `Object` objects, regexes,
 * sets, strings, symbols, and typed arrays. `Object` objects are compared
 * by their own, not inherited, enumerable properties. Functions and DOM
 * nodes are compared by strict equality, i.e. `===`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.isEqual(object, other);
 * // => true
 *
 * object === other;
 * // => false
 */
function isEqual(value, other) {
  return baseIsEqual(value, other);
}

/** `Object#toString` result references. */
var numberTag = '[object Number]';

/**
 * Checks if `value` is classified as a `Number` primitive or object.
 *
 * **Note:** To exclude `Infinity`, `-Infinity`, and `NaN`, which are
 * classified as numbers, use the `_.isFinite` method.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a number, else `false`.
 * @example
 *
 * _.isNumber(3);
 * // => true
 *
 * _.isNumber(Number.MIN_VALUE);
 * // => true
 *
 * _.isNumber(Infinity);
 * // => true
 *
 * _.isNumber('3');
 * // => false
 */
function isNumber(value) {
  return typeof value == 'number' ||
    (isObjectLike(value) && baseGetTag(value) == numberTag);
}

// TODO possibly copy loose equality from math.gl
const dot$1 = (a, b) => a.map((_x, i) => a[i] * b[i]).reduce((m, n) => m + n);
const bboxVertices = (x = 0, y = 0, width = 100, height = 100) => [
    [x, y], [x + width, y], [x + width, y + height], [x, y + height]
];
const bboxCorners = (x = 0, y = 0, width = 100, height = 100) => [
    [x, y], [x + width, y + height],
];
/**
 * Cyrus-Beck Algorithm
 *  for use with convex bounds
 *
 * @param line [ point1[ x,y ], point2[ x,y ] ]
 * @param vertices [ boundingCorner[ x,y ]... ]
 *
 * @link https://www.geeksforgeeks.org/line-clipping-set-2-cyrus-beck-algorithm/
 * @link https://gist.github.com/w8r/7b701519a7c5b4840bec4609ceab3171
 */
const cyrusBeck = (line, vertices = bboxVertices()) => {
    const x = 0; //array index
    const y = 1; //array index
    const n = vertices.length;
    // Normals initialized dynamically(can do it statically also, doesn't matter)
    const normal = [];
    // Calculating the normals
    for (let i = 0; i < n; i++) {
        normal[i] = [0, 0];
        normal[i][y] = vertices[(i + 1) % n][x] - vertices[i][x];
        normal[i][x] = vertices[i][y] - vertices[(i + 1) % n][y];
    }
    // Calculating P1 - P0
    const P1_P0 = [
        line[1][x] - line[0][x],
        line[1][y] - line[0][y]
    ];
    // Initializing all values of P0 - PEi
    let P0_PEi = [];
    // Calculating the values of P0 - PEi for all edges
    for (let i = 0; i < n; i++) {
        // Calculating PEi - P0, so that the
        // denominator won't have to multiply by -1
        // while calculating 't'
        P0_PEi[i] = [
            vertices[i][x] - line[0][x],
            vertices[i][y] - line[0][y]
        ];
    }
    // Initializing the 't' values dynamically
    let t = [];
    // Making two vectors called 't entering'
    // and 't leaving' to group the 't's
    // according to their denominators
    let tE = [], tL = [];
    // Calculating 't' and grouping them accordingly
    for (let i = 0; i < n; i++) {
        let numerator = dot$1(normal[i], P0_PEi[i]);
        let denominator = dot$1(normal[i], P1_P0);
        t[i] = numerator / denominator;
        if (denominator > 0)
            tE.push(t[i]);
        else
            tL.push(t[i]);
    }
    // Initializing the final two values of 't'
    // Taking the max of all 'tE' and 0
    let tEntering = Math.max(0, ...tE);
    // Taking the min of all 'tL' and 1
    let tLeaving = Math.min(1, ...tL);
    // Entering 't' value cannot be
    // greater than exiting 't' value,
    // hence, this is the case when the line
    // is completely outside
    if (tEntering > tLeaving)
        return null;
    // Calculating the coordinates in terms of x and y
    let newLine = [[0, 0], [0, 0]];
    newLine[0][x] = line[0][x] + P1_P0[x] * tEntering;
    newLine[0][y] = line[0][y] + P1_P0[y] * tEntering;
    newLine[1][x] = line[0][x] + P1_P0[x] * tLeaving;
    newLine[1][y] = line[0][y] + P1_P0[y] * tLeaving;
    // Extra - Check if they were collapsed to a point.
    if (isEqual(newLine[0], newLine[1]))
        return null;
    return newLine;
};
/**
 * Liang-Barsky function by Daniel White
 *  for use with rectangular bounds
 *
 * @param line [ point1[ x,y ], point2[ x,y ] ]
 * @param bbox [ minCorner[ x,y ], maxCorner[ x,y ] ]
 *
 * @link http://www.skytopia.com/project/articles/compsci/clipping.html
 * @link https://gist.github.com/w8r/7b701519a7c5b4840bec4609ceab3171
 */
function liangBarsky(line, bbox = bboxCorners()) {
    var [[x0, y0], [x1, y1]] = line;
    var [[xmin, ymin], [xmax, ymax]] = bbox;
    var t0 = 0, t1 = 1;
    var dx = x1 - x0, dy = y1 - y0;
    var p = 0, //default eq0 for typescript
    q = 0, r = 0;
    for (var edge = 0; edge < 4; edge++) { // Traverse through left, right, bottom, top edges.
        if (edge === 0) {
            p = -dx;
            q = -(xmin - x0);
        }
        if (edge === 1) {
            p = dx;
            q = (xmax - x0);
        }
        if (edge === 2) {
            p = -dy;
            q = -(ymin - y0);
        }
        if (edge === 3) {
            p = dy;
            q = (ymax - y0);
        }
        r = q / p;
        if (p === 0 && q < 0)
            return null; // Don't draw line at all. (parallel line outside)
        if (p < 0) {
            if (r > t1)
                return null; // Don't draw line at all.
            else if (r > t0)
                t0 = r; // Line is clipped!
        }
        else if (p > 0) {
            if (r < t0)
                return null; // Don't draw line at all.
            else if (r < t1)
                t1 = r; // Line is clipped!
        }
    }
    return [
        [x0 + t0 * dx, y0 + t0 * dy],
        [x0 + t1 * dx, y0 + t1 * dy]
    ];
}

// P5 Math https://github.com/trembl/p5.Math.js //

// Converts from degrees to radians.
const radians = (degs) => degs * (Math.PI / 180.0);
const toRadians = radians;

// Converts from radians to degrees.
const degrees = rads => rads * (180.0 / Math.PI);
const toDegrees = degrees;

const constrain = (amt, low, high) => (amt < low) ? low : ((amt > high) ? high : amt);

const dist = (x1, y1, x2, y2) => Math.sqrt(p5.sq(x2 - x1) + p5.sq(y2 - y1));

const lerp = (start, stop, amt) => start + (stop - start) * amt;

const norm = (value, start, stop) => (value - start) / (stop - start);
const normalize = norm;

const map = (value, istart, istop, ostart, ostop) => {
  return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
};

let _random = Math.random;
const setRandomFunction = (randomFunction = Math.random) => _random = randomFunction;

const random = (min, max) => {
  let rand = _random();
  if (typeof min === 'undefined') return rand;
  else if (typeof max === 'undefined') {
    if (min instanceof Array) return min[Math.floor(rand * min.length)];
    else return rand * min;
  } else {
    if (min > max) {
      let tmp = min;
      min = max;
      max = tmp;
    }
    return rand * (max - min) + min;
  }
};

// Random Integer with min and max inclusive
const randomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(random() * (max - min + 1)) + min;
};

const coin = (odds = 0.5) => {
  if (random() < odds) return true;
  else return false;
};

const coinInt = (odds = 0.5) => +coin(odds);

const flipAdd = (a, b, odds = 0.5) => {
  if (coin(odds)) return a + b;
  else return a - b;
};

// Durstenfeld shuffle
// Array is passed by reference, this edits the original.
// We return it for convenience.
const shuffleArray = (array) => {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
};

// Randomized Index Generator
const generateRandomIndex = (length) => {
  const array = [];
  for (var i = 0; i < length; i++) array[i] = i;
  shuffleArray(array);
  return array;
};

const randomWeighted = (items, _weights = Array(20).fill(1)) => {
  // https://github.com/trekhleb/javascript-algorithms/blob/master/src/algorithms/statistics/weighted-random/weightedRandom.js
  if (!items.length) throw new Error('Items must not be empty');

  var weights = _weights.slice(0); //clone

  var i = 0;
  for (i = 0; i < weights.length; i++) 
    weights[i] += weights[i - 1] || 0;
  
  var rand = random() * weights[weights.length - 1];
  
  for (i = 0; i < weights.length; i++)
    if (weights[i] > rand) break;

  return items[i];
};

// Print functions /////////////////////////////////////////////////////

let verbose = true;
const setVerbose = (v) => verbose = v;

const print = (...args) => {
  if (verbose) console.log(...args);
};

const warn = (...args) => {
  if (verbose) console.warn(...args);
};

const error = console.error;

const newl = () => print("");
const newline = newl;

const tokenize = str => str.split(/\s+/);

// P5.js Supplemental //////////////////////////////////////////////////

const calcScale = (c, i, mode) => {

  //Calculate scale value to fill canvas
  var aspectC = c.width / c.height;
  var aspectI = i.width / i.height;

  switch (mode) {
    case "FILL":
    case "fill":
      if (aspectC >= aspectI) return c.width / i.width;
      else return c.height / i.height;
    case "FIT":
    case "fit":
      if (aspectC <= aspectI) return c.width / i.width;
      else return c.height / i.height;
    default:
      error("CEM.calcScale(): argument 3 should be 'fill' or 'fit'\nNo scaling calculated.");
      return 1;
  }
};

const calcFillScale = (c, i) => {
  warn("CEM.calcFillScale() deprecated. Use calcScale().");
  calcScale(c, i, "fill");
};

// Math Functions //////////////////////////////////////////////////////
//
const findStep = (func, value, step) => {
    if (step == 0)
        return 0; //throw?
    return step * func(value / step);
};
const roundStep = function (value, step = 1) { return findStep(Math.round, value, step); };
const floorStep = function (value, step = 1) { return findStep(Math.floor, value, step); };
const ceilStep = function (value, step = 1) { return findStep(Math.ceil, value, step); };
const mod = (a, b) => {
    return (((a % b) + b) % b);
};

// UI Zoom Feature /////////////////////////////////////////////////////

class UIZoom {
  
  constructor(minimumZoom = 1, maximumZoom = 15, startingZoom = 1, interaction = true) {

    this.minZoom = minimumZoom;
    this.maxZoom = maximumZoom;
    this.zoom = this.startingZoom = constrain(startingZoom, minimumZoom, maximumZoom);

    this.windowX = window.innerWidth;
    this.windowY = window.innerHeight;
    this.translateX = (-0.5 * window.innerWidth * this.zoom) + 0.5 * window.innerWidth;
    this.translateY = (-0.5 * window.innerHeight * this.zoom) + 0.5 * window.innerHeight;
    this.mouseX = 0;
    this.mouseY = 0;
    this.pmouseX = 0;
    this.pmouseY = 0;

    this.interaction = interaction;
    window.addEventListener('resize', this.onWindowResize.bind(this));
    document.addEventListener("mousemove", this.onMouseMove.bind(this));
    document.addEventListener("wheel", this.onMouseWheel.bind(this));
  }

  setInteraction(on) {
    this.interaction = on;
  }

  onMouseMove(e) {
    if (!this.interaction) return;

    this.pmouseX = this.mouseX;
    this.pmouseY = this.mouseY;
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;

    if (e.buttons != 0) {
      //Viewport Pan
      this.translateX += this.mouseX - this.pmouseX;
      this.translateY += this.mouseY - this.pmouseY;
      //Constraints
      this.translateX = constrain(this.translateX, -(this.zoom - 1) * window.innerWidth, 0);
      this.translateY = constrain(this.translateY, -(this.zoom - 1) * window.innerHeight, 0);
    }
  }

  onMouseWheel(e) {
    if (!this.interaction) return;

    let sourceX = this.mouseX;
    let sourceY = this.mouseY;
    this.translateX -= sourceX;
    this.translateY -= sourceY;
    var rate = 1.07;
    var delta = (e.deltaY / 100) < 0 ? rate : (e.deltaY / 100) > 0 ? 1.0 / rate : 1.0;
    var scaleNew = this.zoom * delta;
    scaleNew = constrain(scaleNew, this.minZoom, this.maxZoom); //Constraints
    this.translateX *= scaleNew / this.zoom;
    this.translateY *= scaleNew / this.zoom;
    this.zoom = scaleNew;
    this.translateX += sourceX;
    this.translateY += sourceY;

    //Constraints
    this.translateX = constrain(this.translateX, -(this.zoom - 1) * window.innerWidth, 0);
    this.translateY = constrain(this.translateY, -(this.zoom - 1) * window.innerHeight, 0);
  }

  onWindowResize() {
    var oldW = this.windowX;
    var oldH = this.windowY;
    this.windowX = window.innerWidth;
    this.windowY = window.innerHeight;
    this.translateX = map(this.translateX, 0, oldW, 0, this.windowX);
    this.translateY = map(this.translateY, 0, oldH, 0, this.windowY);
  }

  reset() {
    this.zoom = this.startingZoom;
    this.translateX = (-0.5 * window.innerWidth * this.zoom) + 0.5 * window.innerWidth;
    this.translateY = (-0.5 * window.innerHeight * this.zoom) + 0.5 * window.innerHeight;
  }

  get() {
    return {
      x: this.translateX,
      y: this.translateY,
      s: this.zoom
    };
  }

  getPercent() {

    let mapLin = function (i, logStart, logEnd, linStart, linEnd) {
      let b = Math.log(logEnd / logStart) / (linEnd - linStart);
      let a = logStart * Math.exp(-b * linStart);
      return Math.log(i / a) / b;
    };

    return {
      x: normalize(this.translateX, 0, -(this.zoom - 1) * window.innerWidth) || 0.5,
      y: normalize(this.translateY, 0, -(this.zoom - 1) * window.innerHeight) || 0.5,
      s: mapLin(this.zoom, this.minZoom, this.maxZoom, 0, 1)
    };
  }


  setPercent(sxs, _yx, __y) {
    let doScale = false,
      doMove = false,
      s, x, y;

    if (typeof sxs === 'undefined') return;
    else if (typeof _yx === 'undefined') {
      //scale mode
      s = sxs;
      doScale = true;
    } else if (typeof __y === 'undefined') {
      //position mode
      x = sxs;
      y = _yx;
      doMove = true;
    } else {
      //dual mode
      s = sxs;
      x = _yx;
      y = __y;
      doScale = true;
      doMove = true;
    }

    if (doScale) {
      let mapLog = function (i, linStart, linEnd, logStart, logEnd) {
        let b = Math.log(logEnd / logStart) / (linEnd - linStart);
        let a = logStart * Math.exp(-b * linStart);
        return a * Math.exp(b * i);
      };

      let sourceX = this.windowX * this.getPercent().x;
      let sourceY = this.windowY * this.getPercent().y;
      this.translateX -= sourceX;
      this.translateY -= sourceY;
      let scaleNew = mapLog(s, 0, 1, this.minZoom, this.maxZoom);
      this.translateX *= scaleNew / this.zoom;
      this.translateY *= scaleNew / this.zoom;
      this.zoom = scaleNew;
      this.translateX += sourceX;
      this.translateY += sourceY;

      //Constraints
      this.translateX = constrain(this.translateX, -(this.zoom - 1) * window.innerWidth, 0);
      this.translateY = constrain(this.translateY, -(this.zoom - 1) * window.innerHeight, 0);
    }

    if (doMove) {
      this.translateX = lerp(0, -(this.zoom - 1) * window.innerWidth, x);
      this.translateY = lerp(0, -(this.zoom - 1) * window.innerHeight, y);
    }

  }

}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var tweakpaneExports = {};
var tweakpane = {
  get exports(){ return tweakpaneExports; },
  set exports(v){ tweakpaneExports = v; },
};

/*! Tweakpane 3.1.5 (c) 2016 cocopon, licensed under the MIT license. */

(function (module, exports) {
	(function (global, factory) {
	    factory(exports) ;
	})(commonjsGlobal, (function (exports) {
	    /***
	     * A simple semantic versioning perser.
	     */
	    class Semver {
	        /**
	         * @hidden
	         */
	        constructor(text) {
	            const [core, prerelease] = text.split('-');
	            const coreComps = core.split('.');
	            this.major = parseInt(coreComps[0], 10);
	            this.minor = parseInt(coreComps[1], 10);
	            this.patch = parseInt(coreComps[2], 10);
	            this.prerelease = prerelease !== null && prerelease !== void 0 ? prerelease : null;
	        }
	        toString() {
	            const core = [this.major, this.minor, this.patch].join('.');
	            return this.prerelease !== null ? [core, this.prerelease].join('-') : core;
	        }
	    }

	    class BladeApi {
	        constructor(controller) {
	            this.controller_ = controller;
	        }
	        get element() {
	            return this.controller_.view.element;
	        }
	        get disabled() {
	            return this.controller_.viewProps.get('disabled');
	        }
	        set disabled(disabled) {
	            this.controller_.viewProps.set('disabled', disabled);
	        }
	        get hidden() {
	            return this.controller_.viewProps.get('hidden');
	        }
	        set hidden(hidden) {
	            this.controller_.viewProps.set('hidden', hidden);
	        }
	        dispose() {
	            this.controller_.viewProps.set('disposed', true);
	        }
	    }

	    class TpEvent {
	        constructor(target) {
	            this.target = target;
	        }
	    }
	    class TpChangeEvent extends TpEvent {
	        constructor(target, value, presetKey, last) {
	            super(target);
	            this.value = value;
	            this.presetKey = presetKey;
	            this.last = last !== null && last !== void 0 ? last : true;
	        }
	    }
	    class TpUpdateEvent extends TpEvent {
	        constructor(target, value, presetKey) {
	            super(target);
	            this.value = value;
	            this.presetKey = presetKey;
	        }
	    }
	    class TpFoldEvent extends TpEvent {
	        constructor(target, expanded) {
	            super(target);
	            this.expanded = expanded;
	        }
	    }
	    class TpTabSelectEvent extends TpEvent {
	        constructor(target, index) {
	            super(target);
	            this.index = index;
	        }
	    }

	    function forceCast(v) {
	        return v;
	    }
	    function isEmpty(value) {
	        return value === null || value === undefined;
	    }
	    function deepEqualsArray(a1, a2) {
	        if (a1.length !== a2.length) {
	            return false;
	        }
	        for (let i = 0; i < a1.length; i++) {
	            if (a1[i] !== a2[i]) {
	                return false;
	            }
	        }
	        return true;
	    }
	    function isPropertyWritable(obj, key) {
	        let target = obj;
	        do {
	            const d = Object.getOwnPropertyDescriptor(target, key);
	            if (d && (d.set !== undefined || d.writable === true)) {
	                return true;
	            }
	            target = Object.getPrototypeOf(target);
	        } while (target !== null);
	        return false;
	    }

	    const CREATE_MESSAGE_MAP = {
	        alreadydisposed: () => 'View has been already disposed',
	        invalidparams: (context) => `Invalid parameters for '${context.name}'`,
	        nomatchingcontroller: (context) => `No matching controller for '${context.key}'`,
	        nomatchingview: (context) => `No matching view for '${JSON.stringify(context.params)}'`,
	        notbindable: () => `Value is not bindable`,
	        propertynotfound: (context) => `Property '${context.name}' not found`,
	        shouldneverhappen: () => 'This error should never happen',
	    };
	    class TpError {
	        static alreadyDisposed() {
	            return new TpError({ type: 'alreadydisposed' });
	        }
	        static notBindable() {
	            return new TpError({
	                type: 'notbindable',
	            });
	        }
	        static propertyNotFound(name) {
	            return new TpError({
	                type: 'propertynotfound',
	                context: {
	                    name: name,
	                },
	            });
	        }
	        static shouldNeverHappen() {
	            return new TpError({ type: 'shouldneverhappen' });
	        }
	        constructor(config) {
	            var _a;
	            this.message =
	                (_a = CREATE_MESSAGE_MAP[config.type](forceCast(config.context))) !== null && _a !== void 0 ? _a : 'Unexpected error';
	            this.name = this.constructor.name;
	            this.stack = new Error(this.message).stack;
	            this.type = config.type;
	        }
	    }

	    class BindingTarget {
	        constructor(obj, key, opt_id) {
	            this.obj_ = obj;
	            this.key_ = key;
	            this.presetKey_ = opt_id !== null && opt_id !== void 0 ? opt_id : key;
	        }
	        static isBindable(obj) {
	            if (obj === null) {
	                return false;
	            }
	            if (typeof obj !== 'object') {
	                return false;
	            }
	            return true;
	        }
	        get key() {
	            return this.key_;
	        }
	        get presetKey() {
	            return this.presetKey_;
	        }
	        read() {
	            return this.obj_[this.key_];
	        }
	        write(value) {
	            this.obj_[this.key_] = value;
	        }
	        writeProperty(name, value) {
	            const valueObj = this.read();
	            if (!BindingTarget.isBindable(valueObj)) {
	                throw TpError.notBindable();
	            }
	            if (!(name in valueObj)) {
	                throw TpError.propertyNotFound(name);
	            }
	            valueObj[name] = value;
	        }
	    }

	    class ButtonApi extends BladeApi {
	        get label() {
	            return this.controller_.props.get('label');
	        }
	        set label(label) {
	            this.controller_.props.set('label', label);
	        }
	        get title() {
	            var _a;
	            return (_a = this.controller_.valueController.props.get('title')) !== null && _a !== void 0 ? _a : '';
	        }
	        set title(title) {
	            this.controller_.valueController.props.set('title', title);
	        }
	        on(eventName, handler) {
	            const bh = handler.bind(this);
	            const emitter = this.controller_.valueController.emitter;
	            emitter.on(eventName, () => {
	                bh(new TpEvent(this));
	            });
	            return this;
	        }
	    }

	    class Emitter {
	        constructor() {
	            this.observers_ = {};
	        }
	        on(eventName, handler) {
	            let observers = this.observers_[eventName];
	            if (!observers) {
	                observers = this.observers_[eventName] = [];
	            }
	            observers.push({
	                handler: handler,
	            });
	            return this;
	        }
	        off(eventName, handler) {
	            const observers = this.observers_[eventName];
	            if (observers) {
	                this.observers_[eventName] = observers.filter((observer) => {
	                    return observer.handler !== handler;
	                });
	            }
	            return this;
	        }
	        emit(eventName, event) {
	            const observers = this.observers_[eventName];
	            if (!observers) {
	                return;
	            }
	            observers.forEach((observer) => {
	                observer.handler(event);
	            });
	        }
	    }

	    const PREFIX = 'tp';
	    function ClassName(viewName) {
	        const fn = (opt_elementName, opt_modifier) => {
	            return [
	                PREFIX,
	                '-',
	                viewName,
	                'v',
	                opt_elementName ? `_${opt_elementName}` : '',
	                opt_modifier ? `-${opt_modifier}` : '',
	            ].join('');
	        };
	        return fn;
	    }

	    function compose(h1, h2) {
	        return (input) => h2(h1(input));
	    }
	    function extractValue(ev) {
	        return ev.rawValue;
	    }
	    function bindValue(value, applyValue) {
	        value.emitter.on('change', compose(extractValue, applyValue));
	        applyValue(value.rawValue);
	    }
	    function bindValueMap(valueMap, key, applyValue) {
	        bindValue(valueMap.value(key), applyValue);
	    }

	    function applyClass(elem, className, active) {
	        if (active) {
	            elem.classList.add(className);
	        }
	        else {
	            elem.classList.remove(className);
	        }
	    }
	    function valueToClassName(elem, className) {
	        return (value) => {
	            applyClass(elem, className, value);
	        };
	    }
	    function bindValueToTextContent(value, elem) {
	        bindValue(value, (text) => {
	            elem.textContent = text !== null && text !== void 0 ? text : '';
	        });
	    }

	    const className$q = ClassName('btn');
	    class ButtonView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$q());
	            config.viewProps.bindClassModifiers(this.element);
	            const buttonElem = doc.createElement('button');
	            buttonElem.classList.add(className$q('b'));
	            config.viewProps.bindDisabled(buttonElem);
	            this.element.appendChild(buttonElem);
	            this.buttonElement = buttonElem;
	            const titleElem = doc.createElement('div');
	            titleElem.classList.add(className$q('t'));
	            bindValueToTextContent(config.props.value('title'), titleElem);
	            this.buttonElement.appendChild(titleElem);
	        }
	    }

	    class ButtonController {
	        constructor(doc, config) {
	            this.emitter = new Emitter();
	            this.onClick_ = this.onClick_.bind(this);
	            this.props = config.props;
	            this.viewProps = config.viewProps;
	            this.view = new ButtonView(doc, {
	                props: this.props,
	                viewProps: this.viewProps,
	            });
	            this.view.buttonElement.addEventListener('click', this.onClick_);
	        }
	        onClick_() {
	            this.emitter.emit('click', {
	                sender: this,
	            });
	        }
	    }

	    class BoundValue {
	        constructor(initialValue, config) {
	            var _a;
	            this.constraint_ = config === null || config === void 0 ? void 0 : config.constraint;
	            this.equals_ = (_a = config === null || config === void 0 ? void 0 : config.equals) !== null && _a !== void 0 ? _a : ((v1, v2) => v1 === v2);
	            this.emitter = new Emitter();
	            this.rawValue_ = initialValue;
	        }
	        get constraint() {
	            return this.constraint_;
	        }
	        get rawValue() {
	            return this.rawValue_;
	        }
	        set rawValue(rawValue) {
	            this.setRawValue(rawValue, {
	                forceEmit: false,
	                last: true,
	            });
	        }
	        setRawValue(rawValue, options) {
	            const opts = options !== null && options !== void 0 ? options : {
	                forceEmit: false,
	                last: true,
	            };
	            const constrainedValue = this.constraint_
	                ? this.constraint_.constrain(rawValue)
	                : rawValue;
	            const prevValue = this.rawValue_;
	            const changed = !this.equals_(prevValue, constrainedValue);
	            if (!changed && !opts.forceEmit) {
	                return;
	            }
	            this.emitter.emit('beforechange', {
	                sender: this,
	            });
	            this.rawValue_ = constrainedValue;
	            this.emitter.emit('change', {
	                options: opts,
	                previousRawValue: prevValue,
	                rawValue: constrainedValue,
	                sender: this,
	            });
	        }
	    }

	    class PrimitiveValue {
	        constructor(initialValue) {
	            this.emitter = new Emitter();
	            this.value_ = initialValue;
	        }
	        get rawValue() {
	            return this.value_;
	        }
	        set rawValue(value) {
	            this.setRawValue(value, {
	                forceEmit: false,
	                last: true,
	            });
	        }
	        setRawValue(value, options) {
	            const opts = options !== null && options !== void 0 ? options : {
	                forceEmit: false,
	                last: true,
	            };
	            const prevValue = this.value_;
	            if (prevValue === value && !opts.forceEmit) {
	                return;
	            }
	            this.emitter.emit('beforechange', {
	                sender: this,
	            });
	            this.value_ = value;
	            this.emitter.emit('change', {
	                options: opts,
	                previousRawValue: prevValue,
	                rawValue: this.value_,
	                sender: this,
	            });
	        }
	    }

	    function createValue(initialValue, config) {
	        const constraint = config === null || config === void 0 ? void 0 : config.constraint;
	        const equals = config === null || config === void 0 ? void 0 : config.equals;
	        if (!constraint && !equals) {
	            return new PrimitiveValue(initialValue);
	        }
	        return new BoundValue(initialValue, config);
	    }

	    class ValueMap {
	        constructor(valueMap) {
	            this.emitter = new Emitter();
	            this.valMap_ = valueMap;
	            for (const key in this.valMap_) {
	                const v = this.valMap_[key];
	                v.emitter.on('change', () => {
	                    this.emitter.emit('change', {
	                        key: key,
	                        sender: this,
	                    });
	                });
	            }
	        }
	        static createCore(initialValue) {
	            const keys = Object.keys(initialValue);
	            return keys.reduce((o, key) => {
	                return Object.assign(o, {
	                    [key]: createValue(initialValue[key]),
	                });
	            }, {});
	        }
	        static fromObject(initialValue) {
	            const core = this.createCore(initialValue);
	            return new ValueMap(core);
	        }
	        get(key) {
	            return this.valMap_[key].rawValue;
	        }
	        set(key, value) {
	            this.valMap_[key].rawValue = value;
	        }
	        value(key) {
	            return this.valMap_[key];
	        }
	    }

	    function parseObject(value, keyToParserMap) {
	        const keys = Object.keys(keyToParserMap);
	        const result = keys.reduce((tmp, key) => {
	            if (tmp === undefined) {
	                return undefined;
	            }
	            const parser = keyToParserMap[key];
	            const result = parser(value[key]);
	            return result.succeeded
	                ? Object.assign(Object.assign({}, tmp), { [key]: result.value }) : undefined;
	        }, {});
	        return forceCast(result);
	    }
	    function parseArray(value, parseItem) {
	        return value.reduce((tmp, item) => {
	            if (tmp === undefined) {
	                return undefined;
	            }
	            const result = parseItem(item);
	            if (!result.succeeded || result.value === undefined) {
	                return undefined;
	            }
	            return [...tmp, result.value];
	        }, []);
	    }
	    function isObject(value) {
	        if (value === null) {
	            return false;
	        }
	        return typeof value === 'object';
	    }
	    function createParamsParserBuilder(parse) {
	        return (optional) => (v) => {
	            if (!optional && v === undefined) {
	                return {
	                    succeeded: false,
	                    value: undefined,
	                };
	            }
	            if (optional && v === undefined) {
	                return {
	                    succeeded: true,
	                    value: undefined,
	                };
	            }
	            const result = parse(v);
	            return result !== undefined
	                ? {
	                    succeeded: true,
	                    value: result,
	                }
	                : {
	                    succeeded: false,
	                    value: undefined,
	                };
	        };
	    }
	    function createParamsParserBuilders(optional) {
	        return {
	            custom: (parse) => createParamsParserBuilder(parse)(optional),
	            boolean: createParamsParserBuilder((v) => typeof v === 'boolean' ? v : undefined)(optional),
	            number: createParamsParserBuilder((v) => typeof v === 'number' ? v : undefined)(optional),
	            string: createParamsParserBuilder((v) => typeof v === 'string' ? v : undefined)(optional),
	            function: createParamsParserBuilder((v) =>
	            typeof v === 'function' ? v : undefined)(optional),
	            constant: (value) => createParamsParserBuilder((v) => (v === value ? value : undefined))(optional),
	            raw: createParamsParserBuilder((v) => v)(optional),
	            object: (keyToParserMap) => createParamsParserBuilder((v) => {
	                if (!isObject(v)) {
	                    return undefined;
	                }
	                return parseObject(v, keyToParserMap);
	            })(optional),
	            array: (itemParser) => createParamsParserBuilder((v) => {
	                if (!Array.isArray(v)) {
	                    return undefined;
	                }
	                return parseArray(v, itemParser);
	            })(optional),
	        };
	    }
	    const ParamsParsers = {
	        optional: createParamsParserBuilders(true),
	        required: createParamsParserBuilders(false),
	    };
	    function parseParams(value, keyToParserMap) {
	        const result = ParamsParsers.required.object(keyToParserMap)(value);
	        return result.succeeded ? result.value : undefined;
	    }

	    function warnMissing(info) {
	        console.warn([
	            `Missing '${info.key}' of ${info.target} in ${info.place}.`,
	            'Please rebuild plugins with the latest core package.',
	        ].join(' '));
	    }

	    function disposeElement(elem) {
	        if (elem && elem.parentElement) {
	            elem.parentElement.removeChild(elem);
	        }
	        return null;
	    }

	    class ReadonlyValue {
	        constructor(value) {
	            this.value_ = value;
	        }
	        static create(value) {
	            return [
	                new ReadonlyValue(value),
	                (rawValue, options) => {
	                    value.setRawValue(rawValue, options);
	                },
	            ];
	        }
	        get emitter() {
	            return this.value_.emitter;
	        }
	        get rawValue() {
	            return this.value_.rawValue;
	        }
	    }

	    const className$p = ClassName('');
	    function valueToModifier(elem, modifier) {
	        return valueToClassName(elem, className$p(undefined, modifier));
	    }
	    class ViewProps extends ValueMap {
	        constructor(valueMap) {
	            var _a;
	            super(valueMap);
	            this.onDisabledChange_ = this.onDisabledChange_.bind(this);
	            this.onParentChange_ = this.onParentChange_.bind(this);
	            this.onParentGlobalDisabledChange_ =
	                this.onParentGlobalDisabledChange_.bind(this);
	            [this.globalDisabled_, this.setGlobalDisabled_] = ReadonlyValue.create(createValue(this.getGlobalDisabled_()));
	            this.value('disabled').emitter.on('change', this.onDisabledChange_);
	            this.value('parent').emitter.on('change', this.onParentChange_);
	            (_a = this.get('parent')) === null || _a === void 0 ? void 0 : _a.globalDisabled.emitter.on('change', this.onParentGlobalDisabledChange_);
	        }
	        static create(opt_initialValue) {
	            var _a, _b, _c;
	            const initialValue = opt_initialValue !== null && opt_initialValue !== void 0 ? opt_initialValue : {};
	            return new ViewProps(ValueMap.createCore({
	                disabled: (_a = initialValue.disabled) !== null && _a !== void 0 ? _a : false,
	                disposed: false,
	                hidden: (_b = initialValue.hidden) !== null && _b !== void 0 ? _b : false,
	                parent: (_c = initialValue.parent) !== null && _c !== void 0 ? _c : null,
	            }));
	        }
	        get globalDisabled() {
	            return this.globalDisabled_;
	        }
	        bindClassModifiers(elem) {
	            bindValue(this.globalDisabled_, valueToModifier(elem, 'disabled'));
	            bindValueMap(this, 'hidden', valueToModifier(elem, 'hidden'));
	        }
	        bindDisabled(target) {
	            bindValue(this.globalDisabled_, (disabled) => {
	                target.disabled = disabled;
	            });
	        }
	        bindTabIndex(elem) {
	            bindValue(this.globalDisabled_, (disabled) => {
	                elem.tabIndex = disabled ? -1 : 0;
	            });
	        }
	        handleDispose(callback) {
	            this.value('disposed').emitter.on('change', (disposed) => {
	                if (disposed) {
	                    callback();
	                }
	            });
	        }
	        getGlobalDisabled_() {
	            const parent = this.get('parent');
	            const parentDisabled = parent ? parent.globalDisabled.rawValue : false;
	            return parentDisabled || this.get('disabled');
	        }
	        updateGlobalDisabled_() {
	            this.setGlobalDisabled_(this.getGlobalDisabled_());
	        }
	        onDisabledChange_() {
	            this.updateGlobalDisabled_();
	        }
	        onParentGlobalDisabledChange_() {
	            this.updateGlobalDisabled_();
	        }
	        onParentChange_(ev) {
	            var _a;
	            const prevParent = ev.previousRawValue;
	            prevParent === null || prevParent === void 0 ? void 0 : prevParent.globalDisabled.emitter.off('change', this.onParentGlobalDisabledChange_);
	            (_a = this.get('parent')) === null || _a === void 0 ? void 0 : _a.globalDisabled.emitter.on('change', this.onParentGlobalDisabledChange_);
	            this.updateGlobalDisabled_();
	        }
	    }

	    function getAllBladePositions() {
	        return ['veryfirst', 'first', 'last', 'verylast'];
	    }

	    const className$o = ClassName('');
	    const POS_TO_CLASS_NAME_MAP = {
	        veryfirst: 'vfst',
	        first: 'fst',
	        last: 'lst',
	        verylast: 'vlst',
	    };
	    class BladeController {
	        constructor(config) {
	            this.parent_ = null;
	            this.blade = config.blade;
	            this.view = config.view;
	            this.viewProps = config.viewProps;
	            const elem = this.view.element;
	            this.blade.value('positions').emitter.on('change', () => {
	                getAllBladePositions().forEach((pos) => {
	                    elem.classList.remove(className$o(undefined, POS_TO_CLASS_NAME_MAP[pos]));
	                });
	                this.blade.get('positions').forEach((pos) => {
	                    elem.classList.add(className$o(undefined, POS_TO_CLASS_NAME_MAP[pos]));
	                });
	            });
	            this.viewProps.handleDispose(() => {
	                disposeElement(elem);
	            });
	        }
	        get parent() {
	            return this.parent_;
	        }
	        set parent(parent) {
	            this.parent_ = parent;
	            if (!('parent' in this.viewProps.valMap_)) {
	                warnMissing({
	                    key: 'parent',
	                    target: ViewProps.name,
	                    place: 'BladeController.parent',
	                });
	                return;
	            }
	            this.viewProps.set('parent', this.parent_ ? this.parent_.viewProps : null);
	        }
	    }

	    const SVG_NS = 'http://www.w3.org/2000/svg';
	    function forceReflow(element) {
	        element.offsetHeight;
	    }
	    function disableTransitionTemporarily(element, callback) {
	        const t = element.style.transition;
	        element.style.transition = 'none';
	        callback();
	        element.style.transition = t;
	    }
	    function supportsTouch(doc) {
	        return doc.ontouchstart !== undefined;
	    }
	    function getGlobalObject() {
	        return globalThis;
	    }
	    function getWindowDocument() {
	        const globalObj = forceCast(getGlobalObject());
	        return globalObj.document;
	    }
	    function getCanvasContext(canvasElement) {
	        const win = canvasElement.ownerDocument.defaultView;
	        if (!win) {
	            return null;
	        }
	        const isBrowser = 'document' in win;
	        return isBrowser
	            ? canvasElement.getContext('2d', {
	                willReadFrequently: true,
	            })
	            : null;
	    }
	    const ICON_ID_TO_INNER_HTML_MAP = {
	        check: '<path d="M2 8l4 4l8 -8"/>',
	        dropdown: '<path d="M5 7h6l-3 3 z"/>',
	        p2dpad: '<path d="M8 4v8"/><path d="M4 8h8"/><circle cx="12" cy="12" r="1.2"/>',
	    };
	    function createSvgIconElement(document, iconId) {
	        const elem = document.createElementNS(SVG_NS, 'svg');
	        elem.innerHTML = ICON_ID_TO_INNER_HTML_MAP[iconId];
	        return elem;
	    }
	    function insertElementAt(parentElement, element, index) {
	        parentElement.insertBefore(element, parentElement.children[index]);
	    }
	    function removeElement(element) {
	        if (element.parentElement) {
	            element.parentElement.removeChild(element);
	        }
	    }
	    function removeChildElements(element) {
	        while (element.children.length > 0) {
	            element.removeChild(element.children[0]);
	        }
	    }
	    function removeChildNodes(element) {
	        while (element.childNodes.length > 0) {
	            element.removeChild(element.childNodes[0]);
	        }
	    }
	    function findNextTarget(ev) {
	        if (ev.relatedTarget) {
	            return forceCast(ev.relatedTarget);
	        }
	        if ('explicitOriginalTarget' in ev) {
	            return ev.explicitOriginalTarget;
	        }
	        return null;
	    }

	    const className$n = ClassName('lbl');
	    function createLabelNode(doc, label) {
	        const frag = doc.createDocumentFragment();
	        const lineNodes = label.split('\n').map((line) => {
	            return doc.createTextNode(line);
	        });
	        lineNodes.forEach((lineNode, index) => {
	            if (index > 0) {
	                frag.appendChild(doc.createElement('br'));
	            }
	            frag.appendChild(lineNode);
	        });
	        return frag;
	    }
	    class LabelView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$n());
	            config.viewProps.bindClassModifiers(this.element);
	            const labelElem = doc.createElement('div');
	            labelElem.classList.add(className$n('l'));
	            bindValueMap(config.props, 'label', (value) => {
	                if (isEmpty(value)) {
	                    this.element.classList.add(className$n(undefined, 'nol'));
	                }
	                else {
	                    this.element.classList.remove(className$n(undefined, 'nol'));
	                    removeChildNodes(labelElem);
	                    labelElem.appendChild(createLabelNode(doc, value));
	                }
	            });
	            this.element.appendChild(labelElem);
	            this.labelElement = labelElem;
	            const valueElem = doc.createElement('div');
	            valueElem.classList.add(className$n('v'));
	            this.element.appendChild(valueElem);
	            this.valueElement = valueElem;
	        }
	    }

	    class LabelController extends BladeController {
	        constructor(doc, config) {
	            const viewProps = config.valueController.viewProps;
	            super(Object.assign(Object.assign({}, config), { view: new LabelView(doc, {
	                    props: config.props,
	                    viewProps: viewProps,
	                }), viewProps: viewProps }));
	            this.props = config.props;
	            this.valueController = config.valueController;
	            this.view.valueElement.appendChild(this.valueController.view.element);
	        }
	    }

	    const ButtonBladePlugin = {
	        id: 'button',
	        type: 'blade',
	        accept(params) {
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                title: p.required.string,
	                view: p.required.constant('button'),
	                label: p.optional.string,
	            });
	            return result ? { params: result } : null;
	        },
	        controller(args) {
	            return new LabelController(args.document, {
	                blade: args.blade,
	                props: ValueMap.fromObject({
	                    label: args.params.label,
	                }),
	                valueController: new ButtonController(args.document, {
	                    props: ValueMap.fromObject({
	                        title: args.params.title,
	                    }),
	                    viewProps: args.viewProps,
	                }),
	            });
	        },
	        api(args) {
	            if (!(args.controller instanceof LabelController)) {
	                return null;
	            }
	            if (!(args.controller.valueController instanceof ButtonController)) {
	                return null;
	            }
	            return new ButtonApi(args.controller);
	        },
	    };

	    class ValueBladeController extends BladeController {
	        constructor(config) {
	            super(config);
	            this.value = config.value;
	        }
	    }

	    function createBlade() {
	        return new ValueMap({
	            positions: createValue([], {
	                equals: deepEqualsArray,
	            }),
	        });
	    }

	    class Foldable extends ValueMap {
	        constructor(valueMap) {
	            super(valueMap);
	        }
	        static create(expanded) {
	            const coreObj = {
	                completed: true,
	                expanded: expanded,
	                expandedHeight: null,
	                shouldFixHeight: false,
	                temporaryExpanded: null,
	            };
	            const core = ValueMap.createCore(coreObj);
	            return new Foldable(core);
	        }
	        get styleExpanded() {
	            var _a;
	            return (_a = this.get('temporaryExpanded')) !== null && _a !== void 0 ? _a : this.get('expanded');
	        }
	        get styleHeight() {
	            if (!this.styleExpanded) {
	                return '0';
	            }
	            const exHeight = this.get('expandedHeight');
	            if (this.get('shouldFixHeight') && !isEmpty(exHeight)) {
	                return `${exHeight}px`;
	            }
	            return 'auto';
	        }
	        bindExpandedClass(elem, expandedClassName) {
	            const onExpand = () => {
	                const expanded = this.styleExpanded;
	                if (expanded) {
	                    elem.classList.add(expandedClassName);
	                }
	                else {
	                    elem.classList.remove(expandedClassName);
	                }
	            };
	            bindValueMap(this, 'expanded', onExpand);
	            bindValueMap(this, 'temporaryExpanded', onExpand);
	        }
	        cleanUpTransition() {
	            this.set('shouldFixHeight', false);
	            this.set('expandedHeight', null);
	            this.set('completed', true);
	        }
	    }
	    function computeExpandedFolderHeight(folder, containerElement) {
	        let height = 0;
	        disableTransitionTemporarily(containerElement, () => {
	            folder.set('expandedHeight', null);
	            folder.set('temporaryExpanded', true);
	            forceReflow(containerElement);
	            height = containerElement.clientHeight;
	            folder.set('temporaryExpanded', null);
	            forceReflow(containerElement);
	        });
	        return height;
	    }
	    function applyHeight(foldable, elem) {
	        elem.style.height = foldable.styleHeight;
	    }
	    function bindFoldable(foldable, elem) {
	        foldable.value('expanded').emitter.on('beforechange', () => {
	            foldable.set('completed', false);
	            if (isEmpty(foldable.get('expandedHeight'))) {
	                const h = computeExpandedFolderHeight(foldable, elem);
	                if (h > 0) {
	                    foldable.set('expandedHeight', h);
	                }
	            }
	            foldable.set('shouldFixHeight', true);
	            forceReflow(elem);
	        });
	        foldable.emitter.on('change', () => {
	            applyHeight(foldable, elem);
	        });
	        applyHeight(foldable, elem);
	        elem.addEventListener('transitionend', (ev) => {
	            if (ev.propertyName !== 'height') {
	                return;
	            }
	            foldable.cleanUpTransition();
	        });
	    }

	    class RackLikeApi extends BladeApi {
	        constructor(controller, rackApi) {
	            super(controller);
	            this.rackApi_ = rackApi;
	        }
	    }

	    function addButtonAsBlade(api, params) {
	        return api.addBlade(Object.assign(Object.assign({}, params), { view: 'button' }));
	    }
	    function addFolderAsBlade(api, params) {
	        return api.addBlade(Object.assign(Object.assign({}, params), { view: 'folder' }));
	    }
	    function addSeparatorAsBlade(api, opt_params) {
	        const params = opt_params !== null && opt_params !== void 0 ? opt_params : {};
	        return api.addBlade(Object.assign(Object.assign({}, params), { view: 'separator' }));
	    }
	    function addTabAsBlade(api, params) {
	        return api.addBlade(Object.assign(Object.assign({}, params), { view: 'tab' }));
	    }

	    class NestedOrderedSet {
	        constructor(extract) {
	            this.emitter = new Emitter();
	            this.items_ = [];
	            this.cache_ = new Set();
	            this.onSubListAdd_ = this.onSubListAdd_.bind(this);
	            this.onSubListRemove_ = this.onSubListRemove_.bind(this);
	            this.extract_ = extract;
	        }
	        get items() {
	            return this.items_;
	        }
	        allItems() {
	            return Array.from(this.cache_);
	        }
	        find(callback) {
	            for (const item of this.allItems()) {
	                if (callback(item)) {
	                    return item;
	                }
	            }
	            return null;
	        }
	        includes(item) {
	            return this.cache_.has(item);
	        }
	        add(item, opt_index) {
	            if (this.includes(item)) {
	                throw TpError.shouldNeverHappen();
	            }
	            const index = opt_index !== undefined ? opt_index : this.items_.length;
	            this.items_.splice(index, 0, item);
	            this.cache_.add(item);
	            const subList = this.extract_(item);
	            if (subList) {
	                subList.emitter.on('add', this.onSubListAdd_);
	                subList.emitter.on('remove', this.onSubListRemove_);
	                subList.allItems().forEach((item) => {
	                    this.cache_.add(item);
	                });
	            }
	            this.emitter.emit('add', {
	                index: index,
	                item: item,
	                root: this,
	                target: this,
	            });
	        }
	        remove(item) {
	            const index = this.items_.indexOf(item);
	            if (index < 0) {
	                return;
	            }
	            this.items_.splice(index, 1);
	            this.cache_.delete(item);
	            const subList = this.extract_(item);
	            if (subList) {
	                subList.emitter.off('add', this.onSubListAdd_);
	                subList.emitter.off('remove', this.onSubListRemove_);
	            }
	            this.emitter.emit('remove', {
	                index: index,
	                item: item,
	                root: this,
	                target: this,
	            });
	        }
	        onSubListAdd_(ev) {
	            this.cache_.add(ev.item);
	            this.emitter.emit('add', {
	                index: ev.index,
	                item: ev.item,
	                root: this,
	                target: ev.target,
	            });
	        }
	        onSubListRemove_(ev) {
	            this.cache_.delete(ev.item);
	            this.emitter.emit('remove', {
	                index: ev.index,
	                item: ev.item,
	                root: this,
	                target: ev.target,
	            });
	        }
	    }

	    class InputBindingApi extends BladeApi {
	        constructor(controller) {
	            super(controller);
	            this.onBindingChange_ = this.onBindingChange_.bind(this);
	            this.emitter_ = new Emitter();
	            this.controller_.binding.emitter.on('change', this.onBindingChange_);
	        }
	        get label() {
	            return this.controller_.props.get('label');
	        }
	        set label(label) {
	            this.controller_.props.set('label', label);
	        }
	        on(eventName, handler) {
	            const bh = handler.bind(this);
	            this.emitter_.on(eventName, (ev) => {
	                bh(ev.event);
	            });
	            return this;
	        }
	        refresh() {
	            this.controller_.binding.read();
	        }
	        onBindingChange_(ev) {
	            const value = ev.sender.target.read();
	            this.emitter_.emit('change', {
	                event: new TpChangeEvent(this, forceCast(value), this.controller_.binding.target.presetKey, ev.options.last),
	            });
	        }
	    }

	    class InputBindingController extends LabelController {
	        constructor(doc, config) {
	            super(doc, config);
	            this.binding = config.binding;
	        }
	    }

	    class MonitorBindingApi extends BladeApi {
	        constructor(controller) {
	            super(controller);
	            this.onBindingUpdate_ = this.onBindingUpdate_.bind(this);
	            this.emitter_ = new Emitter();
	            this.controller_.binding.emitter.on('update', this.onBindingUpdate_);
	        }
	        get label() {
	            return this.controller_.props.get('label');
	        }
	        set label(label) {
	            this.controller_.props.set('label', label);
	        }
	        on(eventName, handler) {
	            const bh = handler.bind(this);
	            this.emitter_.on(eventName, (ev) => {
	                bh(ev.event);
	            });
	            return this;
	        }
	        refresh() {
	            this.controller_.binding.read();
	        }
	        onBindingUpdate_(ev) {
	            const value = ev.sender.target.read();
	            this.emitter_.emit('update', {
	                event: new TpUpdateEvent(this, forceCast(value), this.controller_.binding.target.presetKey),
	            });
	        }
	    }

	    class MonitorBindingController extends LabelController {
	        constructor(doc, config) {
	            super(doc, config);
	            this.binding = config.binding;
	            this.viewProps.bindDisabled(this.binding.ticker);
	            this.viewProps.handleDispose(() => {
	                this.binding.dispose();
	            });
	        }
	    }

	    function findSubBladeApiSet(api) {
	        if (api instanceof RackApi) {
	            return api['apiSet_'];
	        }
	        if (api instanceof RackLikeApi) {
	            return api['rackApi_']['apiSet_'];
	        }
	        return null;
	    }
	    function getApiByController(apiSet, controller) {
	        const api = apiSet.find((api) => api.controller_ === controller);
	        if (!api) {
	            throw TpError.shouldNeverHappen();
	        }
	        return api;
	    }
	    function createBindingTarget(obj, key, opt_id) {
	        if (!BindingTarget.isBindable(obj)) {
	            throw TpError.notBindable();
	        }
	        return new BindingTarget(obj, key, opt_id);
	    }
	    class RackApi extends BladeApi {
	        constructor(controller, pool) {
	            super(controller);
	            this.onRackAdd_ = this.onRackAdd_.bind(this);
	            this.onRackRemove_ = this.onRackRemove_.bind(this);
	            this.onRackInputChange_ = this.onRackInputChange_.bind(this);
	            this.onRackMonitorUpdate_ = this.onRackMonitorUpdate_.bind(this);
	            this.emitter_ = new Emitter();
	            this.apiSet_ = new NestedOrderedSet(findSubBladeApiSet);
	            this.pool_ = pool;
	            const rack = this.controller_.rack;
	            rack.emitter.on('add', this.onRackAdd_);
	            rack.emitter.on('remove', this.onRackRemove_);
	            rack.emitter.on('inputchange', this.onRackInputChange_);
	            rack.emitter.on('monitorupdate', this.onRackMonitorUpdate_);
	            rack.children.forEach((bc) => {
	                this.setUpApi_(bc);
	            });
	        }
	        get children() {
	            return this.controller_.rack.children.map((bc) => getApiByController(this.apiSet_, bc));
	        }
	        addInput(object, key, opt_params) {
	            const params = opt_params !== null && opt_params !== void 0 ? opt_params : {};
	            const doc = this.controller_.view.element.ownerDocument;
	            const bc = this.pool_.createInput(doc, createBindingTarget(object, key, params.presetKey), params);
	            const api = new InputBindingApi(bc);
	            return this.add(api, params.index);
	        }
	        addMonitor(object, key, opt_params) {
	            const params = opt_params !== null && opt_params !== void 0 ? opt_params : {};
	            const doc = this.controller_.view.element.ownerDocument;
	            const bc = this.pool_.createMonitor(doc, createBindingTarget(object, key), params);
	            const api = new MonitorBindingApi(bc);
	            return forceCast(this.add(api, params.index));
	        }
	        addFolder(params) {
	            return addFolderAsBlade(this, params);
	        }
	        addButton(params) {
	            return addButtonAsBlade(this, params);
	        }
	        addSeparator(opt_params) {
	            return addSeparatorAsBlade(this, opt_params);
	        }
	        addTab(params) {
	            return addTabAsBlade(this, params);
	        }
	        add(api, opt_index) {
	            this.controller_.rack.add(api.controller_, opt_index);
	            const gapi = this.apiSet_.find((a) => a.controller_ === api.controller_);
	            if (gapi) {
	                this.apiSet_.remove(gapi);
	            }
	            this.apiSet_.add(api);
	            return api;
	        }
	        remove(api) {
	            this.controller_.rack.remove(api.controller_);
	        }
	        addBlade(params) {
	            const doc = this.controller_.view.element.ownerDocument;
	            const bc = this.pool_.createBlade(doc, params);
	            const api = this.pool_.createBladeApi(bc);
	            return this.add(api, params.index);
	        }
	        on(eventName, handler) {
	            const bh = handler.bind(this);
	            this.emitter_.on(eventName, (ev) => {
	                bh(ev.event);
	            });
	            return this;
	        }
	        setUpApi_(bc) {
	            const api = this.apiSet_.find((api) => api.controller_ === bc);
	            if (!api) {
	                this.apiSet_.add(this.pool_.createBladeApi(bc));
	            }
	        }
	        onRackAdd_(ev) {
	            this.setUpApi_(ev.bladeController);
	        }
	        onRackRemove_(ev) {
	            if (ev.isRoot) {
	                const api = getApiByController(this.apiSet_, ev.bladeController);
	                this.apiSet_.remove(api);
	            }
	        }
	        onRackInputChange_(ev) {
	            const bc = ev.bladeController;
	            if (bc instanceof InputBindingController) {
	                const api = getApiByController(this.apiSet_, bc);
	                const binding = bc.binding;
	                this.emitter_.emit('change', {
	                    event: new TpChangeEvent(api, forceCast(binding.target.read()), binding.target.presetKey, ev.options.last),
	                });
	            }
	            else if (bc instanceof ValueBladeController) {
	                const api = getApiByController(this.apiSet_, bc);
	                this.emitter_.emit('change', {
	                    event: new TpChangeEvent(api, bc.value.rawValue, undefined, ev.options.last),
	                });
	            }
	        }
	        onRackMonitorUpdate_(ev) {
	            if (!(ev.bladeController instanceof MonitorBindingController)) {
	                throw TpError.shouldNeverHappen();
	            }
	            const api = getApiByController(this.apiSet_, ev.bladeController);
	            const binding = ev.bladeController.binding;
	            this.emitter_.emit('update', {
	                event: new TpUpdateEvent(api, forceCast(binding.target.read()), binding.target.presetKey),
	            });
	        }
	    }

	    class FolderApi extends RackLikeApi {
	        constructor(controller, pool) {
	            super(controller, new RackApi(controller.rackController, pool));
	            this.emitter_ = new Emitter();
	            this.controller_.foldable
	                .value('expanded')
	                .emitter.on('change', (ev) => {
	                this.emitter_.emit('fold', {
	                    event: new TpFoldEvent(this, ev.sender.rawValue),
	                });
	            });
	            this.rackApi_.on('change', (ev) => {
	                this.emitter_.emit('change', {
	                    event: ev,
	                });
	            });
	            this.rackApi_.on('update', (ev) => {
	                this.emitter_.emit('update', {
	                    event: ev,
	                });
	            });
	        }
	        get expanded() {
	            return this.controller_.foldable.get('expanded');
	        }
	        set expanded(expanded) {
	            this.controller_.foldable.set('expanded', expanded);
	        }
	        get title() {
	            return this.controller_.props.get('title');
	        }
	        set title(title) {
	            this.controller_.props.set('title', title);
	        }
	        get children() {
	            return this.rackApi_.children;
	        }
	        addInput(object, key, opt_params) {
	            return this.rackApi_.addInput(object, key, opt_params);
	        }
	        addMonitor(object, key, opt_params) {
	            return this.rackApi_.addMonitor(object, key, opt_params);
	        }
	        addFolder(params) {
	            return this.rackApi_.addFolder(params);
	        }
	        addButton(params) {
	            return this.rackApi_.addButton(params);
	        }
	        addSeparator(opt_params) {
	            return this.rackApi_.addSeparator(opt_params);
	        }
	        addTab(params) {
	            return this.rackApi_.addTab(params);
	        }
	        add(api, opt_index) {
	            return this.rackApi_.add(api, opt_index);
	        }
	        remove(api) {
	            this.rackApi_.remove(api);
	        }
	        addBlade(params) {
	            return this.rackApi_.addBlade(params);
	        }
	        on(eventName, handler) {
	            const bh = handler.bind(this);
	            this.emitter_.on(eventName, (ev) => {
	                bh(ev.event);
	            });
	            return this;
	        }
	    }

	    class RackLikeController extends BladeController {
	        constructor(config) {
	            super({
	                blade: config.blade,
	                view: config.view,
	                viewProps: config.rackController.viewProps,
	            });
	            this.rackController = config.rackController;
	        }
	    }

	    class PlainView {
	        constructor(doc, config) {
	            const className = ClassName(config.viewName);
	            this.element = doc.createElement('div');
	            this.element.classList.add(className());
	            config.viewProps.bindClassModifiers(this.element);
	        }
	    }

	    function findInputBindingController(bcs, b) {
	        for (let i = 0; i < bcs.length; i++) {
	            const bc = bcs[i];
	            if (bc instanceof InputBindingController && bc.binding === b) {
	                return bc;
	            }
	        }
	        return null;
	    }
	    function findMonitorBindingController(bcs, b) {
	        for (let i = 0; i < bcs.length; i++) {
	            const bc = bcs[i];
	            if (bc instanceof MonitorBindingController && bc.binding === b) {
	                return bc;
	            }
	        }
	        return null;
	    }
	    function findValueBladeController(bcs, v) {
	        for (let i = 0; i < bcs.length; i++) {
	            const bc = bcs[i];
	            if (bc instanceof ValueBladeController && bc.value === v) {
	                return bc;
	            }
	        }
	        return null;
	    }
	    function findSubRack(bc) {
	        if (bc instanceof RackController) {
	            return bc.rack;
	        }
	        if (bc instanceof RackLikeController) {
	            return bc.rackController.rack;
	        }
	        return null;
	    }
	    function findSubBladeControllerSet(bc) {
	        const rack = findSubRack(bc);
	        return rack ? rack['bcSet_'] : null;
	    }
	    class BladeRack {
	        constructor(config) {
	            var _a, _b;
	            this.onBladePositionsChange_ = this.onBladePositionsChange_.bind(this);
	            this.onSetAdd_ = this.onSetAdd_.bind(this);
	            this.onSetRemove_ = this.onSetRemove_.bind(this);
	            this.onChildDispose_ = this.onChildDispose_.bind(this);
	            this.onChildPositionsChange_ = this.onChildPositionsChange_.bind(this);
	            this.onChildInputChange_ = this.onChildInputChange_.bind(this);
	            this.onChildMonitorUpdate_ = this.onChildMonitorUpdate_.bind(this);
	            this.onChildValueChange_ = this.onChildValueChange_.bind(this);
	            this.onChildViewPropsChange_ = this.onChildViewPropsChange_.bind(this);
	            this.onDescendantLayout_ = this.onDescendantLayout_.bind(this);
	            this.onDescendantInputChange_ = this.onDescendantInputChange_.bind(this);
	            this.onDescendantMonitorUpdate_ =
	                this.onDescendantMonitorUpdate_.bind(this);
	            this.emitter = new Emitter();
	            this.blade_ = (_a = config.blade) !== null && _a !== void 0 ? _a : null;
	            (_b = this.blade_) === null || _b === void 0 ? void 0 : _b.value('positions').emitter.on('change', this.onBladePositionsChange_);
	            this.viewProps = config.viewProps;
	            this.bcSet_ = new NestedOrderedSet(findSubBladeControllerSet);
	            this.bcSet_.emitter.on('add', this.onSetAdd_);
	            this.bcSet_.emitter.on('remove', this.onSetRemove_);
	        }
	        get children() {
	            return this.bcSet_.items;
	        }
	        add(bc, opt_index) {
	            var _a;
	            (_a = bc.parent) === null || _a === void 0 ? void 0 : _a.remove(bc);
	            if (isPropertyWritable(bc, 'parent')) {
	                bc.parent = this;
	            }
	            else {
	                bc['parent_'] = this;
	                warnMissing({
	                    key: 'parent',
	                    target: 'BladeController',
	                    place: 'BladeRack.add',
	                });
	            }
	            this.bcSet_.add(bc, opt_index);
	        }
	        remove(bc) {
	            if (isPropertyWritable(bc, 'parent')) {
	                bc.parent = null;
	            }
	            else {
	                bc['parent_'] = null;
	                warnMissing({
	                    key: 'parent',
	                    target: 'BladeController',
	                    place: 'BladeRack.remove',
	                });
	            }
	            this.bcSet_.remove(bc);
	        }
	        find(controllerClass) {
	            return forceCast(this.bcSet_.allItems().filter((bc) => {
	                return bc instanceof controllerClass;
	            }));
	        }
	        onSetAdd_(ev) {
	            this.updatePositions_();
	            const isRoot = ev.target === ev.root;
	            this.emitter.emit('add', {
	                bladeController: ev.item,
	                index: ev.index,
	                isRoot: isRoot,
	                sender: this,
	            });
	            if (!isRoot) {
	                return;
	            }
	            const bc = ev.item;
	            bc.viewProps.emitter.on('change', this.onChildViewPropsChange_);
	            bc.blade
	                .value('positions')
	                .emitter.on('change', this.onChildPositionsChange_);
	            bc.viewProps.handleDispose(this.onChildDispose_);
	            if (bc instanceof InputBindingController) {
	                bc.binding.emitter.on('change', this.onChildInputChange_);
	            }
	            else if (bc instanceof MonitorBindingController) {
	                bc.binding.emitter.on('update', this.onChildMonitorUpdate_);
	            }
	            else if (bc instanceof ValueBladeController) {
	                bc.value.emitter.on('change', this.onChildValueChange_);
	            }
	            else {
	                const rack = findSubRack(bc);
	                if (rack) {
	                    const emitter = rack.emitter;
	                    emitter.on('layout', this.onDescendantLayout_);
	                    emitter.on('inputchange', this.onDescendantInputChange_);
	                    emitter.on('monitorupdate', this.onDescendantMonitorUpdate_);
	                }
	            }
	        }
	        onSetRemove_(ev) {
	            this.updatePositions_();
	            const isRoot = ev.target === ev.root;
	            this.emitter.emit('remove', {
	                bladeController: ev.item,
	                isRoot: isRoot,
	                sender: this,
	            });
	            if (!isRoot) {
	                return;
	            }
	            const bc = ev.item;
	            if (bc instanceof InputBindingController) {
	                bc.binding.emitter.off('change', this.onChildInputChange_);
	            }
	            else if (bc instanceof MonitorBindingController) {
	                bc.binding.emitter.off('update', this.onChildMonitorUpdate_);
	            }
	            else if (bc instanceof ValueBladeController) {
	                bc.value.emitter.off('change', this.onChildValueChange_);
	            }
	            else {
	                const rack = findSubRack(bc);
	                if (rack) {
	                    const emitter = rack.emitter;
	                    emitter.off('layout', this.onDescendantLayout_);
	                    emitter.off('inputchange', this.onDescendantInputChange_);
	                    emitter.off('monitorupdate', this.onDescendantMonitorUpdate_);
	                }
	            }
	        }
	        updatePositions_() {
	            const visibleItems = this.bcSet_.items.filter((bc) => !bc.viewProps.get('hidden'));
	            const firstVisibleItem = visibleItems[0];
	            const lastVisibleItem = visibleItems[visibleItems.length - 1];
	            this.bcSet_.items.forEach((bc) => {
	                const ps = [];
	                if (bc === firstVisibleItem) {
	                    ps.push('first');
	                    if (!this.blade_ ||
	                        this.blade_.get('positions').includes('veryfirst')) {
	                        ps.push('veryfirst');
	                    }
	                }
	                if (bc === lastVisibleItem) {
	                    ps.push('last');
	                    if (!this.blade_ || this.blade_.get('positions').includes('verylast')) {
	                        ps.push('verylast');
	                    }
	                }
	                bc.blade.set('positions', ps);
	            });
	        }
	        onChildPositionsChange_() {
	            this.updatePositions_();
	            this.emitter.emit('layout', {
	                sender: this,
	            });
	        }
	        onChildViewPropsChange_(_ev) {
	            this.updatePositions_();
	            this.emitter.emit('layout', {
	                sender: this,
	            });
	        }
	        onChildDispose_() {
	            const disposedUcs = this.bcSet_.items.filter((bc) => {
	                return bc.viewProps.get('disposed');
	            });
	            disposedUcs.forEach((bc) => {
	                this.bcSet_.remove(bc);
	            });
	        }
	        onChildInputChange_(ev) {
	            const bc = findInputBindingController(this.find(InputBindingController), ev.sender);
	            if (!bc) {
	                throw TpError.alreadyDisposed();
	            }
	            this.emitter.emit('inputchange', {
	                bladeController: bc,
	                options: ev.options,
	                sender: this,
	            });
	        }
	        onChildMonitorUpdate_(ev) {
	            const bc = findMonitorBindingController(this.find(MonitorBindingController), ev.sender);
	            if (!bc) {
	                throw TpError.alreadyDisposed();
	            }
	            this.emitter.emit('monitorupdate', {
	                bladeController: bc,
	                sender: this,
	            });
	        }
	        onChildValueChange_(ev) {
	            const bc = findValueBladeController(this.find(ValueBladeController), ev.sender);
	            if (!bc) {
	                throw TpError.alreadyDisposed();
	            }
	            this.emitter.emit('inputchange', {
	                bladeController: bc,
	                options: ev.options,
	                sender: this,
	            });
	        }
	        onDescendantLayout_(_) {
	            this.updatePositions_();
	            this.emitter.emit('layout', {
	                sender: this,
	            });
	        }
	        onDescendantInputChange_(ev) {
	            this.emitter.emit('inputchange', {
	                bladeController: ev.bladeController,
	                options: ev.options,
	                sender: this,
	            });
	        }
	        onDescendantMonitorUpdate_(ev) {
	            this.emitter.emit('monitorupdate', {
	                bladeController: ev.bladeController,
	                sender: this,
	            });
	        }
	        onBladePositionsChange_() {
	            this.updatePositions_();
	        }
	    }

	    class RackController extends BladeController {
	        constructor(doc, config) {
	            super(Object.assign(Object.assign({}, config), { view: new PlainView(doc, {
	                    viewName: 'brk',
	                    viewProps: config.viewProps,
	                }) }));
	            this.onRackAdd_ = this.onRackAdd_.bind(this);
	            this.onRackRemove_ = this.onRackRemove_.bind(this);
	            const rack = new BladeRack({
	                blade: config.root ? undefined : config.blade,
	                viewProps: config.viewProps,
	            });
	            rack.emitter.on('add', this.onRackAdd_);
	            rack.emitter.on('remove', this.onRackRemove_);
	            this.rack = rack;
	            this.viewProps.handleDispose(() => {
	                for (let i = this.rack.children.length - 1; i >= 0; i--) {
	                    const bc = this.rack.children[i];
	                    bc.viewProps.set('disposed', true);
	                }
	            });
	        }
	        onRackAdd_(ev) {
	            if (!ev.isRoot) {
	                return;
	            }
	            insertElementAt(this.view.element, ev.bladeController.view.element, ev.index);
	        }
	        onRackRemove_(ev) {
	            if (!ev.isRoot) {
	                return;
	            }
	            removeElement(ev.bladeController.view.element);
	        }
	    }

	    const bladeContainerClassName = ClassName('cnt');

	    class FolderView {
	        constructor(doc, config) {
	            var _a;
	            this.className_ = ClassName((_a = config.viewName) !== null && _a !== void 0 ? _a : 'fld');
	            this.element = doc.createElement('div');
	            this.element.classList.add(this.className_(), bladeContainerClassName());
	            config.viewProps.bindClassModifiers(this.element);
	            this.foldable_ = config.foldable;
	            this.foldable_.bindExpandedClass(this.element, this.className_(undefined, 'expanded'));
	            bindValueMap(this.foldable_, 'completed', valueToClassName(this.element, this.className_(undefined, 'cpl')));
	            const buttonElem = doc.createElement('button');
	            buttonElem.classList.add(this.className_('b'));
	            bindValueMap(config.props, 'title', (title) => {
	                if (isEmpty(title)) {
	                    this.element.classList.add(this.className_(undefined, 'not'));
	                }
	                else {
	                    this.element.classList.remove(this.className_(undefined, 'not'));
	                }
	            });
	            config.viewProps.bindDisabled(buttonElem);
	            this.element.appendChild(buttonElem);
	            this.buttonElement = buttonElem;
	            const indentElem = doc.createElement('div');
	            indentElem.classList.add(this.className_('i'));
	            this.element.appendChild(indentElem);
	            const titleElem = doc.createElement('div');
	            titleElem.classList.add(this.className_('t'));
	            bindValueToTextContent(config.props.value('title'), titleElem);
	            this.buttonElement.appendChild(titleElem);
	            this.titleElement = titleElem;
	            const markElem = doc.createElement('div');
	            markElem.classList.add(this.className_('m'));
	            this.buttonElement.appendChild(markElem);
	            const containerElem = config.containerElement;
	            containerElem.classList.add(this.className_('c'));
	            this.element.appendChild(containerElem);
	            this.containerElement = containerElem;
	        }
	    }

	    class FolderController extends RackLikeController {
	        constructor(doc, config) {
	            var _a;
	            const foldable = Foldable.create((_a = config.expanded) !== null && _a !== void 0 ? _a : true);
	            const rc = new RackController(doc, {
	                blade: config.blade,
	                root: config.root,
	                viewProps: config.viewProps,
	            });
	            super(Object.assign(Object.assign({}, config), { rackController: rc, view: new FolderView(doc, {
	                    containerElement: rc.view.element,
	                    foldable: foldable,
	                    props: config.props,
	                    viewName: config.root ? 'rot' : undefined,
	                    viewProps: config.viewProps,
	                }) }));
	            this.onTitleClick_ = this.onTitleClick_.bind(this);
	            this.props = config.props;
	            this.foldable = foldable;
	            bindFoldable(this.foldable, this.view.containerElement);
	            this.rackController.rack.emitter.on('add', () => {
	                this.foldable.cleanUpTransition();
	            });
	            this.rackController.rack.emitter.on('remove', () => {
	                this.foldable.cleanUpTransition();
	            });
	            this.view.buttonElement.addEventListener('click', this.onTitleClick_);
	        }
	        get document() {
	            return this.view.element.ownerDocument;
	        }
	        onTitleClick_() {
	            this.foldable.set('expanded', !this.foldable.get('expanded'));
	        }
	    }

	    const FolderBladePlugin = {
	        id: 'folder',
	        type: 'blade',
	        accept(params) {
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                title: p.required.string,
	                view: p.required.constant('folder'),
	                expanded: p.optional.boolean,
	            });
	            return result ? { params: result } : null;
	        },
	        controller(args) {
	            return new FolderController(args.document, {
	                blade: args.blade,
	                expanded: args.params.expanded,
	                props: ValueMap.fromObject({
	                    title: args.params.title,
	                }),
	                viewProps: args.viewProps,
	            });
	        },
	        api(args) {
	            if (!(args.controller instanceof FolderController)) {
	                return null;
	            }
	            return new FolderApi(args.controller, args.pool);
	        },
	    };

	    class LabeledValueController extends ValueBladeController {
	        constructor(doc, config) {
	            const viewProps = config.valueController.viewProps;
	            super(Object.assign(Object.assign({}, config), { value: config.valueController.value, view: new LabelView(doc, {
	                    props: config.props,
	                    viewProps: viewProps,
	                }), viewProps: viewProps }));
	            this.props = config.props;
	            this.valueController = config.valueController;
	            this.view.valueElement.appendChild(this.valueController.view.element);
	        }
	    }

	    class SeparatorApi extends BladeApi {
	    }

	    const className$m = ClassName('spr');
	    class SeparatorView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$m());
	            config.viewProps.bindClassModifiers(this.element);
	            const hrElem = doc.createElement('hr');
	            hrElem.classList.add(className$m('r'));
	            this.element.appendChild(hrElem);
	        }
	    }

	    class SeparatorController extends BladeController {
	        constructor(doc, config) {
	            super(Object.assign(Object.assign({}, config), { view: new SeparatorView(doc, {
	                    viewProps: config.viewProps,
	                }) }));
	        }
	    }

	    const SeparatorBladePlugin = {
	        id: 'separator',
	        type: 'blade',
	        accept(params) {
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                view: p.required.constant('separator'),
	            });
	            return result ? { params: result } : null;
	        },
	        controller(args) {
	            return new SeparatorController(args.document, {
	                blade: args.blade,
	                viewProps: args.viewProps,
	            });
	        },
	        api(args) {
	            if (!(args.controller instanceof SeparatorController)) {
	                return null;
	            }
	            return new SeparatorApi(args.controller);
	        },
	    };

	    const className$l = ClassName('tbi');
	    class TabItemView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$l());
	            config.viewProps.bindClassModifiers(this.element);
	            bindValueMap(config.props, 'selected', (selected) => {
	                if (selected) {
	                    this.element.classList.add(className$l(undefined, 'sel'));
	                }
	                else {
	                    this.element.classList.remove(className$l(undefined, 'sel'));
	                }
	            });
	            const buttonElem = doc.createElement('button');
	            buttonElem.classList.add(className$l('b'));
	            config.viewProps.bindDisabled(buttonElem);
	            this.element.appendChild(buttonElem);
	            this.buttonElement = buttonElem;
	            const titleElem = doc.createElement('div');
	            titleElem.classList.add(className$l('t'));
	            bindValueToTextContent(config.props.value('title'), titleElem);
	            this.buttonElement.appendChild(titleElem);
	            this.titleElement = titleElem;
	        }
	    }

	    class TabItemController {
	        constructor(doc, config) {
	            this.emitter = new Emitter();
	            this.onClick_ = this.onClick_.bind(this);
	            this.props = config.props;
	            this.viewProps = config.viewProps;
	            this.view = new TabItemView(doc, {
	                props: config.props,
	                viewProps: config.viewProps,
	            });
	            this.view.buttonElement.addEventListener('click', this.onClick_);
	        }
	        onClick_() {
	            this.emitter.emit('click', {
	                sender: this,
	            });
	        }
	    }

	    class TabPageController {
	        constructor(doc, config) {
	            this.onItemClick_ = this.onItemClick_.bind(this);
	            this.ic_ = new TabItemController(doc, {
	                props: config.itemProps,
	                viewProps: ViewProps.create(),
	            });
	            this.ic_.emitter.on('click', this.onItemClick_);
	            this.cc_ = new RackController(doc, {
	                blade: createBlade(),
	                viewProps: ViewProps.create(),
	            });
	            this.props = config.props;
	            bindValueMap(this.props, 'selected', (selected) => {
	                this.itemController.props.set('selected', selected);
	                this.contentController.viewProps.set('hidden', !selected);
	            });
	        }
	        get itemController() {
	            return this.ic_;
	        }
	        get contentController() {
	            return this.cc_;
	        }
	        onItemClick_() {
	            this.props.set('selected', true);
	        }
	    }

	    class TabPageApi {
	        constructor(controller, contentRackApi) {
	            this.controller_ = controller;
	            this.rackApi_ = contentRackApi;
	        }
	        get title() {
	            var _a;
	            return (_a = this.controller_.itemController.props.get('title')) !== null && _a !== void 0 ? _a : '';
	        }
	        set title(title) {
	            this.controller_.itemController.props.set('title', title);
	        }
	        get selected() {
	            return this.controller_.props.get('selected');
	        }
	        set selected(selected) {
	            this.controller_.props.set('selected', selected);
	        }
	        get children() {
	            return this.rackApi_.children;
	        }
	        addButton(params) {
	            return this.rackApi_.addButton(params);
	        }
	        addFolder(params) {
	            return this.rackApi_.addFolder(params);
	        }
	        addSeparator(opt_params) {
	            return this.rackApi_.addSeparator(opt_params);
	        }
	        addTab(params) {
	            return this.rackApi_.addTab(params);
	        }
	        add(api, opt_index) {
	            this.rackApi_.add(api, opt_index);
	        }
	        remove(api) {
	            this.rackApi_.remove(api);
	        }
	        addInput(object, key, opt_params) {
	            return this.rackApi_.addInput(object, key, opt_params);
	        }
	        addMonitor(object, key, opt_params) {
	            return this.rackApi_.addMonitor(object, key, opt_params);
	        }
	        addBlade(params) {
	            return this.rackApi_.addBlade(params);
	        }
	    }

	    class TabApi extends RackLikeApi {
	        constructor(controller, pool) {
	            super(controller, new RackApi(controller.rackController, pool));
	            this.onPageAdd_ = this.onPageAdd_.bind(this);
	            this.onPageRemove_ = this.onPageRemove_.bind(this);
	            this.onSelect_ = this.onSelect_.bind(this);
	            this.emitter_ = new Emitter();
	            this.pageApiMap_ = new Map();
	            this.rackApi_.on('change', (ev) => {
	                this.emitter_.emit('change', {
	                    event: ev,
	                });
	            });
	            this.rackApi_.on('update', (ev) => {
	                this.emitter_.emit('update', {
	                    event: ev,
	                });
	            });
	            this.controller_.tab.selectedIndex.emitter.on('change', this.onSelect_);
	            this.controller_.pageSet.emitter.on('add', this.onPageAdd_);
	            this.controller_.pageSet.emitter.on('remove', this.onPageRemove_);
	            this.controller_.pageSet.items.forEach((pc) => {
	                this.setUpPageApi_(pc);
	            });
	        }
	        get pages() {
	            return this.controller_.pageSet.items.map((pc) => {
	                const api = this.pageApiMap_.get(pc);
	                if (!api) {
	                    throw TpError.shouldNeverHappen();
	                }
	                return api;
	            });
	        }
	        addPage(params) {
	            const doc = this.controller_.view.element.ownerDocument;
	            const pc = new TabPageController(doc, {
	                itemProps: ValueMap.fromObject({
	                    selected: false,
	                    title: params.title,
	                }),
	                props: ValueMap.fromObject({
	                    selected: false,
	                }),
	            });
	            this.controller_.add(pc, params.index);
	            const api = this.pageApiMap_.get(pc);
	            if (!api) {
	                throw TpError.shouldNeverHappen();
	            }
	            return api;
	        }
	        removePage(index) {
	            this.controller_.remove(index);
	        }
	        on(eventName, handler) {
	            const bh = handler.bind(this);
	            this.emitter_.on(eventName, (ev) => {
	                bh(ev.event);
	            });
	            return this;
	        }
	        setUpPageApi_(pc) {
	            const rackApi = this.rackApi_['apiSet_'].find((api) => api.controller_ === pc.contentController);
	            if (!rackApi) {
	                throw TpError.shouldNeverHappen();
	            }
	            const api = new TabPageApi(pc, rackApi);
	            this.pageApiMap_.set(pc, api);
	        }
	        onPageAdd_(ev) {
	            this.setUpPageApi_(ev.item);
	        }
	        onPageRemove_(ev) {
	            const api = this.pageApiMap_.get(ev.item);
	            if (!api) {
	                throw TpError.shouldNeverHappen();
	            }
	            this.pageApiMap_.delete(ev.item);
	        }
	        onSelect_(ev) {
	            this.emitter_.emit('select', {
	                event: new TpTabSelectEvent(this, ev.rawValue),
	            });
	        }
	    }

	    const INDEX_NOT_SELECTED = -1;
	    class Tab {
	        constructor() {
	            this.onItemSelectedChange_ = this.onItemSelectedChange_.bind(this);
	            this.empty = createValue(true);
	            this.selectedIndex = createValue(INDEX_NOT_SELECTED);
	            this.items_ = [];
	        }
	        add(item, opt_index) {
	            const index = opt_index !== null && opt_index !== void 0 ? opt_index : this.items_.length;
	            this.items_.splice(index, 0, item);
	            item.emitter.on('change', this.onItemSelectedChange_);
	            this.keepSelection_();
	        }
	        remove(item) {
	            const index = this.items_.indexOf(item);
	            if (index < 0) {
	                return;
	            }
	            this.items_.splice(index, 1);
	            item.emitter.off('change', this.onItemSelectedChange_);
	            this.keepSelection_();
	        }
	        keepSelection_() {
	            if (this.items_.length === 0) {
	                this.selectedIndex.rawValue = INDEX_NOT_SELECTED;
	                this.empty.rawValue = true;
	                return;
	            }
	            const firstSelIndex = this.items_.findIndex((s) => s.rawValue);
	            if (firstSelIndex < 0) {
	                this.items_.forEach((s, i) => {
	                    s.rawValue = i === 0;
	                });
	                this.selectedIndex.rawValue = 0;
	            }
	            else {
	                this.items_.forEach((s, i) => {
	                    s.rawValue = i === firstSelIndex;
	                });
	                this.selectedIndex.rawValue = firstSelIndex;
	            }
	            this.empty.rawValue = false;
	        }
	        onItemSelectedChange_(ev) {
	            if (ev.rawValue) {
	                const index = this.items_.findIndex((s) => s === ev.sender);
	                this.items_.forEach((s, i) => {
	                    s.rawValue = i === index;
	                });
	                this.selectedIndex.rawValue = index;
	            }
	            else {
	                this.keepSelection_();
	            }
	        }
	    }

	    const className$k = ClassName('tab');
	    class TabView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$k(), bladeContainerClassName());
	            config.viewProps.bindClassModifiers(this.element);
	            bindValue(config.empty, valueToClassName(this.element, className$k(undefined, 'nop')));
	            const titleElem = doc.createElement('div');
	            titleElem.classList.add(className$k('t'));
	            this.element.appendChild(titleElem);
	            this.itemsElement = titleElem;
	            const indentElem = doc.createElement('div');
	            indentElem.classList.add(className$k('i'));
	            this.element.appendChild(indentElem);
	            const contentsElem = config.contentsElement;
	            contentsElem.classList.add(className$k('c'));
	            this.element.appendChild(contentsElem);
	            this.contentsElement = contentsElem;
	        }
	    }

	    class TabController extends RackLikeController {
	        constructor(doc, config) {
	            const cr = new RackController(doc, {
	                blade: config.blade,
	                viewProps: config.viewProps,
	            });
	            const tab = new Tab();
	            super({
	                blade: config.blade,
	                rackController: cr,
	                view: new TabView(doc, {
	                    contentsElement: cr.view.element,
	                    empty: tab.empty,
	                    viewProps: config.viewProps,
	                }),
	            });
	            this.onPageAdd_ = this.onPageAdd_.bind(this);
	            this.onPageRemove_ = this.onPageRemove_.bind(this);
	            this.pageSet_ = new NestedOrderedSet(() => null);
	            this.pageSet_.emitter.on('add', this.onPageAdd_);
	            this.pageSet_.emitter.on('remove', this.onPageRemove_);
	            this.tab = tab;
	        }
	        get pageSet() {
	            return this.pageSet_;
	        }
	        add(pc, opt_index) {
	            this.pageSet_.add(pc, opt_index);
	        }
	        remove(index) {
	            this.pageSet_.remove(this.pageSet_.items[index]);
	        }
	        onPageAdd_(ev) {
	            const pc = ev.item;
	            insertElementAt(this.view.itemsElement, pc.itemController.view.element, ev.index);
	            pc.itemController.viewProps.set('parent', this.viewProps);
	            this.rackController.rack.add(pc.contentController, ev.index);
	            this.tab.add(pc.props.value('selected'));
	        }
	        onPageRemove_(ev) {
	            const pc = ev.item;
	            removeElement(pc.itemController.view.element);
	            pc.itemController.viewProps.set('parent', null);
	            this.rackController.rack.remove(pc.contentController);
	            this.tab.remove(pc.props.value('selected'));
	        }
	    }

	    const TabBladePlugin = {
	        id: 'tab',
	        type: 'blade',
	        accept(params) {
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                pages: p.required.array(p.required.object({ title: p.required.string })),
	                view: p.required.constant('tab'),
	            });
	            if (!result || result.pages.length === 0) {
	                return null;
	            }
	            return { params: result };
	        },
	        controller(args) {
	            const c = new TabController(args.document, {
	                blade: args.blade,
	                viewProps: args.viewProps,
	            });
	            args.params.pages.forEach((p) => {
	                const pc = new TabPageController(args.document, {
	                    itemProps: ValueMap.fromObject({
	                        selected: false,
	                        title: p.title,
	                    }),
	                    props: ValueMap.fromObject({
	                        selected: false,
	                    }),
	                });
	                c.add(pc);
	            });
	            return c;
	        },
	        api(args) {
	            if (!(args.controller instanceof TabController)) {
	                return null;
	            }
	            return new TabApi(args.controller, args.pool);
	        },
	    };

	    function createBladeController(plugin, args) {
	        const ac = plugin.accept(args.params);
	        if (!ac) {
	            return null;
	        }
	        const disabled = ParamsParsers.optional.boolean(args.params['disabled']).value;
	        const hidden = ParamsParsers.optional.boolean(args.params['hidden']).value;
	        return plugin.controller({
	            blade: createBlade(),
	            document: args.document,
	            params: forceCast(Object.assign(Object.assign({}, ac.params), { disabled: disabled, hidden: hidden })),
	            viewProps: ViewProps.create({
	                disabled: disabled,
	                hidden: hidden,
	            }),
	        });
	    }

	    class ManualTicker {
	        constructor() {
	            this.disabled = false;
	            this.emitter = new Emitter();
	        }
	        dispose() { }
	        tick() {
	            if (this.disabled) {
	                return;
	            }
	            this.emitter.emit('tick', {
	                sender: this,
	            });
	        }
	    }

	    class IntervalTicker {
	        constructor(doc, interval) {
	            this.disabled_ = false;
	            this.timerId_ = null;
	            this.onTick_ = this.onTick_.bind(this);
	            this.doc_ = doc;
	            this.emitter = new Emitter();
	            this.interval_ = interval;
	            this.setTimer_();
	        }
	        get disabled() {
	            return this.disabled_;
	        }
	        set disabled(inactive) {
	            this.disabled_ = inactive;
	            if (this.disabled_) {
	                this.clearTimer_();
	            }
	            else {
	                this.setTimer_();
	            }
	        }
	        dispose() {
	            this.clearTimer_();
	        }
	        clearTimer_() {
	            if (this.timerId_ === null) {
	                return;
	            }
	            const win = this.doc_.defaultView;
	            if (win) {
	                win.clearInterval(this.timerId_);
	            }
	            this.timerId_ = null;
	        }
	        setTimer_() {
	            this.clearTimer_();
	            if (this.interval_ <= 0) {
	                return;
	            }
	            const win = this.doc_.defaultView;
	            if (win) {
	                this.timerId_ = win.setInterval(this.onTick_, this.interval_);
	            }
	        }
	        onTick_() {
	            if (this.disabled_) {
	                return;
	            }
	            this.emitter.emit('tick', {
	                sender: this,
	            });
	        }
	    }

	    class InputBinding {
	        constructor(config) {
	            this.onValueChange_ = this.onValueChange_.bind(this);
	            this.reader = config.reader;
	            this.writer = config.writer;
	            this.emitter = new Emitter();
	            this.value = config.value;
	            this.value.emitter.on('change', this.onValueChange_);
	            this.target = config.target;
	            this.read();
	        }
	        read() {
	            const targetValue = this.target.read();
	            if (targetValue !== undefined) {
	                this.value.rawValue = this.reader(targetValue);
	            }
	        }
	        write_(rawValue) {
	            this.writer(this.target, rawValue);
	        }
	        onValueChange_(ev) {
	            this.write_(ev.rawValue);
	            this.emitter.emit('change', {
	                options: ev.options,
	                rawValue: ev.rawValue,
	                sender: this,
	            });
	        }
	    }

	    function fillBuffer(buffer, bufferSize) {
	        while (buffer.length < bufferSize) {
	            buffer.push(undefined);
	        }
	    }
	    function initializeBuffer(bufferSize) {
	        const buffer = [];
	        fillBuffer(buffer, bufferSize);
	        return createValue(buffer);
	    }
	    function createTrimmedBuffer(buffer) {
	        const index = buffer.indexOf(undefined);
	        return forceCast(index < 0 ? buffer : buffer.slice(0, index));
	    }
	    function createPushedBuffer(buffer, newValue) {
	        const newBuffer = [...createTrimmedBuffer(buffer), newValue];
	        if (newBuffer.length > buffer.length) {
	            newBuffer.splice(0, newBuffer.length - buffer.length);
	        }
	        else {
	            fillBuffer(newBuffer, buffer.length);
	        }
	        return newBuffer;
	    }

	    class MonitorBinding {
	        constructor(config) {
	            this.onTick_ = this.onTick_.bind(this);
	            this.reader_ = config.reader;
	            this.target = config.target;
	            this.emitter = new Emitter();
	            this.value = config.value;
	            this.ticker = config.ticker;
	            this.ticker.emitter.on('tick', this.onTick_);
	            this.read();
	        }
	        dispose() {
	            this.ticker.dispose();
	        }
	        read() {
	            const targetValue = this.target.read();
	            if (targetValue === undefined) {
	                return;
	            }
	            const buffer = this.value.rawValue;
	            const newValue = this.reader_(targetValue);
	            this.value.rawValue = createPushedBuffer(buffer, newValue);
	            this.emitter.emit('update', {
	                rawValue: newValue,
	                sender: this,
	            });
	        }
	        onTick_(_) {
	            this.read();
	        }
	    }

	    class CompositeConstraint {
	        constructor(constraints) {
	            this.constraints = constraints;
	        }
	        constrain(value) {
	            return this.constraints.reduce((result, c) => {
	                return c.constrain(result);
	            }, value);
	        }
	    }
	    function findConstraint(c, constraintClass) {
	        if (c instanceof constraintClass) {
	            return c;
	        }
	        if (c instanceof CompositeConstraint) {
	            const result = c.constraints.reduce((tmpResult, sc) => {
	                if (tmpResult) {
	                    return tmpResult;
	                }
	                return sc instanceof constraintClass ? sc : null;
	            }, null);
	            if (result) {
	                return result;
	            }
	        }
	        return null;
	    }

	    class DefiniteRangeConstraint {
	        constructor(config) {
	            this.values = ValueMap.fromObject({
	                max: config.max,
	                min: config.min,
	            });
	        }
	        constrain(value) {
	            const max = this.values.get('max');
	            const min = this.values.get('min');
	            return Math.min(Math.max(value, min), max);
	        }
	    }

	    class ListConstraint {
	        constructor(options) {
	            this.values = ValueMap.fromObject({
	                options: options,
	            });
	        }
	        get options() {
	            return this.values.get('options');
	        }
	        constrain(value) {
	            const opts = this.values.get('options');
	            if (opts.length === 0) {
	                return value;
	            }
	            const matched = opts.filter((item) => {
	                return item.value === value;
	            }).length > 0;
	            return matched ? value : opts[0].value;
	        }
	    }

	    class RangeConstraint {
	        constructor(config) {
	            this.values = ValueMap.fromObject({
	                max: config.max,
	                min: config.min,
	            });
	        }
	        get maxValue() {
	            return this.values.get('max');
	        }
	        get minValue() {
	            return this.values.get('min');
	        }
	        constrain(value) {
	            const max = this.values.get('max');
	            const min = this.values.get('min');
	            let result = value;
	            if (!isEmpty(min)) {
	                result = Math.max(result, min);
	            }
	            if (!isEmpty(max)) {
	                result = Math.min(result, max);
	            }
	            return result;
	        }
	    }

	    class StepConstraint {
	        constructor(step, origin = 0) {
	            this.step = step;
	            this.origin = origin;
	        }
	        constrain(value) {
	            const o = this.origin % this.step;
	            const r = Math.round((value - o) / this.step);
	            return o + r * this.step;
	        }
	    }

	    const className$j = ClassName('lst');
	    class ListView {
	        constructor(doc, config) {
	            this.onValueChange_ = this.onValueChange_.bind(this);
	            this.props_ = config.props;
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$j());
	            config.viewProps.bindClassModifiers(this.element);
	            const selectElem = doc.createElement('select');
	            selectElem.classList.add(className$j('s'));
	            bindValueMap(this.props_, 'options', (opts) => {
	                removeChildElements(selectElem);
	                opts.forEach((item, index) => {
	                    const optionElem = doc.createElement('option');
	                    optionElem.dataset.index = String(index);
	                    optionElem.textContent = item.text;
	                    optionElem.value = String(item.value);
	                    selectElem.appendChild(optionElem);
	                });
	            });
	            config.viewProps.bindDisabled(selectElem);
	            this.element.appendChild(selectElem);
	            this.selectElement = selectElem;
	            const markElem = doc.createElement('div');
	            markElem.classList.add(className$j('m'));
	            markElem.appendChild(createSvgIconElement(doc, 'dropdown'));
	            this.element.appendChild(markElem);
	            config.value.emitter.on('change', this.onValueChange_);
	            this.value_ = config.value;
	            this.update_();
	        }
	        update_() {
	            this.selectElement.value = String(this.value_.rawValue);
	        }
	        onValueChange_() {
	            this.update_();
	        }
	    }

	    class ListController {
	        constructor(doc, config) {
	            this.onSelectChange_ = this.onSelectChange_.bind(this);
	            this.props = config.props;
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.view = new ListView(doc, {
	                props: this.props,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.view.selectElement.addEventListener('change', this.onSelectChange_);
	        }
	        onSelectChange_(e) {
	            const selectElem = forceCast(e.currentTarget);
	            const optElem = selectElem.selectedOptions.item(0);
	            if (!optElem) {
	                return;
	            }
	            const itemIndex = Number(optElem.dataset.index);
	            this.value.rawValue = this.props.get('options')[itemIndex].value;
	        }
	    }

	    const className$i = ClassName('pop');
	    class PopupView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$i());
	            config.viewProps.bindClassModifiers(this.element);
	            bindValue(config.shows, valueToClassName(this.element, className$i(undefined, 'v')));
	        }
	    }

	    class PopupController {
	        constructor(doc, config) {
	            this.shows = createValue(false);
	            this.viewProps = config.viewProps;
	            this.view = new PopupView(doc, {
	                shows: this.shows,
	                viewProps: this.viewProps,
	            });
	        }
	    }

	    const className$h = ClassName('txt');
	    class TextView {
	        constructor(doc, config) {
	            this.onChange_ = this.onChange_.bind(this);
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$h());
	            config.viewProps.bindClassModifiers(this.element);
	            this.props_ = config.props;
	            this.props_.emitter.on('change', this.onChange_);
	            const inputElem = doc.createElement('input');
	            inputElem.classList.add(className$h('i'));
	            inputElem.type = 'text';
	            config.viewProps.bindDisabled(inputElem);
	            this.element.appendChild(inputElem);
	            this.inputElement = inputElem;
	            config.value.emitter.on('change', this.onChange_);
	            this.value_ = config.value;
	            this.refresh();
	        }
	        refresh() {
	            const formatter = this.props_.get('formatter');
	            this.inputElement.value = formatter(this.value_.rawValue);
	        }
	        onChange_() {
	            this.refresh();
	        }
	    }

	    class TextController {
	        constructor(doc, config) {
	            this.onInputChange_ = this.onInputChange_.bind(this);
	            this.parser_ = config.parser;
	            this.props = config.props;
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.view = new TextView(doc, {
	                props: config.props,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.view.inputElement.addEventListener('change', this.onInputChange_);
	        }
	        onInputChange_(e) {
	            const inputElem = forceCast(e.currentTarget);
	            const value = inputElem.value;
	            const parsedValue = this.parser_(value);
	            if (!isEmpty(parsedValue)) {
	                this.value.rawValue = parsedValue;
	            }
	            this.view.refresh();
	        }
	    }

	    function boolToString(value) {
	        return String(value);
	    }
	    function boolFromUnknown(value) {
	        if (value === 'false') {
	            return false;
	        }
	        return !!value;
	    }
	    function BooleanFormatter(value) {
	        return boolToString(value);
	    }

	    class NumberLiteralNode {
	        constructor(text) {
	            this.text = text;
	        }
	        evaluate() {
	            return Number(this.text);
	        }
	        toString() {
	            return this.text;
	        }
	    }
	    const BINARY_OPERATION_MAP = {
	        '**': (v1, v2) => Math.pow(v1, v2),
	        '*': (v1, v2) => v1 * v2,
	        '/': (v1, v2) => v1 / v2,
	        '%': (v1, v2) => v1 % v2,
	        '+': (v1, v2) => v1 + v2,
	        '-': (v1, v2) => v1 - v2,
	        '<<': (v1, v2) => v1 << v2,
	        '>>': (v1, v2) => v1 >> v2,
	        '>>>': (v1, v2) => v1 >>> v2,
	        '&': (v1, v2) => v1 & v2,
	        '^': (v1, v2) => v1 ^ v2,
	        '|': (v1, v2) => v1 | v2,
	    };
	    class BinaryOperationNode {
	        constructor(operator, left, right) {
	            this.left = left;
	            this.operator = operator;
	            this.right = right;
	        }
	        evaluate() {
	            const op = BINARY_OPERATION_MAP[this.operator];
	            if (!op) {
	                throw new Error(`unexpected binary operator: '${this.operator}`);
	            }
	            return op(this.left.evaluate(), this.right.evaluate());
	        }
	        toString() {
	            return [
	                'b(',
	                this.left.toString(),
	                this.operator,
	                this.right.toString(),
	                ')',
	            ].join(' ');
	        }
	    }
	    const UNARY_OPERATION_MAP = {
	        '+': (v) => v,
	        '-': (v) => -v,
	        '~': (v) => ~v,
	    };
	    class UnaryOperationNode {
	        constructor(operator, expr) {
	            this.operator = operator;
	            this.expression = expr;
	        }
	        evaluate() {
	            const op = UNARY_OPERATION_MAP[this.operator];
	            if (!op) {
	                throw new Error(`unexpected unary operator: '${this.operator}`);
	            }
	            return op(this.expression.evaluate());
	        }
	        toString() {
	            return ['u(', this.operator, this.expression.toString(), ')'].join(' ');
	        }
	    }

	    function combineReader(parsers) {
	        return (text, cursor) => {
	            for (let i = 0; i < parsers.length; i++) {
	                const result = parsers[i](text, cursor);
	                if (result !== '') {
	                    return result;
	                }
	            }
	            return '';
	        };
	    }
	    function readWhitespace(text, cursor) {
	        var _a;
	        const m = text.substr(cursor).match(/^\s+/);
	        return (_a = (m && m[0])) !== null && _a !== void 0 ? _a : '';
	    }
	    function readNonZeroDigit(text, cursor) {
	        const ch = text.substr(cursor, 1);
	        return ch.match(/^[1-9]$/) ? ch : '';
	    }
	    function readDecimalDigits(text, cursor) {
	        var _a;
	        const m = text.substr(cursor).match(/^[0-9]+/);
	        return (_a = (m && m[0])) !== null && _a !== void 0 ? _a : '';
	    }
	    function readSignedInteger(text, cursor) {
	        const ds = readDecimalDigits(text, cursor);
	        if (ds !== '') {
	            return ds;
	        }
	        const sign = text.substr(cursor, 1);
	        cursor += 1;
	        if (sign !== '-' && sign !== '+') {
	            return '';
	        }
	        const sds = readDecimalDigits(text, cursor);
	        if (sds === '') {
	            return '';
	        }
	        return sign + sds;
	    }
	    function readExponentPart(text, cursor) {
	        const e = text.substr(cursor, 1);
	        cursor += 1;
	        if (e.toLowerCase() !== 'e') {
	            return '';
	        }
	        const si = readSignedInteger(text, cursor);
	        if (si === '') {
	            return '';
	        }
	        return e + si;
	    }
	    function readDecimalIntegerLiteral(text, cursor) {
	        const ch = text.substr(cursor, 1);
	        if (ch === '0') {
	            return ch;
	        }
	        const nzd = readNonZeroDigit(text, cursor);
	        cursor += nzd.length;
	        if (nzd === '') {
	            return '';
	        }
	        return nzd + readDecimalDigits(text, cursor);
	    }
	    function readDecimalLiteral1(text, cursor) {
	        const dil = readDecimalIntegerLiteral(text, cursor);
	        cursor += dil.length;
	        if (dil === '') {
	            return '';
	        }
	        const dot = text.substr(cursor, 1);
	        cursor += dot.length;
	        if (dot !== '.') {
	            return '';
	        }
	        const dds = readDecimalDigits(text, cursor);
	        cursor += dds.length;
	        return dil + dot + dds + readExponentPart(text, cursor);
	    }
	    function readDecimalLiteral2(text, cursor) {
	        const dot = text.substr(cursor, 1);
	        cursor += dot.length;
	        if (dot !== '.') {
	            return '';
	        }
	        const dds = readDecimalDigits(text, cursor);
	        cursor += dds.length;
	        if (dds === '') {
	            return '';
	        }
	        return dot + dds + readExponentPart(text, cursor);
	    }
	    function readDecimalLiteral3(text, cursor) {
	        const dil = readDecimalIntegerLiteral(text, cursor);
	        cursor += dil.length;
	        if (dil === '') {
	            return '';
	        }
	        return dil + readExponentPart(text, cursor);
	    }
	    const readDecimalLiteral = combineReader([
	        readDecimalLiteral1,
	        readDecimalLiteral2,
	        readDecimalLiteral3,
	    ]);
	    function parseBinaryDigits(text, cursor) {
	        var _a;
	        const m = text.substr(cursor).match(/^[01]+/);
	        return (_a = (m && m[0])) !== null && _a !== void 0 ? _a : '';
	    }
	    function readBinaryIntegerLiteral(text, cursor) {
	        const prefix = text.substr(cursor, 2);
	        cursor += prefix.length;
	        if (prefix.toLowerCase() !== '0b') {
	            return '';
	        }
	        const bds = parseBinaryDigits(text, cursor);
	        if (bds === '') {
	            return '';
	        }
	        return prefix + bds;
	    }
	    function readOctalDigits(text, cursor) {
	        var _a;
	        const m = text.substr(cursor).match(/^[0-7]+/);
	        return (_a = (m && m[0])) !== null && _a !== void 0 ? _a : '';
	    }
	    function readOctalIntegerLiteral(text, cursor) {
	        const prefix = text.substr(cursor, 2);
	        cursor += prefix.length;
	        if (prefix.toLowerCase() !== '0o') {
	            return '';
	        }
	        const ods = readOctalDigits(text, cursor);
	        if (ods === '') {
	            return '';
	        }
	        return prefix + ods;
	    }
	    function readHexDigits(text, cursor) {
	        var _a;
	        const m = text.substr(cursor).match(/^[0-9a-f]+/i);
	        return (_a = (m && m[0])) !== null && _a !== void 0 ? _a : '';
	    }
	    function readHexIntegerLiteral(text, cursor) {
	        const prefix = text.substr(cursor, 2);
	        cursor += prefix.length;
	        if (prefix.toLowerCase() !== '0x') {
	            return '';
	        }
	        const hds = readHexDigits(text, cursor);
	        if (hds === '') {
	            return '';
	        }
	        return prefix + hds;
	    }
	    const readNonDecimalIntegerLiteral = combineReader([
	        readBinaryIntegerLiteral,
	        readOctalIntegerLiteral,
	        readHexIntegerLiteral,
	    ]);
	    const readNumericLiteral = combineReader([
	        readNonDecimalIntegerLiteral,
	        readDecimalLiteral,
	    ]);

	    function parseLiteral(text, cursor) {
	        const num = readNumericLiteral(text, cursor);
	        cursor += num.length;
	        if (num === '') {
	            return null;
	        }
	        return {
	            evaluable: new NumberLiteralNode(num),
	            cursor: cursor,
	        };
	    }
	    function parseParenthesizedExpression(text, cursor) {
	        const op = text.substr(cursor, 1);
	        cursor += op.length;
	        if (op !== '(') {
	            return null;
	        }
	        const expr = parseExpression(text, cursor);
	        if (!expr) {
	            return null;
	        }
	        cursor = expr.cursor;
	        cursor += readWhitespace(text, cursor).length;
	        const cl = text.substr(cursor, 1);
	        cursor += cl.length;
	        if (cl !== ')') {
	            return null;
	        }
	        return {
	            evaluable: expr.evaluable,
	            cursor: cursor,
	        };
	    }
	    function parsePrimaryExpression(text, cursor) {
	        var _a;
	        return ((_a = parseLiteral(text, cursor)) !== null && _a !== void 0 ? _a : parseParenthesizedExpression(text, cursor));
	    }
	    function parseUnaryExpression(text, cursor) {
	        const expr = parsePrimaryExpression(text, cursor);
	        if (expr) {
	            return expr;
	        }
	        const op = text.substr(cursor, 1);
	        cursor += op.length;
	        if (op !== '+' && op !== '-' && op !== '~') {
	            return null;
	        }
	        const num = parseUnaryExpression(text, cursor);
	        if (!num) {
	            return null;
	        }
	        cursor = num.cursor;
	        return {
	            cursor: cursor,
	            evaluable: new UnaryOperationNode(op, num.evaluable),
	        };
	    }
	    function readBinaryOperator(ops, text, cursor) {
	        cursor += readWhitespace(text, cursor).length;
	        const op = ops.filter((op) => text.startsWith(op, cursor))[0];
	        if (!op) {
	            return null;
	        }
	        cursor += op.length;
	        cursor += readWhitespace(text, cursor).length;
	        return {
	            cursor: cursor,
	            operator: op,
	        };
	    }
	    function createBinaryOperationExpressionParser(exprParser, ops) {
	        return (text, cursor) => {
	            const firstExpr = exprParser(text, cursor);
	            if (!firstExpr) {
	                return null;
	            }
	            cursor = firstExpr.cursor;
	            let expr = firstExpr.evaluable;
	            for (;;) {
	                const op = readBinaryOperator(ops, text, cursor);
	                if (!op) {
	                    break;
	                }
	                cursor = op.cursor;
	                const nextExpr = exprParser(text, cursor);
	                if (!nextExpr) {
	                    return null;
	                }
	                cursor = nextExpr.cursor;
	                expr = new BinaryOperationNode(op.operator, expr, nextExpr.evaluable);
	            }
	            return expr
	                ? {
	                    cursor: cursor,
	                    evaluable: expr,
	                }
	                : null;
	        };
	    }
	    const parseBinaryOperationExpression = [
	        ['**'],
	        ['*', '/', '%'],
	        ['+', '-'],
	        ['<<', '>>>', '>>'],
	        ['&'],
	        ['^'],
	        ['|'],
	    ].reduce((parser, ops) => {
	        return createBinaryOperationExpressionParser(parser, ops);
	    }, parseUnaryExpression);
	    function parseExpression(text, cursor) {
	        cursor += readWhitespace(text, cursor).length;
	        return parseBinaryOperationExpression(text, cursor);
	    }
	    function parseEcmaNumberExpression(text) {
	        const expr = parseExpression(text, 0);
	        if (!expr) {
	            return null;
	        }
	        const cursor = expr.cursor + readWhitespace(text, expr.cursor).length;
	        if (cursor !== text.length) {
	            return null;
	        }
	        return expr.evaluable;
	    }

	    function parseNumber(text) {
	        var _a;
	        const r = parseEcmaNumberExpression(text);
	        return (_a = r === null || r === void 0 ? void 0 : r.evaluate()) !== null && _a !== void 0 ? _a : null;
	    }
	    function numberFromUnknown(value) {
	        if (typeof value === 'number') {
	            return value;
	        }
	        if (typeof value === 'string') {
	            const pv = parseNumber(value);
	            if (!isEmpty(pv)) {
	                return pv;
	            }
	        }
	        return 0;
	    }
	    function numberToString(value) {
	        return String(value);
	    }
	    function createNumberFormatter(digits) {
	        return (value) => {
	            return value.toFixed(Math.max(Math.min(digits, 20), 0));
	        };
	    }

	    const innerFormatter = createNumberFormatter(0);
	    function formatPercentage(value) {
	        return innerFormatter(value) + '%';
	    }

	    function stringFromUnknown(value) {
	        return String(value);
	    }
	    function formatString(value) {
	        return value;
	    }

	    function connectValues({ primary, secondary, forward, backward, }) {
	        let changing = false;
	        function preventFeedback(callback) {
	            if (changing) {
	                return;
	            }
	            changing = true;
	            callback();
	            changing = false;
	        }
	        primary.emitter.on('change', (ev) => {
	            preventFeedback(() => {
	                secondary.setRawValue(forward(primary, secondary), ev.options);
	            });
	        });
	        secondary.emitter.on('change', (ev) => {
	            preventFeedback(() => {
	                primary.setRawValue(backward(primary, secondary), ev.options);
	            });
	            preventFeedback(() => {
	                secondary.setRawValue(forward(primary, secondary), ev.options);
	            });
	        });
	        preventFeedback(() => {
	            secondary.setRawValue(forward(primary, secondary), {
	                forceEmit: false,
	                last: true,
	            });
	        });
	    }

	    function getStepForKey(baseStep, keys) {
	        const step = baseStep * (keys.altKey ? 0.1 : 1) * (keys.shiftKey ? 10 : 1);
	        if (keys.upKey) {
	            return +step;
	        }
	        else if (keys.downKey) {
	            return -step;
	        }
	        return 0;
	    }
	    function getVerticalStepKeys(ev) {
	        return {
	            altKey: ev.altKey,
	            downKey: ev.key === 'ArrowDown',
	            shiftKey: ev.shiftKey,
	            upKey: ev.key === 'ArrowUp',
	        };
	    }
	    function getHorizontalStepKeys(ev) {
	        return {
	            altKey: ev.altKey,
	            downKey: ev.key === 'ArrowLeft',
	            shiftKey: ev.shiftKey,
	            upKey: ev.key === 'ArrowRight',
	        };
	    }
	    function isVerticalArrowKey(key) {
	        return key === 'ArrowUp' || key === 'ArrowDown';
	    }
	    function isArrowKey(key) {
	        return isVerticalArrowKey(key) || key === 'ArrowLeft' || key === 'ArrowRight';
	    }

	    function computeOffset$1(ev, elem) {
	        var _a, _b;
	        const win = elem.ownerDocument.defaultView;
	        const rect = elem.getBoundingClientRect();
	        return {
	            x: ev.pageX - (((_a = (win && win.scrollX)) !== null && _a !== void 0 ? _a : 0) + rect.left),
	            y: ev.pageY - (((_b = (win && win.scrollY)) !== null && _b !== void 0 ? _b : 0) + rect.top),
	        };
	    }
	    class PointerHandler {
	        constructor(element) {
	            this.lastTouch_ = null;
	            this.onDocumentMouseMove_ = this.onDocumentMouseMove_.bind(this);
	            this.onDocumentMouseUp_ = this.onDocumentMouseUp_.bind(this);
	            this.onMouseDown_ = this.onMouseDown_.bind(this);
	            this.onTouchEnd_ = this.onTouchEnd_.bind(this);
	            this.onTouchMove_ = this.onTouchMove_.bind(this);
	            this.onTouchStart_ = this.onTouchStart_.bind(this);
	            this.elem_ = element;
	            this.emitter = new Emitter();
	            element.addEventListener('touchstart', this.onTouchStart_, {
	                passive: false,
	            });
	            element.addEventListener('touchmove', this.onTouchMove_, {
	                passive: true,
	            });
	            element.addEventListener('touchend', this.onTouchEnd_);
	            element.addEventListener('mousedown', this.onMouseDown_);
	        }
	        computePosition_(offset) {
	            const rect = this.elem_.getBoundingClientRect();
	            return {
	                bounds: {
	                    width: rect.width,
	                    height: rect.height,
	                },
	                point: offset
	                    ? {
	                        x: offset.x,
	                        y: offset.y,
	                    }
	                    : null,
	            };
	        }
	        onMouseDown_(ev) {
	            var _a;
	            ev.preventDefault();
	            (_a = ev.currentTarget) === null || _a === void 0 ? void 0 : _a.focus();
	            const doc = this.elem_.ownerDocument;
	            doc.addEventListener('mousemove', this.onDocumentMouseMove_);
	            doc.addEventListener('mouseup', this.onDocumentMouseUp_);
	            this.emitter.emit('down', {
	                altKey: ev.altKey,
	                data: this.computePosition_(computeOffset$1(ev, this.elem_)),
	                sender: this,
	                shiftKey: ev.shiftKey,
	            });
	        }
	        onDocumentMouseMove_(ev) {
	            this.emitter.emit('move', {
	                altKey: ev.altKey,
	                data: this.computePosition_(computeOffset$1(ev, this.elem_)),
	                sender: this,
	                shiftKey: ev.shiftKey,
	            });
	        }
	        onDocumentMouseUp_(ev) {
	            const doc = this.elem_.ownerDocument;
	            doc.removeEventListener('mousemove', this.onDocumentMouseMove_);
	            doc.removeEventListener('mouseup', this.onDocumentMouseUp_);
	            this.emitter.emit('up', {
	                altKey: ev.altKey,
	                data: this.computePosition_(computeOffset$1(ev, this.elem_)),
	                sender: this,
	                shiftKey: ev.shiftKey,
	            });
	        }
	        onTouchStart_(ev) {
	            ev.preventDefault();
	            const touch = ev.targetTouches.item(0);
	            const rect = this.elem_.getBoundingClientRect();
	            this.emitter.emit('down', {
	                altKey: ev.altKey,
	                data: this.computePosition_(touch
	                    ? {
	                        x: touch.clientX - rect.left,
	                        y: touch.clientY - rect.top,
	                    }
	                    : undefined),
	                sender: this,
	                shiftKey: ev.shiftKey,
	            });
	            this.lastTouch_ = touch;
	        }
	        onTouchMove_(ev) {
	            const touch = ev.targetTouches.item(0);
	            const rect = this.elem_.getBoundingClientRect();
	            this.emitter.emit('move', {
	                altKey: ev.altKey,
	                data: this.computePosition_(touch
	                    ? {
	                        x: touch.clientX - rect.left,
	                        y: touch.clientY - rect.top,
	                    }
	                    : undefined),
	                sender: this,
	                shiftKey: ev.shiftKey,
	            });
	            this.lastTouch_ = touch;
	        }
	        onTouchEnd_(ev) {
	            var _a;
	            const touch = (_a = ev.targetTouches.item(0)) !== null && _a !== void 0 ? _a : this.lastTouch_;
	            const rect = this.elem_.getBoundingClientRect();
	            this.emitter.emit('up', {
	                altKey: ev.altKey,
	                data: this.computePosition_(touch
	                    ? {
	                        x: touch.clientX - rect.left,
	                        y: touch.clientY - rect.top,
	                    }
	                    : undefined),
	                sender: this,
	                shiftKey: ev.shiftKey,
	            });
	        }
	    }

	    function mapRange(value, start1, end1, start2, end2) {
	        const p = (value - start1) / (end1 - start1);
	        return start2 + p * (end2 - start2);
	    }
	    function getDecimalDigits(value) {
	        const text = String(value.toFixed(10));
	        const frac = text.split('.')[1];
	        return frac.replace(/0+$/, '').length;
	    }
	    function constrainRange(value, min, max) {
	        return Math.min(Math.max(value, min), max);
	    }
	    function loopRange(value, max) {
	        return ((value % max) + max) % max;
	    }

	    const className$g = ClassName('txt');
	    class NumberTextView {
	        constructor(doc, config) {
	            this.onChange_ = this.onChange_.bind(this);
	            this.props_ = config.props;
	            this.props_.emitter.on('change', this.onChange_);
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$g(), className$g(undefined, 'num'));
	            if (config.arrayPosition) {
	                this.element.classList.add(className$g(undefined, config.arrayPosition));
	            }
	            config.viewProps.bindClassModifiers(this.element);
	            const inputElem = doc.createElement('input');
	            inputElem.classList.add(className$g('i'));
	            inputElem.type = 'text';
	            config.viewProps.bindDisabled(inputElem);
	            this.element.appendChild(inputElem);
	            this.inputElement = inputElem;
	            this.onDraggingChange_ = this.onDraggingChange_.bind(this);
	            this.dragging_ = config.dragging;
	            this.dragging_.emitter.on('change', this.onDraggingChange_);
	            this.element.classList.add(className$g());
	            this.inputElement.classList.add(className$g('i'));
	            const knobElem = doc.createElement('div');
	            knobElem.classList.add(className$g('k'));
	            this.element.appendChild(knobElem);
	            this.knobElement = knobElem;
	            const guideElem = doc.createElementNS(SVG_NS, 'svg');
	            guideElem.classList.add(className$g('g'));
	            this.knobElement.appendChild(guideElem);
	            const bodyElem = doc.createElementNS(SVG_NS, 'path');
	            bodyElem.classList.add(className$g('gb'));
	            guideElem.appendChild(bodyElem);
	            this.guideBodyElem_ = bodyElem;
	            const headElem = doc.createElementNS(SVG_NS, 'path');
	            headElem.classList.add(className$g('gh'));
	            guideElem.appendChild(headElem);
	            this.guideHeadElem_ = headElem;
	            const tooltipElem = doc.createElement('div');
	            tooltipElem.classList.add(ClassName('tt')());
	            this.knobElement.appendChild(tooltipElem);
	            this.tooltipElem_ = tooltipElem;
	            config.value.emitter.on('change', this.onChange_);
	            this.value = config.value;
	            this.refresh();
	        }
	        onDraggingChange_(ev) {
	            if (ev.rawValue === null) {
	                this.element.classList.remove(className$g(undefined, 'drg'));
	                return;
	            }
	            this.element.classList.add(className$g(undefined, 'drg'));
	            const x = ev.rawValue / this.props_.get('draggingScale');
	            const aox = x + (x > 0 ? -1 : x < 0 ? +1 : 0);
	            const adx = constrainRange(-aox, -4, +4);
	            this.guideHeadElem_.setAttributeNS(null, 'd', [`M ${aox + adx},0 L${aox},4 L${aox + adx},8`, `M ${x},-1 L${x},9`].join(' '));
	            this.guideBodyElem_.setAttributeNS(null, 'd', `M 0,4 L${x},4`);
	            const formatter = this.props_.get('formatter');
	            this.tooltipElem_.textContent = formatter(this.value.rawValue);
	            this.tooltipElem_.style.left = `${x}px`;
	        }
	        refresh() {
	            const formatter = this.props_.get('formatter');
	            this.inputElement.value = formatter(this.value.rawValue);
	        }
	        onChange_() {
	            this.refresh();
	        }
	    }

	    class NumberTextController {
	        constructor(doc, config) {
	            var _a;
	            this.originRawValue_ = 0;
	            this.onInputChange_ = this.onInputChange_.bind(this);
	            this.onInputKeyDown_ = this.onInputKeyDown_.bind(this);
	            this.onInputKeyUp_ = this.onInputKeyUp_.bind(this);
	            this.onPointerDown_ = this.onPointerDown_.bind(this);
	            this.onPointerMove_ = this.onPointerMove_.bind(this);
	            this.onPointerUp_ = this.onPointerUp_.bind(this);
	            this.baseStep_ = config.baseStep;
	            this.parser_ = config.parser;
	            this.props = config.props;
	            this.sliderProps_ = (_a = config.sliderProps) !== null && _a !== void 0 ? _a : null;
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.dragging_ = createValue(null);
	            this.view = new NumberTextView(doc, {
	                arrayPosition: config.arrayPosition,
	                dragging: this.dragging_,
	                props: this.props,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.view.inputElement.addEventListener('change', this.onInputChange_);
	            this.view.inputElement.addEventListener('keydown', this.onInputKeyDown_);
	            this.view.inputElement.addEventListener('keyup', this.onInputKeyUp_);
	            const ph = new PointerHandler(this.view.knobElement);
	            ph.emitter.on('down', this.onPointerDown_);
	            ph.emitter.on('move', this.onPointerMove_);
	            ph.emitter.on('up', this.onPointerUp_);
	        }
	        constrainValue_(value) {
	            var _a, _b;
	            const min = (_a = this.sliderProps_) === null || _a === void 0 ? void 0 : _a.get('minValue');
	            const max = (_b = this.sliderProps_) === null || _b === void 0 ? void 0 : _b.get('maxValue');
	            let v = value;
	            if (min !== undefined) {
	                v = Math.max(v, min);
	            }
	            if (max !== undefined) {
	                v = Math.min(v, max);
	            }
	            return v;
	        }
	        onInputChange_(e) {
	            const inputElem = forceCast(e.currentTarget);
	            const value = inputElem.value;
	            const parsedValue = this.parser_(value);
	            if (!isEmpty(parsedValue)) {
	                this.value.rawValue = this.constrainValue_(parsedValue);
	            }
	            this.view.refresh();
	        }
	        onInputKeyDown_(ev) {
	            const step = getStepForKey(this.baseStep_, getVerticalStepKeys(ev));
	            if (step === 0) {
	                return;
	            }
	            this.value.setRawValue(this.constrainValue_(this.value.rawValue + step), {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onInputKeyUp_(ev) {
	            const step = getStepForKey(this.baseStep_, getVerticalStepKeys(ev));
	            if (step === 0) {
	                return;
	            }
	            this.value.setRawValue(this.value.rawValue, {
	                forceEmit: true,
	                last: true,
	            });
	        }
	        onPointerDown_() {
	            this.originRawValue_ = this.value.rawValue;
	            this.dragging_.rawValue = 0;
	        }
	        computeDraggingValue_(data) {
	            if (!data.point) {
	                return null;
	            }
	            const dx = data.point.x - data.bounds.width / 2;
	            return this.constrainValue_(this.originRawValue_ + dx * this.props.get('draggingScale'));
	        }
	        onPointerMove_(ev) {
	            const v = this.computeDraggingValue_(ev.data);
	            if (v === null) {
	                return;
	            }
	            this.value.setRawValue(v, {
	                forceEmit: false,
	                last: false,
	            });
	            this.dragging_.rawValue = this.value.rawValue - this.originRawValue_;
	        }
	        onPointerUp_(ev) {
	            const v = this.computeDraggingValue_(ev.data);
	            if (v === null) {
	                return;
	            }
	            this.value.setRawValue(v, {
	                forceEmit: true,
	                last: true,
	            });
	            this.dragging_.rawValue = null;
	        }
	    }

	    const className$f = ClassName('sld');
	    class SliderView {
	        constructor(doc, config) {
	            this.onChange_ = this.onChange_.bind(this);
	            this.props_ = config.props;
	            this.props_.emitter.on('change', this.onChange_);
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$f());
	            config.viewProps.bindClassModifiers(this.element);
	            const trackElem = doc.createElement('div');
	            trackElem.classList.add(className$f('t'));
	            config.viewProps.bindTabIndex(trackElem);
	            this.element.appendChild(trackElem);
	            this.trackElement = trackElem;
	            const knobElem = doc.createElement('div');
	            knobElem.classList.add(className$f('k'));
	            this.trackElement.appendChild(knobElem);
	            this.knobElement = knobElem;
	            config.value.emitter.on('change', this.onChange_);
	            this.value = config.value;
	            this.update_();
	        }
	        update_() {
	            const p = constrainRange(mapRange(this.value.rawValue, this.props_.get('minValue'), this.props_.get('maxValue'), 0, 100), 0, 100);
	            this.knobElement.style.width = `${p}%`;
	        }
	        onChange_() {
	            this.update_();
	        }
	    }

	    class SliderController {
	        constructor(doc, config) {
	            this.onKeyDown_ = this.onKeyDown_.bind(this);
	            this.onKeyUp_ = this.onKeyUp_.bind(this);
	            this.onPointerDownOrMove_ = this.onPointerDownOrMove_.bind(this);
	            this.onPointerUp_ = this.onPointerUp_.bind(this);
	            this.baseStep_ = config.baseStep;
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.props = config.props;
	            this.view = new SliderView(doc, {
	                props: this.props,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.ptHandler_ = new PointerHandler(this.view.trackElement);
	            this.ptHandler_.emitter.on('down', this.onPointerDownOrMove_);
	            this.ptHandler_.emitter.on('move', this.onPointerDownOrMove_);
	            this.ptHandler_.emitter.on('up', this.onPointerUp_);
	            this.view.trackElement.addEventListener('keydown', this.onKeyDown_);
	            this.view.trackElement.addEventListener('keyup', this.onKeyUp_);
	        }
	        handlePointerEvent_(d, opts) {
	            if (!d.point) {
	                return;
	            }
	            this.value.setRawValue(mapRange(constrainRange(d.point.x, 0, d.bounds.width), 0, d.bounds.width, this.props.get('minValue'), this.props.get('maxValue')), opts);
	        }
	        onPointerDownOrMove_(ev) {
	            this.handlePointerEvent_(ev.data, {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onPointerUp_(ev) {
	            this.handlePointerEvent_(ev.data, {
	                forceEmit: true,
	                last: true,
	            });
	        }
	        onKeyDown_(ev) {
	            const step = getStepForKey(this.baseStep_, getHorizontalStepKeys(ev));
	            if (step === 0) {
	                return;
	            }
	            this.value.setRawValue(this.value.rawValue + step, {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onKeyUp_(ev) {
	            const step = getStepForKey(this.baseStep_, getHorizontalStepKeys(ev));
	            if (step === 0) {
	                return;
	            }
	            this.value.setRawValue(this.value.rawValue, {
	                forceEmit: true,
	                last: true,
	            });
	        }
	    }

	    const className$e = ClassName('sldtxt');
	    class SliderTextView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$e());
	            const sliderElem = doc.createElement('div');
	            sliderElem.classList.add(className$e('s'));
	            this.sliderView_ = config.sliderView;
	            sliderElem.appendChild(this.sliderView_.element);
	            this.element.appendChild(sliderElem);
	            const textElem = doc.createElement('div');
	            textElem.classList.add(className$e('t'));
	            this.textView_ = config.textView;
	            textElem.appendChild(this.textView_.element);
	            this.element.appendChild(textElem);
	        }
	    }

	    class SliderTextController {
	        constructor(doc, config) {
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.sliderC_ = new SliderController(doc, {
	                baseStep: config.baseStep,
	                props: config.sliderProps,
	                value: config.value,
	                viewProps: this.viewProps,
	            });
	            this.textC_ = new NumberTextController(doc, {
	                baseStep: config.baseStep,
	                parser: config.parser,
	                props: config.textProps,
	                sliderProps: config.sliderProps,
	                value: config.value,
	                viewProps: config.viewProps,
	            });
	            this.view = new SliderTextView(doc, {
	                sliderView: this.sliderC_.view,
	                textView: this.textC_.view,
	            });
	        }
	        get sliderController() {
	            return this.sliderC_;
	        }
	        get textController() {
	            return this.textC_;
	        }
	    }

	    function writePrimitive(target, value) {
	        target.write(value);
	    }

	    function parseListOptions(value) {
	        const p = ParamsParsers;
	        if (Array.isArray(value)) {
	            return p.required.array(p.required.object({
	                text: p.required.string,
	                value: p.required.raw,
	            }))(value).value;
	        }
	        if (typeof value === 'object') {
	            return p.required.raw(value)
	                .value;
	        }
	        return undefined;
	    }
	    function parsePickerLayout(value) {
	        if (value === 'inline' || value === 'popup') {
	            return value;
	        }
	        return undefined;
	    }
	    function parsePointDimensionParams(value) {
	        const p = ParamsParsers;
	        return p.required.object({
	            max: p.optional.number,
	            min: p.optional.number,
	            step: p.optional.number,
	        })(value).value;
	    }
	    function normalizeListOptions(options) {
	        if (Array.isArray(options)) {
	            return options;
	        }
	        const items = [];
	        Object.keys(options).forEach((text) => {
	            items.push({ text: text, value: options[text] });
	        });
	        return items;
	    }
	    function createListConstraint(options) {
	        return !isEmpty(options)
	            ? new ListConstraint(normalizeListOptions(forceCast(options)))
	            : null;
	    }
	    function findStep(constraint) {
	        const c = constraint ? findConstraint(constraint, StepConstraint) : null;
	        if (!c) {
	            return null;
	        }
	        return c.step;
	    }
	    function getSuitableDecimalDigits(constraint, rawValue) {
	        const sc = constraint && findConstraint(constraint, StepConstraint);
	        if (sc) {
	            return getDecimalDigits(sc.step);
	        }
	        return Math.max(getDecimalDigits(rawValue), 2);
	    }
	    function getBaseStep(constraint) {
	        const step = findStep(constraint);
	        return step !== null && step !== void 0 ? step : 1;
	    }
	    function getSuitableDraggingScale(constraint, rawValue) {
	        var _a;
	        const sc = constraint && findConstraint(constraint, StepConstraint);
	        const base = Math.abs((_a = sc === null || sc === void 0 ? void 0 : sc.step) !== null && _a !== void 0 ? _a : rawValue);
	        return base === 0 ? 0.1 : Math.pow(10, Math.floor(Math.log10(base)) - 1);
	    }

	    const className$d = ClassName('ckb');
	    class CheckboxView {
	        constructor(doc, config) {
	            this.onValueChange_ = this.onValueChange_.bind(this);
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$d());
	            config.viewProps.bindClassModifiers(this.element);
	            const labelElem = doc.createElement('label');
	            labelElem.classList.add(className$d('l'));
	            this.element.appendChild(labelElem);
	            const inputElem = doc.createElement('input');
	            inputElem.classList.add(className$d('i'));
	            inputElem.type = 'checkbox';
	            labelElem.appendChild(inputElem);
	            this.inputElement = inputElem;
	            config.viewProps.bindDisabled(this.inputElement);
	            const wrapperElem = doc.createElement('div');
	            wrapperElem.classList.add(className$d('w'));
	            labelElem.appendChild(wrapperElem);
	            const markElem = createSvgIconElement(doc, 'check');
	            wrapperElem.appendChild(markElem);
	            config.value.emitter.on('change', this.onValueChange_);
	            this.value = config.value;
	            this.update_();
	        }
	        update_() {
	            this.inputElement.checked = this.value.rawValue;
	        }
	        onValueChange_() {
	            this.update_();
	        }
	    }

	    class CheckboxController {
	        constructor(doc, config) {
	            this.onInputChange_ = this.onInputChange_.bind(this);
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.view = new CheckboxView(doc, {
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.view.inputElement.addEventListener('change', this.onInputChange_);
	        }
	        onInputChange_(e) {
	            const inputElem = forceCast(e.currentTarget);
	            this.value.rawValue = inputElem.checked;
	        }
	    }

	    function createConstraint$6(params) {
	        const constraints = [];
	        const lc = createListConstraint(params.options);
	        if (lc) {
	            constraints.push(lc);
	        }
	        return new CompositeConstraint(constraints);
	    }
	    const BooleanInputPlugin = {
	        id: 'input-bool',
	        type: 'input',
	        accept: (value, params) => {
	            if (typeof value !== 'boolean') {
	                return null;
	            }
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                options: p.optional.custom(parseListOptions),
	            });
	            return result
	                ? {
	                    initialValue: value,
	                    params: result,
	                }
	                : null;
	        },
	        binding: {
	            reader: (_args) => boolFromUnknown,
	            constraint: (args) => createConstraint$6(args.params),
	            writer: (_args) => writePrimitive,
	        },
	        controller: (args) => {
	            const doc = args.document;
	            const value = args.value;
	            const c = args.constraint;
	            const lc = c && findConstraint(c, ListConstraint);
	            if (lc) {
	                return new ListController(doc, {
	                    props: new ValueMap({
	                        options: lc.values.value('options'),
	                    }),
	                    value: value,
	                    viewProps: args.viewProps,
	                });
	            }
	            return new CheckboxController(doc, {
	                value: value,
	                viewProps: args.viewProps,
	            });
	        },
	    };

	    const className$c = ClassName('col');
	    class ColorView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$c());
	            config.foldable.bindExpandedClass(this.element, className$c(undefined, 'expanded'));
	            bindValueMap(config.foldable, 'completed', valueToClassName(this.element, className$c(undefined, 'cpl')));
	            const headElem = doc.createElement('div');
	            headElem.classList.add(className$c('h'));
	            this.element.appendChild(headElem);
	            const swatchElem = doc.createElement('div');
	            swatchElem.classList.add(className$c('s'));
	            headElem.appendChild(swatchElem);
	            this.swatchElement = swatchElem;
	            const textElem = doc.createElement('div');
	            textElem.classList.add(className$c('t'));
	            headElem.appendChild(textElem);
	            this.textElement = textElem;
	            if (config.pickerLayout === 'inline') {
	                const pickerElem = doc.createElement('div');
	                pickerElem.classList.add(className$c('p'));
	                this.element.appendChild(pickerElem);
	                this.pickerElement = pickerElem;
	            }
	            else {
	                this.pickerElement = null;
	            }
	        }
	    }

	    function rgbToHslInt(r, g, b) {
	        const rp = constrainRange(r / 255, 0, 1);
	        const gp = constrainRange(g / 255, 0, 1);
	        const bp = constrainRange(b / 255, 0, 1);
	        const cmax = Math.max(rp, gp, bp);
	        const cmin = Math.min(rp, gp, bp);
	        const c = cmax - cmin;
	        let h = 0;
	        let s = 0;
	        const l = (cmin + cmax) / 2;
	        if (c !== 0) {
	            s = c / (1 - Math.abs(cmax + cmin - 1));
	            if (rp === cmax) {
	                h = (gp - bp) / c;
	            }
	            else if (gp === cmax) {
	                h = 2 + (bp - rp) / c;
	            }
	            else {
	                h = 4 + (rp - gp) / c;
	            }
	            h = h / 6 + (h < 0 ? 1 : 0);
	        }
	        return [h * 360, s * 100, l * 100];
	    }
	    function hslToRgbInt(h, s, l) {
	        const hp = ((h % 360) + 360) % 360;
	        const sp = constrainRange(s / 100, 0, 1);
	        const lp = constrainRange(l / 100, 0, 1);
	        const c = (1 - Math.abs(2 * lp - 1)) * sp;
	        const x = c * (1 - Math.abs(((hp / 60) % 2) - 1));
	        const m = lp - c / 2;
	        let rp, gp, bp;
	        if (hp >= 0 && hp < 60) {
	            [rp, gp, bp] = [c, x, 0];
	        }
	        else if (hp >= 60 && hp < 120) {
	            [rp, gp, bp] = [x, c, 0];
	        }
	        else if (hp >= 120 && hp < 180) {
	            [rp, gp, bp] = [0, c, x];
	        }
	        else if (hp >= 180 && hp < 240) {
	            [rp, gp, bp] = [0, x, c];
	        }
	        else if (hp >= 240 && hp < 300) {
	            [rp, gp, bp] = [x, 0, c];
	        }
	        else {
	            [rp, gp, bp] = [c, 0, x];
	        }
	        return [(rp + m) * 255, (gp + m) * 255, (bp + m) * 255];
	    }
	    function rgbToHsvInt(r, g, b) {
	        const rp = constrainRange(r / 255, 0, 1);
	        const gp = constrainRange(g / 255, 0, 1);
	        const bp = constrainRange(b / 255, 0, 1);
	        const cmax = Math.max(rp, gp, bp);
	        const cmin = Math.min(rp, gp, bp);
	        const d = cmax - cmin;
	        let h;
	        if (d === 0) {
	            h = 0;
	        }
	        else if (cmax === rp) {
	            h = 60 * (((((gp - bp) / d) % 6) + 6) % 6);
	        }
	        else if (cmax === gp) {
	            h = 60 * ((bp - rp) / d + 2);
	        }
	        else {
	            h = 60 * ((rp - gp) / d + 4);
	        }
	        const s = cmax === 0 ? 0 : d / cmax;
	        const v = cmax;
	        return [h, s * 100, v * 100];
	    }
	    function hsvToRgbInt(h, s, v) {
	        const hp = loopRange(h, 360);
	        const sp = constrainRange(s / 100, 0, 1);
	        const vp = constrainRange(v / 100, 0, 1);
	        const c = vp * sp;
	        const x = c * (1 - Math.abs(((hp / 60) % 2) - 1));
	        const m = vp - c;
	        let rp, gp, bp;
	        if (hp >= 0 && hp < 60) {
	            [rp, gp, bp] = [c, x, 0];
	        }
	        else if (hp >= 60 && hp < 120) {
	            [rp, gp, bp] = [x, c, 0];
	        }
	        else if (hp >= 120 && hp < 180) {
	            [rp, gp, bp] = [0, c, x];
	        }
	        else if (hp >= 180 && hp < 240) {
	            [rp, gp, bp] = [0, x, c];
	        }
	        else if (hp >= 240 && hp < 300) {
	            [rp, gp, bp] = [x, 0, c];
	        }
	        else {
	            [rp, gp, bp] = [c, 0, x];
	        }
	        return [(rp + m) * 255, (gp + m) * 255, (bp + m) * 255];
	    }
	    function hslToHsvInt(h, s, l) {
	        const sd = l + (s * (100 - Math.abs(2 * l - 100))) / (2 * 100);
	        return [
	            h,
	            sd !== 0 ? (s * (100 - Math.abs(2 * l - 100))) / sd : 0,
	            l + (s * (100 - Math.abs(2 * l - 100))) / (2 * 100),
	        ];
	    }
	    function hsvToHslInt(h, s, v) {
	        const sd = 100 - Math.abs((v * (200 - s)) / 100 - 100);
	        return [h, sd !== 0 ? (s * v) / sd : 0, (v * (200 - s)) / (2 * 100)];
	    }
	    function removeAlphaComponent(comps) {
	        return [comps[0], comps[1], comps[2]];
	    }
	    function appendAlphaComponent(comps, alpha) {
	        return [comps[0], comps[1], comps[2], alpha];
	    }
	    const MODE_CONVERTER_MAP = {
	        hsl: {
	            hsl: (h, s, l) => [h, s, l],
	            hsv: hslToHsvInt,
	            rgb: hslToRgbInt,
	        },
	        hsv: {
	            hsl: hsvToHslInt,
	            hsv: (h, s, v) => [h, s, v],
	            rgb: hsvToRgbInt,
	        },
	        rgb: {
	            hsl: rgbToHslInt,
	            hsv: rgbToHsvInt,
	            rgb: (r, g, b) => [r, g, b],
	        },
	    };
	    function getColorMaxComponents(mode, type) {
	        return [
	            type === 'float' ? 1 : mode === 'rgb' ? 255 : 360,
	            type === 'float' ? 1 : mode === 'rgb' ? 255 : 100,
	            type === 'float' ? 1 : mode === 'rgb' ? 255 : 100,
	        ];
	    }
	    function loopHueRange(hue, max) {
	        return hue === max ? max : loopRange(hue, max);
	    }
	    function constrainColorComponents(components, mode, type) {
	        var _a;
	        const ms = getColorMaxComponents(mode, type);
	        return [
	            mode === 'rgb'
	                ? constrainRange(components[0], 0, ms[0])
	                : loopHueRange(components[0], ms[0]),
	            constrainRange(components[1], 0, ms[1]),
	            constrainRange(components[2], 0, ms[2]),
	            constrainRange((_a = components[3]) !== null && _a !== void 0 ? _a : 1, 0, 1),
	        ];
	    }
	    function convertColorType(comps, mode, from, to) {
	        const fms = getColorMaxComponents(mode, from);
	        const tms = getColorMaxComponents(mode, to);
	        return comps.map((c, index) => (c / fms[index]) * tms[index]);
	    }
	    function convertColor(components, from, to) {
	        const intComps = convertColorType(components, from.mode, from.type, 'int');
	        const result = MODE_CONVERTER_MAP[from.mode][to.mode](...intComps);
	        return convertColorType(result, to.mode, 'int', to.type);
	    }

	    function isRgbColorComponent(obj, key) {
	        if (typeof obj !== 'object' || isEmpty(obj)) {
	            return false;
	        }
	        return key in obj && typeof obj[key] === 'number';
	    }
	    class Color {
	        static black(type = 'int') {
	            return new Color([0, 0, 0], 'rgb', type);
	        }
	        static fromObject(obj, type = 'int') {
	            const comps = 'a' in obj ? [obj.r, obj.g, obj.b, obj.a] : [obj.r, obj.g, obj.b];
	            return new Color(comps, 'rgb', type);
	        }
	        static toRgbaObject(color, type = 'int') {
	            return color.toRgbaObject(type);
	        }
	        static isRgbColorObject(obj) {
	            return (isRgbColorComponent(obj, 'r') &&
	                isRgbColorComponent(obj, 'g') &&
	                isRgbColorComponent(obj, 'b'));
	        }
	        static isRgbaColorObject(obj) {
	            return this.isRgbColorObject(obj) && isRgbColorComponent(obj, 'a');
	        }
	        static isColorObject(obj) {
	            return this.isRgbColorObject(obj);
	        }
	        static equals(v1, v2) {
	            if (v1.mode !== v2.mode) {
	                return false;
	            }
	            const comps1 = v1.comps_;
	            const comps2 = v2.comps_;
	            for (let i = 0; i < comps1.length; i++) {
	                if (comps1[i] !== comps2[i]) {
	                    return false;
	                }
	            }
	            return true;
	        }
	        constructor(comps, mode, type = 'int') {
	            this.mode = mode;
	            this.type = type;
	            this.comps_ = constrainColorComponents(comps, mode, type);
	        }
	        getComponents(opt_mode, type = 'int') {
	            return appendAlphaComponent(convertColor(removeAlphaComponent(this.comps_), { mode: this.mode, type: this.type }, { mode: opt_mode !== null && opt_mode !== void 0 ? opt_mode : this.mode, type }), this.comps_[3]);
	        }
	        toRgbaObject(type = 'int') {
	            const rgbComps = this.getComponents('rgb', type);
	            return {
	                r: rgbComps[0],
	                g: rgbComps[1],
	                b: rgbComps[2],
	                a: rgbComps[3],
	            };
	        }
	    }

	    const className$b = ClassName('colp');
	    class ColorPickerView {
	        constructor(doc, config) {
	            this.alphaViews_ = null;
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$b());
	            config.viewProps.bindClassModifiers(this.element);
	            const hsvElem = doc.createElement('div');
	            hsvElem.classList.add(className$b('hsv'));
	            const svElem = doc.createElement('div');
	            svElem.classList.add(className$b('sv'));
	            this.svPaletteView_ = config.svPaletteView;
	            svElem.appendChild(this.svPaletteView_.element);
	            hsvElem.appendChild(svElem);
	            const hElem = doc.createElement('div');
	            hElem.classList.add(className$b('h'));
	            this.hPaletteView_ = config.hPaletteView;
	            hElem.appendChild(this.hPaletteView_.element);
	            hsvElem.appendChild(hElem);
	            this.element.appendChild(hsvElem);
	            const rgbElem = doc.createElement('div');
	            rgbElem.classList.add(className$b('rgb'));
	            this.textView_ = config.textView;
	            rgbElem.appendChild(this.textView_.element);
	            this.element.appendChild(rgbElem);
	            if (config.alphaViews) {
	                this.alphaViews_ = {
	                    palette: config.alphaViews.palette,
	                    text: config.alphaViews.text,
	                };
	                const aElem = doc.createElement('div');
	                aElem.classList.add(className$b('a'));
	                const apElem = doc.createElement('div');
	                apElem.classList.add(className$b('ap'));
	                apElem.appendChild(this.alphaViews_.palette.element);
	                aElem.appendChild(apElem);
	                const atElem = doc.createElement('div');
	                atElem.classList.add(className$b('at'));
	                atElem.appendChild(this.alphaViews_.text.element);
	                aElem.appendChild(atElem);
	                this.element.appendChild(aElem);
	            }
	        }
	        get allFocusableElements() {
	            const elems = [
	                this.svPaletteView_.element,
	                this.hPaletteView_.element,
	                this.textView_.modeSelectElement,
	                ...this.textView_.textViews.map((v) => v.inputElement),
	            ];
	            if (this.alphaViews_) {
	                elems.push(this.alphaViews_.palette.element, this.alphaViews_.text.inputElement);
	            }
	            return elems;
	        }
	    }

	    function parseColorType(value) {
	        return value === 'int' ? 'int' : value === 'float' ? 'float' : undefined;
	    }
	    function parseColorInputParams(params) {
	        const p = ParamsParsers;
	        return parseParams(params, {
	            alpha: p.optional.boolean,
	            color: p.optional.object({
	                alpha: p.optional.boolean,
	                type: p.optional.custom(parseColorType),
	            }),
	            expanded: p.optional.boolean,
	            picker: p.optional.custom(parsePickerLayout),
	        });
	    }
	    function getBaseStepForColor(forAlpha) {
	        return forAlpha ? 0.1 : 1;
	    }
	    function extractColorType(params) {
	        var _a;
	        return (_a = params.color) === null || _a === void 0 ? void 0 : _a.type;
	    }

	    function equalsStringColorFormat(f1, f2) {
	        return (f1.alpha === f2.alpha &&
	            f1.mode === f2.mode &&
	            f1.notation === f2.notation &&
	            f1.type === f2.type);
	    }
	    function parseCssNumberOrPercentage(text, maxValue) {
	        const m = text.match(/^(.+)%$/);
	        if (!m) {
	            return Math.min(parseFloat(text), maxValue);
	        }
	        return Math.min(parseFloat(m[1]) * 0.01 * maxValue, maxValue);
	    }
	    const ANGLE_TO_DEG_MAP = {
	        deg: (angle) => angle,
	        grad: (angle) => (angle * 360) / 400,
	        rad: (angle) => (angle * 360) / (2 * Math.PI),
	        turn: (angle) => angle * 360,
	    };
	    function parseCssNumberOrAngle(text) {
	        const m = text.match(/^([0-9.]+?)(deg|grad|rad|turn)$/);
	        if (!m) {
	            return parseFloat(text);
	        }
	        const angle = parseFloat(m[1]);
	        const unit = m[2];
	        return ANGLE_TO_DEG_MAP[unit](angle);
	    }
	    function parseFunctionalRgbColorComponents(text) {
	        const m = text.match(/^rgb\(\s*([0-9A-Fa-f.]+%?)\s*,\s*([0-9A-Fa-f.]+%?)\s*,\s*([0-9A-Fa-f.]+%?)\s*\)$/);
	        if (!m) {
	            return null;
	        }
	        const comps = [
	            parseCssNumberOrPercentage(m[1], 255),
	            parseCssNumberOrPercentage(m[2], 255),
	            parseCssNumberOrPercentage(m[3], 255),
	        ];
	        if (isNaN(comps[0]) || isNaN(comps[1]) || isNaN(comps[2])) {
	            return null;
	        }
	        return comps;
	    }
	    function createFunctionalRgbColorParser(type) {
	        return (text) => {
	            const comps = parseFunctionalRgbColorComponents(text);
	            return comps ? new Color(comps, 'rgb', type) : null;
	        };
	    }
	    function parseFunctionalRgbaColorComponents(text) {
	        const m = text.match(/^rgba\(\s*([0-9A-Fa-f.]+%?)\s*,\s*([0-9A-Fa-f.]+%?)\s*,\s*([0-9A-Fa-f.]+%?)\s*,\s*([0-9A-Fa-f.]+%?)\s*\)$/);
	        if (!m) {
	            return null;
	        }
	        const comps = [
	            parseCssNumberOrPercentage(m[1], 255),
	            parseCssNumberOrPercentage(m[2], 255),
	            parseCssNumberOrPercentage(m[3], 255),
	            parseCssNumberOrPercentage(m[4], 1),
	        ];
	        if (isNaN(comps[0]) ||
	            isNaN(comps[1]) ||
	            isNaN(comps[2]) ||
	            isNaN(comps[3])) {
	            return null;
	        }
	        return comps;
	    }
	    function createFunctionalRgbaColorParser(type) {
	        return (text) => {
	            const comps = parseFunctionalRgbaColorComponents(text);
	            return comps ? new Color(comps, 'rgb', type) : null;
	        };
	    }
	    function parseHslColorComponents(text) {
	        const m = text.match(/^hsl\(\s*([0-9A-Fa-f.]+(?:deg|grad|rad|turn)?)\s*,\s*([0-9A-Fa-f.]+%?)\s*,\s*([0-9A-Fa-f.]+%?)\s*\)$/);
	        if (!m) {
	            return null;
	        }
	        const comps = [
	            parseCssNumberOrAngle(m[1]),
	            parseCssNumberOrPercentage(m[2], 100),
	            parseCssNumberOrPercentage(m[3], 100),
	        ];
	        if (isNaN(comps[0]) || isNaN(comps[1]) || isNaN(comps[2])) {
	            return null;
	        }
	        return comps;
	    }
	    function createHslColorParser(type) {
	        return (text) => {
	            const comps = parseHslColorComponents(text);
	            return comps ? new Color(comps, 'hsl', type) : null;
	        };
	    }
	    function parseHslaColorComponents(text) {
	        const m = text.match(/^hsla\(\s*([0-9A-Fa-f.]+(?:deg|grad|rad|turn)?)\s*,\s*([0-9A-Fa-f.]+%?)\s*,\s*([0-9A-Fa-f.]+%?)\s*,\s*([0-9A-Fa-f.]+%?)\s*\)$/);
	        if (!m) {
	            return null;
	        }
	        const comps = [
	            parseCssNumberOrAngle(m[1]),
	            parseCssNumberOrPercentage(m[2], 100),
	            parseCssNumberOrPercentage(m[3], 100),
	            parseCssNumberOrPercentage(m[4], 1),
	        ];
	        if (isNaN(comps[0]) ||
	            isNaN(comps[1]) ||
	            isNaN(comps[2]) ||
	            isNaN(comps[3])) {
	            return null;
	        }
	        return comps;
	    }
	    function createHslaColorParser(type) {
	        return (text) => {
	            const comps = parseHslaColorComponents(text);
	            return comps ? new Color(comps, 'hsl', type) : null;
	        };
	    }
	    function parseHexRgbColorComponents(text) {
	        const mRgb = text.match(/^#([0-9A-Fa-f])([0-9A-Fa-f])([0-9A-Fa-f])$/);
	        if (mRgb) {
	            return [
	                parseInt(mRgb[1] + mRgb[1], 16),
	                parseInt(mRgb[2] + mRgb[2], 16),
	                parseInt(mRgb[3] + mRgb[3], 16),
	            ];
	        }
	        const mRrggbb = text.match(/^(?:#|0x)([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/);
	        if (mRrggbb) {
	            return [
	                parseInt(mRrggbb[1], 16),
	                parseInt(mRrggbb[2], 16),
	                parseInt(mRrggbb[3], 16),
	            ];
	        }
	        return null;
	    }
	    function parseHexRgbColor(text) {
	        const comps = parseHexRgbColorComponents(text);
	        return comps ? new Color(comps, 'rgb', 'int') : null;
	    }
	    function parseHexRgbaColorComponents(text) {
	        const mRgb = text.match(/^#?([0-9A-Fa-f])([0-9A-Fa-f])([0-9A-Fa-f])([0-9A-Fa-f])$/);
	        if (mRgb) {
	            return [
	                parseInt(mRgb[1] + mRgb[1], 16),
	                parseInt(mRgb[2] + mRgb[2], 16),
	                parseInt(mRgb[3] + mRgb[3], 16),
	                mapRange(parseInt(mRgb[4] + mRgb[4], 16), 0, 255, 0, 1),
	            ];
	        }
	        const mRrggbb = text.match(/^(?:#|0x)?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/);
	        if (mRrggbb) {
	            return [
	                parseInt(mRrggbb[1], 16),
	                parseInt(mRrggbb[2], 16),
	                parseInt(mRrggbb[3], 16),
	                mapRange(parseInt(mRrggbb[4], 16), 0, 255, 0, 1),
	            ];
	        }
	        return null;
	    }
	    function parseHexRgbaColor(text) {
	        const comps = parseHexRgbaColorComponents(text);
	        return comps ? new Color(comps, 'rgb', 'int') : null;
	    }
	    function parseObjectRgbColorComponents(text) {
	        const m = text.match(/^\{\s*r\s*:\s*([0-9A-Fa-f.]+%?)\s*,\s*g\s*:\s*([0-9A-Fa-f.]+%?)\s*,\s*b\s*:\s*([0-9A-Fa-f.]+%?)\s*\}$/);
	        if (!m) {
	            return null;
	        }
	        const comps = [
	            parseFloat(m[1]),
	            parseFloat(m[2]),
	            parseFloat(m[3]),
	        ];
	        if (isNaN(comps[0]) || isNaN(comps[1]) || isNaN(comps[2])) {
	            return null;
	        }
	        return comps;
	    }
	    function createObjectRgbColorParser(type) {
	        return (text) => {
	            const comps = parseObjectRgbColorComponents(text);
	            return comps ? new Color(comps, 'rgb', type) : null;
	        };
	    }
	    function parseObjectRgbaColorComponents(text) {
	        const m = text.match(/^\{\s*r\s*:\s*([0-9A-Fa-f.]+%?)\s*,\s*g\s*:\s*([0-9A-Fa-f.]+%?)\s*,\s*b\s*:\s*([0-9A-Fa-f.]+%?)\s*,\s*a\s*:\s*([0-9A-Fa-f.]+%?)\s*\}$/);
	        if (!m) {
	            return null;
	        }
	        const comps = [
	            parseFloat(m[1]),
	            parseFloat(m[2]),
	            parseFloat(m[3]),
	            parseFloat(m[4]),
	        ];
	        if (isNaN(comps[0]) ||
	            isNaN(comps[1]) ||
	            isNaN(comps[2]) ||
	            isNaN(comps[3])) {
	            return null;
	        }
	        return comps;
	    }
	    function createObjectRgbaColorParser(type) {
	        return (text) => {
	            const comps = parseObjectRgbaColorComponents(text);
	            return comps ? new Color(comps, 'rgb', type) : null;
	        };
	    }
	    const PARSER_AND_RESULT = [
	        {
	            parser: parseHexRgbColorComponents,
	            result: {
	                alpha: false,
	                mode: 'rgb',
	                notation: 'hex',
	            },
	        },
	        {
	            parser: parseHexRgbaColorComponents,
	            result: {
	                alpha: true,
	                mode: 'rgb',
	                notation: 'hex',
	            },
	        },
	        {
	            parser: parseFunctionalRgbColorComponents,
	            result: {
	                alpha: false,
	                mode: 'rgb',
	                notation: 'func',
	            },
	        },
	        {
	            parser: parseFunctionalRgbaColorComponents,
	            result: {
	                alpha: true,
	                mode: 'rgb',
	                notation: 'func',
	            },
	        },
	        {
	            parser: parseHslColorComponents,
	            result: {
	                alpha: false,
	                mode: 'hsl',
	                notation: 'func',
	            },
	        },
	        {
	            parser: parseHslaColorComponents,
	            result: {
	                alpha: true,
	                mode: 'hsl',
	                notation: 'func',
	            },
	        },
	        {
	            parser: parseObjectRgbColorComponents,
	            result: {
	                alpha: false,
	                mode: 'rgb',
	                notation: 'object',
	            },
	        },
	        {
	            parser: parseObjectRgbaColorComponents,
	            result: {
	                alpha: true,
	                mode: 'rgb',
	                notation: 'object',
	            },
	        },
	    ];
	    function detectStringColor(text) {
	        return PARSER_AND_RESULT.reduce((prev, { parser, result: detection }) => {
	            if (prev) {
	                return prev;
	            }
	            return parser(text) ? detection : null;
	        }, null);
	    }
	    function detectStringColorFormat(text, type = 'int') {
	        const r = detectStringColor(text);
	        if (!r) {
	            return null;
	        }
	        if (r.notation === 'hex' && type !== 'float') {
	            return Object.assign(Object.assign({}, r), { type: 'int' });
	        }
	        if (r.notation === 'func') {
	            return Object.assign(Object.assign({}, r), { type: type });
	        }
	        return null;
	    }
	    const TYPE_TO_PARSERS = {
	        int: [
	            parseHexRgbColor,
	            parseHexRgbaColor,
	            createFunctionalRgbColorParser('int'),
	            createFunctionalRgbaColorParser('int'),
	            createHslColorParser('int'),
	            createHslaColorParser('int'),
	            createObjectRgbColorParser('int'),
	            createObjectRgbaColorParser('int'),
	        ],
	        float: [
	            createFunctionalRgbColorParser('float'),
	            createFunctionalRgbaColorParser('float'),
	            createHslColorParser('float'),
	            createHslaColorParser('float'),
	            createObjectRgbColorParser('float'),
	            createObjectRgbaColorParser('float'),
	        ],
	    };
	    function createColorStringBindingReader(type) {
	        const parsers = TYPE_TO_PARSERS[type];
	        return (value) => {
	            if (typeof value !== 'string') {
	                return Color.black(type);
	            }
	            const result = parsers.reduce((prev, parser) => {
	                if (prev) {
	                    return prev;
	                }
	                return parser(value);
	            }, null);
	            return result !== null && result !== void 0 ? result : Color.black(type);
	        };
	    }
	    function createColorStringParser(type) {
	        const parsers = TYPE_TO_PARSERS[type];
	        return (value) => {
	            return parsers.reduce((prev, parser) => {
	                if (prev) {
	                    return prev;
	                }
	                return parser(value);
	            }, null);
	        };
	    }
	    function zerofill(comp) {
	        const hex = constrainRange(Math.floor(comp), 0, 255).toString(16);
	        return hex.length === 1 ? `0${hex}` : hex;
	    }
	    function colorToHexRgbString(value, prefix = '#') {
	        const hexes = removeAlphaComponent(value.getComponents('rgb'))
	            .map(zerofill)
	            .join('');
	        return `${prefix}${hexes}`;
	    }
	    function colorToHexRgbaString(value, prefix = '#') {
	        const rgbaComps = value.getComponents('rgb');
	        const hexes = [rgbaComps[0], rgbaComps[1], rgbaComps[2], rgbaComps[3] * 255]
	            .map(zerofill)
	            .join('');
	        return `${prefix}${hexes}`;
	    }
	    function colorToFunctionalRgbString(value, opt_type) {
	        const formatter = createNumberFormatter(opt_type === 'float' ? 2 : 0);
	        const comps = removeAlphaComponent(value.getComponents('rgb', opt_type)).map((comp) => formatter(comp));
	        return `rgb(${comps.join(', ')})`;
	    }
	    function createFunctionalRgbColorFormatter(type) {
	        return (value) => {
	            return colorToFunctionalRgbString(value, type);
	        };
	    }
	    function colorToFunctionalRgbaString(value, opt_type) {
	        const aFormatter = createNumberFormatter(2);
	        const rgbFormatter = createNumberFormatter(opt_type === 'float' ? 2 : 0);
	        const comps = value.getComponents('rgb', opt_type).map((comp, index) => {
	            const formatter = index === 3 ? aFormatter : rgbFormatter;
	            return formatter(comp);
	        });
	        return `rgba(${comps.join(', ')})`;
	    }
	    function createFunctionalRgbaColorFormatter(type) {
	        return (value) => {
	            return colorToFunctionalRgbaString(value, type);
	        };
	    }
	    function colorToFunctionalHslString(value) {
	        const formatters = [
	            createNumberFormatter(0),
	            formatPercentage,
	            formatPercentage,
	        ];
	        const comps = removeAlphaComponent(value.getComponents('hsl')).map((comp, index) => formatters[index](comp));
	        return `hsl(${comps.join(', ')})`;
	    }
	    function colorToFunctionalHslaString(value) {
	        const formatters = [
	            createNumberFormatter(0),
	            formatPercentage,
	            formatPercentage,
	            createNumberFormatter(2),
	        ];
	        const comps = value
	            .getComponents('hsl')
	            .map((comp, index) => formatters[index](comp));
	        return `hsla(${comps.join(', ')})`;
	    }
	    function colorToObjectRgbString(value, type) {
	        const formatter = createNumberFormatter(type === 'float' ? 2 : 0);
	        const names = ['r', 'g', 'b'];
	        const comps = removeAlphaComponent(value.getComponents('rgb', type)).map((comp, index) => `${names[index]}: ${formatter(comp)}`);
	        return `{${comps.join(', ')}}`;
	    }
	    function createObjectRgbColorFormatter(type) {
	        return (value) => colorToObjectRgbString(value, type);
	    }
	    function colorToObjectRgbaString(value, type) {
	        const aFormatter = createNumberFormatter(2);
	        const rgbFormatter = createNumberFormatter(type === 'float' ? 2 : 0);
	        const names = ['r', 'g', 'b', 'a'];
	        const comps = value.getComponents('rgb', type).map((comp, index) => {
	            const formatter = index === 3 ? aFormatter : rgbFormatter;
	            return `${names[index]}: ${formatter(comp)}`;
	        });
	        return `{${comps.join(', ')}}`;
	    }
	    function createObjectRgbaColorFormatter(type) {
	        return (value) => colorToObjectRgbaString(value, type);
	    }
	    const FORMAT_AND_STRINGIFIERS = [
	        {
	            format: {
	                alpha: false,
	                mode: 'rgb',
	                notation: 'hex',
	                type: 'int',
	            },
	            stringifier: colorToHexRgbString,
	        },
	        {
	            format: {
	                alpha: true,
	                mode: 'rgb',
	                notation: 'hex',
	                type: 'int',
	            },
	            stringifier: colorToHexRgbaString,
	        },
	        {
	            format: {
	                alpha: false,
	                mode: 'hsl',
	                notation: 'func',
	                type: 'int',
	            },
	            stringifier: colorToFunctionalHslString,
	        },
	        {
	            format: {
	                alpha: true,
	                mode: 'hsl',
	                notation: 'func',
	                type: 'int',
	            },
	            stringifier: colorToFunctionalHslaString,
	        },
	        ...['int', 'float'].reduce((prev, type) => {
	            return [
	                ...prev,
	                {
	                    format: {
	                        alpha: false,
	                        mode: 'rgb',
	                        notation: 'func',
	                        type: type,
	                    },
	                    stringifier: createFunctionalRgbColorFormatter(type),
	                },
	                {
	                    format: {
	                        alpha: true,
	                        mode: 'rgb',
	                        notation: 'func',
	                        type: type,
	                    },
	                    stringifier: createFunctionalRgbaColorFormatter(type),
	                },
	                {
	                    format: {
	                        alpha: false,
	                        mode: 'rgb',
	                        notation: 'object',
	                        type: type,
	                    },
	                    stringifier: createObjectRgbColorFormatter(type),
	                },
	                {
	                    format: {
	                        alpha: true,
	                        mode: 'rgb',
	                        notation: 'object',
	                        type: type,
	                    },
	                    stringifier: createObjectRgbaColorFormatter(type),
	                },
	            ];
	        }, []),
	    ];
	    function findColorStringifier(format) {
	        return FORMAT_AND_STRINGIFIERS.reduce((prev, fas) => {
	            if (prev) {
	                return prev;
	            }
	            return equalsStringColorFormat(fas.format, format)
	                ? fas.stringifier
	                : null;
	        }, null);
	    }

	    const className$a = ClassName('apl');
	    class APaletteView {
	        constructor(doc, config) {
	            this.onValueChange_ = this.onValueChange_.bind(this);
	            this.value = config.value;
	            this.value.emitter.on('change', this.onValueChange_);
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$a());
	            config.viewProps.bindClassModifiers(this.element);
	            config.viewProps.bindTabIndex(this.element);
	            const barElem = doc.createElement('div');
	            barElem.classList.add(className$a('b'));
	            this.element.appendChild(barElem);
	            const colorElem = doc.createElement('div');
	            colorElem.classList.add(className$a('c'));
	            barElem.appendChild(colorElem);
	            this.colorElem_ = colorElem;
	            const markerElem = doc.createElement('div');
	            markerElem.classList.add(className$a('m'));
	            this.element.appendChild(markerElem);
	            this.markerElem_ = markerElem;
	            const previewElem = doc.createElement('div');
	            previewElem.classList.add(className$a('p'));
	            this.markerElem_.appendChild(previewElem);
	            this.previewElem_ = previewElem;
	            this.update_();
	        }
	        update_() {
	            const c = this.value.rawValue;
	            const rgbaComps = c.getComponents('rgb');
	            const leftColor = new Color([rgbaComps[0], rgbaComps[1], rgbaComps[2], 0], 'rgb');
	            const rightColor = new Color([rgbaComps[0], rgbaComps[1], rgbaComps[2], 255], 'rgb');
	            const gradientComps = [
	                'to right',
	                colorToFunctionalRgbaString(leftColor),
	                colorToFunctionalRgbaString(rightColor),
	            ];
	            this.colorElem_.style.background = `linear-gradient(${gradientComps.join(',')})`;
	            this.previewElem_.style.backgroundColor = colorToFunctionalRgbaString(c);
	            const left = mapRange(rgbaComps[3], 0, 1, 0, 100);
	            this.markerElem_.style.left = `${left}%`;
	        }
	        onValueChange_() {
	            this.update_();
	        }
	    }

	    class APaletteController {
	        constructor(doc, config) {
	            this.onKeyDown_ = this.onKeyDown_.bind(this);
	            this.onKeyUp_ = this.onKeyUp_.bind(this);
	            this.onPointerDown_ = this.onPointerDown_.bind(this);
	            this.onPointerMove_ = this.onPointerMove_.bind(this);
	            this.onPointerUp_ = this.onPointerUp_.bind(this);
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.view = new APaletteView(doc, {
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.ptHandler_ = new PointerHandler(this.view.element);
	            this.ptHandler_.emitter.on('down', this.onPointerDown_);
	            this.ptHandler_.emitter.on('move', this.onPointerMove_);
	            this.ptHandler_.emitter.on('up', this.onPointerUp_);
	            this.view.element.addEventListener('keydown', this.onKeyDown_);
	            this.view.element.addEventListener('keyup', this.onKeyUp_);
	        }
	        handlePointerEvent_(d, opts) {
	            if (!d.point) {
	                return;
	            }
	            const alpha = d.point.x / d.bounds.width;
	            const c = this.value.rawValue;
	            const [h, s, v] = c.getComponents('hsv');
	            this.value.setRawValue(new Color([h, s, v, alpha], 'hsv'), opts);
	        }
	        onPointerDown_(ev) {
	            this.handlePointerEvent_(ev.data, {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onPointerMove_(ev) {
	            this.handlePointerEvent_(ev.data, {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onPointerUp_(ev) {
	            this.handlePointerEvent_(ev.data, {
	                forceEmit: true,
	                last: true,
	            });
	        }
	        onKeyDown_(ev) {
	            const step = getStepForKey(getBaseStepForColor(true), getHorizontalStepKeys(ev));
	            if (step === 0) {
	                return;
	            }
	            const c = this.value.rawValue;
	            const [h, s, v, a] = c.getComponents('hsv');
	            this.value.setRawValue(new Color([h, s, v, a + step], 'hsv'), {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onKeyUp_(ev) {
	            const step = getStepForKey(getBaseStepForColor(true), getHorizontalStepKeys(ev));
	            if (step === 0) {
	                return;
	            }
	            this.value.setRawValue(this.value.rawValue, {
	                forceEmit: true,
	                last: true,
	            });
	        }
	    }

	    const className$9 = ClassName('coltxt');
	    function createModeSelectElement(doc) {
	        const selectElem = doc.createElement('select');
	        const items = [
	            { text: 'RGB', value: 'rgb' },
	            { text: 'HSL', value: 'hsl' },
	            { text: 'HSV', value: 'hsv' },
	        ];
	        selectElem.appendChild(items.reduce((frag, item) => {
	            const optElem = doc.createElement('option');
	            optElem.textContent = item.text;
	            optElem.value = item.value;
	            frag.appendChild(optElem);
	            return frag;
	        }, doc.createDocumentFragment()));
	        return selectElem;
	    }
	    class ColorTextView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$9());
	            config.viewProps.bindClassModifiers(this.element);
	            const modeElem = doc.createElement('div');
	            modeElem.classList.add(className$9('m'));
	            this.modeElem_ = createModeSelectElement(doc);
	            this.modeElem_.classList.add(className$9('ms'));
	            modeElem.appendChild(this.modeSelectElement);
	            config.viewProps.bindDisabled(this.modeElem_);
	            const modeMarkerElem = doc.createElement('div');
	            modeMarkerElem.classList.add(className$9('mm'));
	            modeMarkerElem.appendChild(createSvgIconElement(doc, 'dropdown'));
	            modeElem.appendChild(modeMarkerElem);
	            this.element.appendChild(modeElem);
	            const textsElem = doc.createElement('div');
	            textsElem.classList.add(className$9('w'));
	            this.element.appendChild(textsElem);
	            this.textsElem_ = textsElem;
	            this.textViews_ = config.textViews;
	            this.applyTextViews_();
	            bindValue(config.colorMode, (mode) => {
	                this.modeElem_.value = mode;
	            });
	        }
	        get modeSelectElement() {
	            return this.modeElem_;
	        }
	        get textViews() {
	            return this.textViews_;
	        }
	        set textViews(textViews) {
	            this.textViews_ = textViews;
	            this.applyTextViews_();
	        }
	        applyTextViews_() {
	            removeChildElements(this.textsElem_);
	            const doc = this.element.ownerDocument;
	            this.textViews_.forEach((v) => {
	                const compElem = doc.createElement('div');
	                compElem.classList.add(className$9('c'));
	                compElem.appendChild(v.element);
	                this.textsElem_.appendChild(compElem);
	            });
	        }
	    }

	    function createFormatter$2(type) {
	        return createNumberFormatter(type === 'float' ? 2 : 0);
	    }
	    function createConstraint$5(mode, type, index) {
	        const max = getColorMaxComponents(mode, type)[index];
	        return new DefiniteRangeConstraint({
	            min: 0,
	            max: max,
	        });
	    }
	    function createComponentController(doc, config, index) {
	        return new NumberTextController(doc, {
	            arrayPosition: index === 0 ? 'fst' : index === 3 - 1 ? 'lst' : 'mid',
	            baseStep: getBaseStepForColor(false),
	            parser: config.parser,
	            props: ValueMap.fromObject({
	                draggingScale: config.colorType === 'float' ? 0.01 : 1,
	                formatter: createFormatter$2(config.colorType),
	            }),
	            value: createValue(0, {
	                constraint: createConstraint$5(config.colorMode, config.colorType, index),
	            }),
	            viewProps: config.viewProps,
	        });
	    }
	    class ColorTextController {
	        constructor(doc, config) {
	            this.onModeSelectChange_ = this.onModeSelectChange_.bind(this);
	            this.colorType_ = config.colorType;
	            this.parser_ = config.parser;
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.colorMode = createValue(this.value.rawValue.mode);
	            this.ccs_ = this.createComponentControllers_(doc);
	            this.view = new ColorTextView(doc, {
	                colorMode: this.colorMode,
	                textViews: [this.ccs_[0].view, this.ccs_[1].view, this.ccs_[2].view],
	                viewProps: this.viewProps,
	            });
	            this.view.modeSelectElement.addEventListener('change', this.onModeSelectChange_);
	        }
	        createComponentControllers_(doc) {
	            const cc = {
	                colorMode: this.colorMode.rawValue,
	                colorType: this.colorType_,
	                parser: this.parser_,
	                viewProps: this.viewProps,
	            };
	            const ccs = [
	                createComponentController(doc, cc, 0),
	                createComponentController(doc, cc, 1),
	                createComponentController(doc, cc, 2),
	            ];
	            ccs.forEach((cs, index) => {
	                connectValues({
	                    primary: this.value,
	                    secondary: cs.value,
	                    forward: (p) => {
	                        return p.rawValue.getComponents(this.colorMode.rawValue, this.colorType_)[index];
	                    },
	                    backward: (p, s) => {
	                        const pickedMode = this.colorMode.rawValue;
	                        const comps = p.rawValue.getComponents(pickedMode, this.colorType_);
	                        comps[index] = s.rawValue;
	                        return new Color(appendAlphaComponent(removeAlphaComponent(comps), comps[3]), pickedMode, this.colorType_);
	                    },
	                });
	            });
	            return ccs;
	        }
	        onModeSelectChange_(ev) {
	            const selectElem = ev.currentTarget;
	            this.colorMode.rawValue = selectElem.value;
	            this.ccs_ = this.createComponentControllers_(this.view.element.ownerDocument);
	            this.view.textViews = [
	                this.ccs_[0].view,
	                this.ccs_[1].view,
	                this.ccs_[2].view,
	            ];
	        }
	    }

	    const className$8 = ClassName('hpl');
	    class HPaletteView {
	        constructor(doc, config) {
	            this.onValueChange_ = this.onValueChange_.bind(this);
	            this.value = config.value;
	            this.value.emitter.on('change', this.onValueChange_);
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$8());
	            config.viewProps.bindClassModifiers(this.element);
	            config.viewProps.bindTabIndex(this.element);
	            const colorElem = doc.createElement('div');
	            colorElem.classList.add(className$8('c'));
	            this.element.appendChild(colorElem);
	            const markerElem = doc.createElement('div');
	            markerElem.classList.add(className$8('m'));
	            this.element.appendChild(markerElem);
	            this.markerElem_ = markerElem;
	            this.update_();
	        }
	        update_() {
	            const c = this.value.rawValue;
	            const [h] = c.getComponents('hsv');
	            this.markerElem_.style.backgroundColor = colorToFunctionalRgbString(new Color([h, 100, 100], 'hsv'));
	            const left = mapRange(h, 0, 360, 0, 100);
	            this.markerElem_.style.left = `${left}%`;
	        }
	        onValueChange_() {
	            this.update_();
	        }
	    }

	    class HPaletteController {
	        constructor(doc, config) {
	            this.onKeyDown_ = this.onKeyDown_.bind(this);
	            this.onKeyUp_ = this.onKeyUp_.bind(this);
	            this.onPointerDown_ = this.onPointerDown_.bind(this);
	            this.onPointerMove_ = this.onPointerMove_.bind(this);
	            this.onPointerUp_ = this.onPointerUp_.bind(this);
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.view = new HPaletteView(doc, {
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.ptHandler_ = new PointerHandler(this.view.element);
	            this.ptHandler_.emitter.on('down', this.onPointerDown_);
	            this.ptHandler_.emitter.on('move', this.onPointerMove_);
	            this.ptHandler_.emitter.on('up', this.onPointerUp_);
	            this.view.element.addEventListener('keydown', this.onKeyDown_);
	            this.view.element.addEventListener('keyup', this.onKeyUp_);
	        }
	        handlePointerEvent_(d, opts) {
	            if (!d.point) {
	                return;
	            }
	            const hue = mapRange(constrainRange(d.point.x, 0, d.bounds.width), 0, d.bounds.width, 0, 360);
	            const c = this.value.rawValue;
	            const [, s, v, a] = c.getComponents('hsv');
	            this.value.setRawValue(new Color([hue, s, v, a], 'hsv'), opts);
	        }
	        onPointerDown_(ev) {
	            this.handlePointerEvent_(ev.data, {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onPointerMove_(ev) {
	            this.handlePointerEvent_(ev.data, {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onPointerUp_(ev) {
	            this.handlePointerEvent_(ev.data, {
	                forceEmit: true,
	                last: true,
	            });
	        }
	        onKeyDown_(ev) {
	            const step = getStepForKey(getBaseStepForColor(false), getHorizontalStepKeys(ev));
	            if (step === 0) {
	                return;
	            }
	            const c = this.value.rawValue;
	            const [h, s, v, a] = c.getComponents('hsv');
	            this.value.setRawValue(new Color([h + step, s, v, a], 'hsv'), {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onKeyUp_(ev) {
	            const step = getStepForKey(getBaseStepForColor(false), getHorizontalStepKeys(ev));
	            if (step === 0) {
	                return;
	            }
	            this.value.setRawValue(this.value.rawValue, {
	                forceEmit: true,
	                last: true,
	            });
	        }
	    }

	    const className$7 = ClassName('svp');
	    const CANVAS_RESOL = 64;
	    class SvPaletteView {
	        constructor(doc, config) {
	            this.onValueChange_ = this.onValueChange_.bind(this);
	            this.value = config.value;
	            this.value.emitter.on('change', this.onValueChange_);
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$7());
	            config.viewProps.bindClassModifiers(this.element);
	            config.viewProps.bindTabIndex(this.element);
	            const canvasElem = doc.createElement('canvas');
	            canvasElem.height = CANVAS_RESOL;
	            canvasElem.width = CANVAS_RESOL;
	            canvasElem.classList.add(className$7('c'));
	            this.element.appendChild(canvasElem);
	            this.canvasElement = canvasElem;
	            const markerElem = doc.createElement('div');
	            markerElem.classList.add(className$7('m'));
	            this.element.appendChild(markerElem);
	            this.markerElem_ = markerElem;
	            this.update_();
	        }
	        update_() {
	            const ctx = getCanvasContext(this.canvasElement);
	            if (!ctx) {
	                return;
	            }
	            const c = this.value.rawValue;
	            const hsvComps = c.getComponents('hsv');
	            const width = this.canvasElement.width;
	            const height = this.canvasElement.height;
	            const imgData = ctx.getImageData(0, 0, width, height);
	            const data = imgData.data;
	            for (let iy = 0; iy < height; iy++) {
	                for (let ix = 0; ix < width; ix++) {
	                    const s = mapRange(ix, 0, width, 0, 100);
	                    const v = mapRange(iy, 0, height, 100, 0);
	                    const rgbComps = hsvToRgbInt(hsvComps[0], s, v);
	                    const i = (iy * width + ix) * 4;
	                    data[i] = rgbComps[0];
	                    data[i + 1] = rgbComps[1];
	                    data[i + 2] = rgbComps[2];
	                    data[i + 3] = 255;
	                }
	            }
	            ctx.putImageData(imgData, 0, 0);
	            const left = mapRange(hsvComps[1], 0, 100, 0, 100);
	            this.markerElem_.style.left = `${left}%`;
	            const top = mapRange(hsvComps[2], 0, 100, 100, 0);
	            this.markerElem_.style.top = `${top}%`;
	        }
	        onValueChange_() {
	            this.update_();
	        }
	    }

	    class SvPaletteController {
	        constructor(doc, config) {
	            this.onKeyDown_ = this.onKeyDown_.bind(this);
	            this.onKeyUp_ = this.onKeyUp_.bind(this);
	            this.onPointerDown_ = this.onPointerDown_.bind(this);
	            this.onPointerMove_ = this.onPointerMove_.bind(this);
	            this.onPointerUp_ = this.onPointerUp_.bind(this);
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.view = new SvPaletteView(doc, {
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.ptHandler_ = new PointerHandler(this.view.element);
	            this.ptHandler_.emitter.on('down', this.onPointerDown_);
	            this.ptHandler_.emitter.on('move', this.onPointerMove_);
	            this.ptHandler_.emitter.on('up', this.onPointerUp_);
	            this.view.element.addEventListener('keydown', this.onKeyDown_);
	            this.view.element.addEventListener('keyup', this.onKeyUp_);
	        }
	        handlePointerEvent_(d, opts) {
	            if (!d.point) {
	                return;
	            }
	            const saturation = mapRange(d.point.x, 0, d.bounds.width, 0, 100);
	            const value = mapRange(d.point.y, 0, d.bounds.height, 100, 0);
	            const [h, , , a] = this.value.rawValue.getComponents('hsv');
	            this.value.setRawValue(new Color([h, saturation, value, a], 'hsv'), opts);
	        }
	        onPointerDown_(ev) {
	            this.handlePointerEvent_(ev.data, {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onPointerMove_(ev) {
	            this.handlePointerEvent_(ev.data, {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onPointerUp_(ev) {
	            this.handlePointerEvent_(ev.data, {
	                forceEmit: true,
	                last: true,
	            });
	        }
	        onKeyDown_(ev) {
	            if (isArrowKey(ev.key)) {
	                ev.preventDefault();
	            }
	            const [h, s, v, a] = this.value.rawValue.getComponents('hsv');
	            const baseStep = getBaseStepForColor(false);
	            const ds = getStepForKey(baseStep, getHorizontalStepKeys(ev));
	            const dv = getStepForKey(baseStep, getVerticalStepKeys(ev));
	            if (ds === 0 && dv === 0) {
	                return;
	            }
	            this.value.setRawValue(new Color([h, s + ds, v + dv, a], 'hsv'), {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onKeyUp_(ev) {
	            const baseStep = getBaseStepForColor(false);
	            const ds = getStepForKey(baseStep, getHorizontalStepKeys(ev));
	            const dv = getStepForKey(baseStep, getVerticalStepKeys(ev));
	            if (ds === 0 && dv === 0) {
	                return;
	            }
	            this.value.setRawValue(this.value.rawValue, {
	                forceEmit: true,
	                last: true,
	            });
	        }
	    }

	    class ColorPickerController {
	        constructor(doc, config) {
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.hPaletteC_ = new HPaletteController(doc, {
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.svPaletteC_ = new SvPaletteController(doc, {
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.alphaIcs_ = config.supportsAlpha
	                ? {
	                    palette: new APaletteController(doc, {
	                        value: this.value,
	                        viewProps: this.viewProps,
	                    }),
	                    text: new NumberTextController(doc, {
	                        parser: parseNumber,
	                        baseStep: 0.1,
	                        props: ValueMap.fromObject({
	                            draggingScale: 0.01,
	                            formatter: createNumberFormatter(2),
	                        }),
	                        value: createValue(0, {
	                            constraint: new DefiniteRangeConstraint({ min: 0, max: 1 }),
	                        }),
	                        viewProps: this.viewProps,
	                    }),
	                }
	                : null;
	            if (this.alphaIcs_) {
	                connectValues({
	                    primary: this.value,
	                    secondary: this.alphaIcs_.text.value,
	                    forward: (p) => {
	                        return p.rawValue.getComponents()[3];
	                    },
	                    backward: (p, s) => {
	                        const comps = p.rawValue.getComponents();
	                        comps[3] = s.rawValue;
	                        return new Color(comps, p.rawValue.mode);
	                    },
	                });
	            }
	            this.textC_ = new ColorTextController(doc, {
	                colorType: config.colorType,
	                parser: parseNumber,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.view = new ColorPickerView(doc, {
	                alphaViews: this.alphaIcs_
	                    ? {
	                        palette: this.alphaIcs_.palette.view,
	                        text: this.alphaIcs_.text.view,
	                    }
	                    : null,
	                hPaletteView: this.hPaletteC_.view,
	                supportsAlpha: config.supportsAlpha,
	                svPaletteView: this.svPaletteC_.view,
	                textView: this.textC_.view,
	                viewProps: this.viewProps,
	            });
	        }
	        get textController() {
	            return this.textC_;
	        }
	    }

	    const className$6 = ClassName('colsw');
	    class ColorSwatchView {
	        constructor(doc, config) {
	            this.onValueChange_ = this.onValueChange_.bind(this);
	            config.value.emitter.on('change', this.onValueChange_);
	            this.value = config.value;
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$6());
	            config.viewProps.bindClassModifiers(this.element);
	            const swatchElem = doc.createElement('div');
	            swatchElem.classList.add(className$6('sw'));
	            this.element.appendChild(swatchElem);
	            this.swatchElem_ = swatchElem;
	            const buttonElem = doc.createElement('button');
	            buttonElem.classList.add(className$6('b'));
	            config.viewProps.bindDisabled(buttonElem);
	            this.element.appendChild(buttonElem);
	            this.buttonElement = buttonElem;
	            this.update_();
	        }
	        update_() {
	            const value = this.value.rawValue;
	            this.swatchElem_.style.backgroundColor = colorToHexRgbaString(value);
	        }
	        onValueChange_() {
	            this.update_();
	        }
	    }

	    class ColorSwatchController {
	        constructor(doc, config) {
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.view = new ColorSwatchView(doc, {
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	        }
	    }

	    class ColorController {
	        constructor(doc, config) {
	            this.onButtonBlur_ = this.onButtonBlur_.bind(this);
	            this.onButtonClick_ = this.onButtonClick_.bind(this);
	            this.onPopupChildBlur_ = this.onPopupChildBlur_.bind(this);
	            this.onPopupChildKeydown_ = this.onPopupChildKeydown_.bind(this);
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.foldable_ = Foldable.create(config.expanded);
	            this.swatchC_ = new ColorSwatchController(doc, {
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            const buttonElem = this.swatchC_.view.buttonElement;
	            buttonElem.addEventListener('blur', this.onButtonBlur_);
	            buttonElem.addEventListener('click', this.onButtonClick_);
	            this.textC_ = new TextController(doc, {
	                parser: config.parser,
	                props: ValueMap.fromObject({
	                    formatter: config.formatter,
	                }),
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.view = new ColorView(doc, {
	                foldable: this.foldable_,
	                pickerLayout: config.pickerLayout,
	            });
	            this.view.swatchElement.appendChild(this.swatchC_.view.element);
	            this.view.textElement.appendChild(this.textC_.view.element);
	            this.popC_ =
	                config.pickerLayout === 'popup'
	                    ? new PopupController(doc, {
	                        viewProps: this.viewProps,
	                    })
	                    : null;
	            const pickerC = new ColorPickerController(doc, {
	                colorType: config.colorType,
	                supportsAlpha: config.supportsAlpha,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            pickerC.view.allFocusableElements.forEach((elem) => {
	                elem.addEventListener('blur', this.onPopupChildBlur_);
	                elem.addEventListener('keydown', this.onPopupChildKeydown_);
	            });
	            this.pickerC_ = pickerC;
	            if (this.popC_) {
	                this.view.element.appendChild(this.popC_.view.element);
	                this.popC_.view.element.appendChild(pickerC.view.element);
	                connectValues({
	                    primary: this.foldable_.value('expanded'),
	                    secondary: this.popC_.shows,
	                    forward: (p) => p.rawValue,
	                    backward: (_, s) => s.rawValue,
	                });
	            }
	            else if (this.view.pickerElement) {
	                this.view.pickerElement.appendChild(this.pickerC_.view.element);
	                bindFoldable(this.foldable_, this.view.pickerElement);
	            }
	        }
	        get textController() {
	            return this.textC_;
	        }
	        onButtonBlur_(e) {
	            if (!this.popC_) {
	                return;
	            }
	            const elem = this.view.element;
	            const nextTarget = forceCast(e.relatedTarget);
	            if (!nextTarget || !elem.contains(nextTarget)) {
	                this.popC_.shows.rawValue = false;
	            }
	        }
	        onButtonClick_() {
	            this.foldable_.set('expanded', !this.foldable_.get('expanded'));
	            if (this.foldable_.get('expanded')) {
	                this.pickerC_.view.allFocusableElements[0].focus();
	            }
	        }
	        onPopupChildBlur_(ev) {
	            if (!this.popC_) {
	                return;
	            }
	            const elem = this.popC_.view.element;
	            const nextTarget = findNextTarget(ev);
	            if (nextTarget && elem.contains(nextTarget)) {
	                return;
	            }
	            if (nextTarget &&
	                nextTarget === this.swatchC_.view.buttonElement &&
	                !supportsTouch(elem.ownerDocument)) {
	                return;
	            }
	            this.popC_.shows.rawValue = false;
	        }
	        onPopupChildKeydown_(ev) {
	            if (this.popC_) {
	                if (ev.key === 'Escape') {
	                    this.popC_.shows.rawValue = false;
	                }
	            }
	            else if (this.view.pickerElement) {
	                if (ev.key === 'Escape') {
	                    this.swatchC_.view.buttonElement.focus();
	                }
	            }
	        }
	    }

	    function colorFromObject(value, opt_type) {
	        if (Color.isColorObject(value)) {
	            return Color.fromObject(value, opt_type);
	        }
	        return Color.black(opt_type);
	    }
	    function colorToRgbNumber(value) {
	        return removeAlphaComponent(value.getComponents('rgb')).reduce((result, comp) => {
	            return (result << 8) | (Math.floor(comp) & 0xff);
	        }, 0);
	    }
	    function colorToRgbaNumber(value) {
	        return (value.getComponents('rgb').reduce((result, comp, index) => {
	            const hex = Math.floor(index === 3 ? comp * 255 : comp) & 0xff;
	            return (result << 8) | hex;
	        }, 0) >>> 0);
	    }
	    function numberToRgbColor(num) {
	        return new Color([(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff], 'rgb');
	    }
	    function numberToRgbaColor(num) {
	        return new Color([
	            (num >> 24) & 0xff,
	            (num >> 16) & 0xff,
	            (num >> 8) & 0xff,
	            mapRange(num & 0xff, 0, 255, 0, 1),
	        ], 'rgb');
	    }
	    function colorFromRgbNumber(value) {
	        if (typeof value !== 'number') {
	            return Color.black();
	        }
	        return numberToRgbColor(value);
	    }
	    function colorFromRgbaNumber(value) {
	        if (typeof value !== 'number') {
	            return Color.black();
	        }
	        return numberToRgbaColor(value);
	    }

	    function createColorStringWriter(format) {
	        const stringify = findColorStringifier(format);
	        return stringify
	            ? (target, value) => {
	                writePrimitive(target, stringify(value));
	            }
	            : null;
	    }
	    function createColorNumberWriter(supportsAlpha) {
	        const colorToNumber = supportsAlpha ? colorToRgbaNumber : colorToRgbNumber;
	        return (target, value) => {
	            writePrimitive(target, colorToNumber(value));
	        };
	    }
	    function writeRgbaColorObject(target, value, opt_type) {
	        const obj = value.toRgbaObject(opt_type);
	        target.writeProperty('r', obj.r);
	        target.writeProperty('g', obj.g);
	        target.writeProperty('b', obj.b);
	        target.writeProperty('a', obj.a);
	    }
	    function writeRgbColorObject(target, value, opt_type) {
	        const obj = value.toRgbaObject(opt_type);
	        target.writeProperty('r', obj.r);
	        target.writeProperty('g', obj.g);
	        target.writeProperty('b', obj.b);
	    }
	    function createColorObjectWriter(supportsAlpha, opt_type) {
	        return (target, inValue) => {
	            if (supportsAlpha) {
	                writeRgbaColorObject(target, inValue, opt_type);
	            }
	            else {
	                writeRgbColorObject(target, inValue, opt_type);
	            }
	        };
	    }

	    function shouldSupportAlpha$1(inputParams) {
	        var _a;
	        if ((inputParams === null || inputParams === void 0 ? void 0 : inputParams.alpha) || ((_a = inputParams === null || inputParams === void 0 ? void 0 : inputParams.color) === null || _a === void 0 ? void 0 : _a.alpha)) {
	            return true;
	        }
	        return false;
	    }
	    function createFormatter$1(supportsAlpha) {
	        return supportsAlpha
	            ? (v) => colorToHexRgbaString(v, '0x')
	            : (v) => colorToHexRgbString(v, '0x');
	    }
	    function isForColor(params) {
	        if ('color' in params) {
	            return true;
	        }
	        if ('view' in params && params.view === 'color') {
	            return true;
	        }
	        return false;
	    }
	    const NumberColorInputPlugin = {
	        id: 'input-color-number',
	        type: 'input',
	        accept: (value, params) => {
	            if (typeof value !== 'number') {
	                return null;
	            }
	            if (!isForColor(params)) {
	                return null;
	            }
	            const result = parseColorInputParams(params);
	            return result
	                ? {
	                    initialValue: value,
	                    params: result,
	                }
	                : null;
	        },
	        binding: {
	            reader: (args) => {
	                return shouldSupportAlpha$1(args.params)
	                    ? colorFromRgbaNumber
	                    : colorFromRgbNumber;
	            },
	            equals: Color.equals,
	            writer: (args) => {
	                return createColorNumberWriter(shouldSupportAlpha$1(args.params));
	            },
	        },
	        controller: (args) => {
	            const supportsAlpha = shouldSupportAlpha$1(args.params);
	            const expanded = 'expanded' in args.params ? args.params.expanded : undefined;
	            const picker = 'picker' in args.params ? args.params.picker : undefined;
	            return new ColorController(args.document, {
	                colorType: 'int',
	                expanded: expanded !== null && expanded !== void 0 ? expanded : false,
	                formatter: createFormatter$1(supportsAlpha),
	                parser: createColorStringParser('int'),
	                pickerLayout: picker !== null && picker !== void 0 ? picker : 'popup',
	                supportsAlpha: supportsAlpha,
	                value: args.value,
	                viewProps: args.viewProps,
	            });
	        },
	    };

	    function shouldSupportAlpha(initialValue) {
	        return Color.isRgbaColorObject(initialValue);
	    }
	    function createColorObjectReader(opt_type) {
	        return (value) => {
	            return colorFromObject(value, opt_type);
	        };
	    }
	    function createColorObjectFormatter(supportsAlpha, type) {
	        return (value) => {
	            if (supportsAlpha) {
	                return colorToObjectRgbaString(value, type);
	            }
	            return colorToObjectRgbString(value, type);
	        };
	    }
	    const ObjectColorInputPlugin = {
	        id: 'input-color-object',
	        type: 'input',
	        accept: (value, params) => {
	            if (!Color.isColorObject(value)) {
	                return null;
	            }
	            const result = parseColorInputParams(params);
	            return result
	                ? {
	                    initialValue: value,
	                    params: result,
	                }
	                : null;
	        },
	        binding: {
	            reader: (args) => createColorObjectReader(extractColorType(args.params)),
	            equals: Color.equals,
	            writer: (args) => createColorObjectWriter(shouldSupportAlpha(args.initialValue), extractColorType(args.params)),
	        },
	        controller: (args) => {
	            var _a;
	            const supportsAlpha = Color.isRgbaColorObject(args.initialValue);
	            const expanded = 'expanded' in args.params ? args.params.expanded : undefined;
	            const picker = 'picker' in args.params ? args.params.picker : undefined;
	            const type = (_a = extractColorType(args.params)) !== null && _a !== void 0 ? _a : 'int';
	            return new ColorController(args.document, {
	                colorType: type,
	                expanded: expanded !== null && expanded !== void 0 ? expanded : false,
	                formatter: createColorObjectFormatter(supportsAlpha, type),
	                parser: createColorStringParser(type),
	                pickerLayout: picker !== null && picker !== void 0 ? picker : 'popup',
	                supportsAlpha: supportsAlpha,
	                value: args.value,
	                viewProps: args.viewProps,
	            });
	        },
	    };

	    const StringColorInputPlugin = {
	        id: 'input-color-string',
	        type: 'input',
	        accept: (value, params) => {
	            if (typeof value !== 'string') {
	                return null;
	            }
	            if ('view' in params && params.view === 'text') {
	                return null;
	            }
	            const format = detectStringColorFormat(value, extractColorType(params));
	            if (!format) {
	                return null;
	            }
	            const stringifier = findColorStringifier(format);
	            if (!stringifier) {
	                return null;
	            }
	            const result = parseColorInputParams(params);
	            return result
	                ? {
	                    initialValue: value,
	                    params: result,
	                }
	                : null;
	        },
	        binding: {
	            reader: (args) => { var _a; return createColorStringBindingReader((_a = extractColorType(args.params)) !== null && _a !== void 0 ? _a : 'int'); },
	            equals: Color.equals,
	            writer: (args) => {
	                const format = detectStringColorFormat(args.initialValue, extractColorType(args.params));
	                if (!format) {
	                    throw TpError.shouldNeverHappen();
	                }
	                const writer = createColorStringWriter(format);
	                if (!writer) {
	                    throw TpError.notBindable();
	                }
	                return writer;
	            },
	        },
	        controller: (args) => {
	            const format = detectStringColorFormat(args.initialValue, extractColorType(args.params));
	            if (!format) {
	                throw TpError.shouldNeverHappen();
	            }
	            const stringifier = findColorStringifier(format);
	            if (!stringifier) {
	                throw TpError.shouldNeverHappen();
	            }
	            const expanded = 'expanded' in args.params ? args.params.expanded : undefined;
	            const picker = 'picker' in args.params ? args.params.picker : undefined;
	            return new ColorController(args.document, {
	                colorType: format.type,
	                expanded: expanded !== null && expanded !== void 0 ? expanded : false,
	                formatter: stringifier,
	                parser: createColorStringParser(format.type),
	                pickerLayout: picker !== null && picker !== void 0 ? picker : 'popup',
	                supportsAlpha: format.alpha,
	                value: args.value,
	                viewProps: args.viewProps,
	            });
	        },
	    };

	    class PointNdConstraint {
	        constructor(config) {
	            this.components = config.components;
	            this.asm_ = config.assembly;
	        }
	        constrain(value) {
	            const comps = this.asm_
	                .toComponents(value)
	                .map((comp, index) => { var _a, _b; return (_b = (_a = this.components[index]) === null || _a === void 0 ? void 0 : _a.constrain(comp)) !== null && _b !== void 0 ? _b : comp; });
	            return this.asm_.fromComponents(comps);
	        }
	    }

	    const className$5 = ClassName('pndtxt');
	    class PointNdTextView {
	        constructor(doc, config) {
	            this.textViews = config.textViews;
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$5());
	            this.textViews.forEach((v) => {
	                const axisElem = doc.createElement('div');
	                axisElem.classList.add(className$5('a'));
	                axisElem.appendChild(v.element);
	                this.element.appendChild(axisElem);
	            });
	        }
	    }

	    function createAxisController(doc, config, index) {
	        return new NumberTextController(doc, {
	            arrayPosition: index === 0 ? 'fst' : index === config.axes.length - 1 ? 'lst' : 'mid',
	            baseStep: config.axes[index].baseStep,
	            parser: config.parser,
	            props: config.axes[index].textProps,
	            value: createValue(0, {
	                constraint: config.axes[index].constraint,
	            }),
	            viewProps: config.viewProps,
	        });
	    }
	    class PointNdTextController {
	        constructor(doc, config) {
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.acs_ = config.axes.map((_, index) => createAxisController(doc, config, index));
	            this.acs_.forEach((c, index) => {
	                connectValues({
	                    primary: this.value,
	                    secondary: c.value,
	                    forward: (p) => {
	                        return config.assembly.toComponents(p.rawValue)[index];
	                    },
	                    backward: (p, s) => {
	                        const comps = config.assembly.toComponents(p.rawValue);
	                        comps[index] = s.rawValue;
	                        return config.assembly.fromComponents(comps);
	                    },
	                });
	            });
	            this.view = new PointNdTextView(doc, {
	                textViews: this.acs_.map((ac) => ac.view),
	            });
	        }
	    }

	    function createStepConstraint(params, initialValue) {
	        if ('step' in params && !isEmpty(params.step)) {
	            return new StepConstraint(params.step, initialValue);
	        }
	        return null;
	    }
	    function createRangeConstraint(params) {
	        if (!isEmpty(params.max) && !isEmpty(params.min)) {
	            return new DefiniteRangeConstraint({
	                max: params.max,
	                min: params.min,
	            });
	        }
	        if (!isEmpty(params.max) || !isEmpty(params.min)) {
	            return new RangeConstraint({
	                max: params.max,
	                min: params.min,
	            });
	        }
	        return null;
	    }
	    function findNumberRange(c) {
	        const drc = findConstraint(c, DefiniteRangeConstraint);
	        if (drc) {
	            return [drc.values.get('min'), drc.values.get('max')];
	        }
	        const rc = findConstraint(c, RangeConstraint);
	        if (rc) {
	            return [rc.minValue, rc.maxValue];
	        }
	        return [undefined, undefined];
	    }
	    function createConstraint$4(params,
	    initialValue) {
	        const constraints = [];
	        const sc = createStepConstraint(params, initialValue);
	        if (sc) {
	            constraints.push(sc);
	        }
	        const rc = createRangeConstraint(params);
	        if (rc) {
	            constraints.push(rc);
	        }
	        const lc = createListConstraint(params.options);
	        if (lc) {
	            constraints.push(lc);
	        }
	        return new CompositeConstraint(constraints);
	    }
	    const NumberInputPlugin = {
	        id: 'input-number',
	        type: 'input',
	        accept: (value, params) => {
	            if (typeof value !== 'number') {
	                return null;
	            }
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                format: p.optional.function,
	                max: p.optional.number,
	                min: p.optional.number,
	                options: p.optional.custom(parseListOptions),
	                step: p.optional.number,
	            });
	            return result
	                ? {
	                    initialValue: value,
	                    params: result,
	                }
	                : null;
	        },
	        binding: {
	            reader: (_args) => numberFromUnknown,
	            constraint: (args) => createConstraint$4(args.params, args.initialValue),
	            writer: (_args) => writePrimitive,
	        },
	        controller: (args) => {
	            var _a;
	            const value = args.value;
	            const c = args.constraint;
	            const lc = c && findConstraint(c, ListConstraint);
	            if (lc) {
	                return new ListController(args.document, {
	                    props: new ValueMap({
	                        options: lc.values.value('options'),
	                    }),
	                    value: value,
	                    viewProps: args.viewProps,
	                });
	            }
	            const formatter = (_a = ('format' in args.params ? args.params.format : undefined)) !== null && _a !== void 0 ? _a : createNumberFormatter(getSuitableDecimalDigits(c, value.rawValue));
	            const drc = c && findConstraint(c, DefiniteRangeConstraint);
	            if (drc) {
	                return new SliderTextController(args.document, {
	                    baseStep: getBaseStep(c),
	                    parser: parseNumber,
	                    sliderProps: new ValueMap({
	                        maxValue: drc.values.value('max'),
	                        minValue: drc.values.value('min'),
	                    }),
	                    textProps: ValueMap.fromObject({
	                        draggingScale: getSuitableDraggingScale(c, value.rawValue),
	                        formatter: formatter,
	                    }),
	                    value: value,
	                    viewProps: args.viewProps,
	                });
	            }
	            return new NumberTextController(args.document, {
	                baseStep: getBaseStep(c),
	                parser: parseNumber,
	                props: ValueMap.fromObject({
	                    draggingScale: getSuitableDraggingScale(c, value.rawValue),
	                    formatter: formatter,
	                }),
	                value: value,
	                viewProps: args.viewProps,
	            });
	        },
	    };

	    class Point2d {
	        constructor(x = 0, y = 0) {
	            this.x = x;
	            this.y = y;
	        }
	        getComponents() {
	            return [this.x, this.y];
	        }
	        static isObject(obj) {
	            if (isEmpty(obj)) {
	                return false;
	            }
	            const x = obj.x;
	            const y = obj.y;
	            if (typeof x !== 'number' || typeof y !== 'number') {
	                return false;
	            }
	            return true;
	        }
	        static equals(v1, v2) {
	            return v1.x === v2.x && v1.y === v2.y;
	        }
	        toObject() {
	            return {
	                x: this.x,
	                y: this.y,
	            };
	        }
	    }
	    const Point2dAssembly = {
	        toComponents: (p) => p.getComponents(),
	        fromComponents: (comps) => new Point2d(...comps),
	    };

	    const className$4 = ClassName('p2d');
	    class Point2dView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$4());
	            config.viewProps.bindClassModifiers(this.element);
	            bindValue(config.expanded, valueToClassName(this.element, className$4(undefined, 'expanded')));
	            const headElem = doc.createElement('div');
	            headElem.classList.add(className$4('h'));
	            this.element.appendChild(headElem);
	            const buttonElem = doc.createElement('button');
	            buttonElem.classList.add(className$4('b'));
	            buttonElem.appendChild(createSvgIconElement(doc, 'p2dpad'));
	            config.viewProps.bindDisabled(buttonElem);
	            headElem.appendChild(buttonElem);
	            this.buttonElement = buttonElem;
	            const textElem = doc.createElement('div');
	            textElem.classList.add(className$4('t'));
	            headElem.appendChild(textElem);
	            this.textElement = textElem;
	            if (config.pickerLayout === 'inline') {
	                const pickerElem = doc.createElement('div');
	                pickerElem.classList.add(className$4('p'));
	                this.element.appendChild(pickerElem);
	                this.pickerElement = pickerElem;
	            }
	            else {
	                this.pickerElement = null;
	            }
	        }
	    }

	    const className$3 = ClassName('p2dp');
	    class Point2dPickerView {
	        constructor(doc, config) {
	            this.onFoldableChange_ = this.onFoldableChange_.bind(this);
	            this.onValueChange_ = this.onValueChange_.bind(this);
	            this.invertsY_ = config.invertsY;
	            this.maxValue_ = config.maxValue;
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$3());
	            if (config.layout === 'popup') {
	                this.element.classList.add(className$3(undefined, 'p'));
	            }
	            config.viewProps.bindClassModifiers(this.element);
	            const padElem = doc.createElement('div');
	            padElem.classList.add(className$3('p'));
	            config.viewProps.bindTabIndex(padElem);
	            this.element.appendChild(padElem);
	            this.padElement = padElem;
	            const svgElem = doc.createElementNS(SVG_NS, 'svg');
	            svgElem.classList.add(className$3('g'));
	            this.padElement.appendChild(svgElem);
	            this.svgElem_ = svgElem;
	            const xAxisElem = doc.createElementNS(SVG_NS, 'line');
	            xAxisElem.classList.add(className$3('ax'));
	            xAxisElem.setAttributeNS(null, 'x1', '0');
	            xAxisElem.setAttributeNS(null, 'y1', '50%');
	            xAxisElem.setAttributeNS(null, 'x2', '100%');
	            xAxisElem.setAttributeNS(null, 'y2', '50%');
	            this.svgElem_.appendChild(xAxisElem);
	            const yAxisElem = doc.createElementNS(SVG_NS, 'line');
	            yAxisElem.classList.add(className$3('ax'));
	            yAxisElem.setAttributeNS(null, 'x1', '50%');
	            yAxisElem.setAttributeNS(null, 'y1', '0');
	            yAxisElem.setAttributeNS(null, 'x2', '50%');
	            yAxisElem.setAttributeNS(null, 'y2', '100%');
	            this.svgElem_.appendChild(yAxisElem);
	            const lineElem = doc.createElementNS(SVG_NS, 'line');
	            lineElem.classList.add(className$3('l'));
	            lineElem.setAttributeNS(null, 'x1', '50%');
	            lineElem.setAttributeNS(null, 'y1', '50%');
	            this.svgElem_.appendChild(lineElem);
	            this.lineElem_ = lineElem;
	            const markerElem = doc.createElement('div');
	            markerElem.classList.add(className$3('m'));
	            this.padElement.appendChild(markerElem);
	            this.markerElem_ = markerElem;
	            config.value.emitter.on('change', this.onValueChange_);
	            this.value = config.value;
	            this.update_();
	        }
	        get allFocusableElements() {
	            return [this.padElement];
	        }
	        update_() {
	            const [x, y] = this.value.rawValue.getComponents();
	            const max = this.maxValue_;
	            const px = mapRange(x, -max, +max, 0, 100);
	            const py = mapRange(y, -max, +max, 0, 100);
	            const ipy = this.invertsY_ ? 100 - py : py;
	            this.lineElem_.setAttributeNS(null, 'x2', `${px}%`);
	            this.lineElem_.setAttributeNS(null, 'y2', `${ipy}%`);
	            this.markerElem_.style.left = `${px}%`;
	            this.markerElem_.style.top = `${ipy}%`;
	        }
	        onValueChange_() {
	            this.update_();
	        }
	        onFoldableChange_() {
	            this.update_();
	        }
	    }

	    function computeOffset(ev, baseSteps, invertsY) {
	        return [
	            getStepForKey(baseSteps[0], getHorizontalStepKeys(ev)),
	            getStepForKey(baseSteps[1], getVerticalStepKeys(ev)) * (invertsY ? 1 : -1),
	        ];
	    }
	    class Point2dPickerController {
	        constructor(doc, config) {
	            this.onPadKeyDown_ = this.onPadKeyDown_.bind(this);
	            this.onPadKeyUp_ = this.onPadKeyUp_.bind(this);
	            this.onPointerDown_ = this.onPointerDown_.bind(this);
	            this.onPointerMove_ = this.onPointerMove_.bind(this);
	            this.onPointerUp_ = this.onPointerUp_.bind(this);
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.baseSteps_ = config.baseSteps;
	            this.maxValue_ = config.maxValue;
	            this.invertsY_ = config.invertsY;
	            this.view = new Point2dPickerView(doc, {
	                invertsY: this.invertsY_,
	                layout: config.layout,
	                maxValue: this.maxValue_,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.ptHandler_ = new PointerHandler(this.view.padElement);
	            this.ptHandler_.emitter.on('down', this.onPointerDown_);
	            this.ptHandler_.emitter.on('move', this.onPointerMove_);
	            this.ptHandler_.emitter.on('up', this.onPointerUp_);
	            this.view.padElement.addEventListener('keydown', this.onPadKeyDown_);
	            this.view.padElement.addEventListener('keyup', this.onPadKeyUp_);
	        }
	        handlePointerEvent_(d, opts) {
	            if (!d.point) {
	                return;
	            }
	            const max = this.maxValue_;
	            const px = mapRange(d.point.x, 0, d.bounds.width, -max, +max);
	            const py = mapRange(this.invertsY_ ? d.bounds.height - d.point.y : d.point.y, 0, d.bounds.height, -max, +max);
	            this.value.setRawValue(new Point2d(px, py), opts);
	        }
	        onPointerDown_(ev) {
	            this.handlePointerEvent_(ev.data, {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onPointerMove_(ev) {
	            this.handlePointerEvent_(ev.data, {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onPointerUp_(ev) {
	            this.handlePointerEvent_(ev.data, {
	                forceEmit: true,
	                last: true,
	            });
	        }
	        onPadKeyDown_(ev) {
	            if (isArrowKey(ev.key)) {
	                ev.preventDefault();
	            }
	            const [dx, dy] = computeOffset(ev, this.baseSteps_, this.invertsY_);
	            if (dx === 0 && dy === 0) {
	                return;
	            }
	            this.value.setRawValue(new Point2d(this.value.rawValue.x + dx, this.value.rawValue.y + dy), {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onPadKeyUp_(ev) {
	            const [dx, dy] = computeOffset(ev, this.baseSteps_, this.invertsY_);
	            if (dx === 0 && dy === 0) {
	                return;
	            }
	            this.value.setRawValue(this.value.rawValue, {
	                forceEmit: true,
	                last: true,
	            });
	        }
	    }

	    class Point2dController {
	        constructor(doc, config) {
	            var _a, _b;
	            this.onPopupChildBlur_ = this.onPopupChildBlur_.bind(this);
	            this.onPopupChildKeydown_ = this.onPopupChildKeydown_.bind(this);
	            this.onPadButtonBlur_ = this.onPadButtonBlur_.bind(this);
	            this.onPadButtonClick_ = this.onPadButtonClick_.bind(this);
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.foldable_ = Foldable.create(config.expanded);
	            this.popC_ =
	                config.pickerLayout === 'popup'
	                    ? new PopupController(doc, {
	                        viewProps: this.viewProps,
	                    })
	                    : null;
	            const padC = new Point2dPickerController(doc, {
	                baseSteps: [config.axes[0].baseStep, config.axes[1].baseStep],
	                invertsY: config.invertsY,
	                layout: config.pickerLayout,
	                maxValue: config.maxValue,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            padC.view.allFocusableElements.forEach((elem) => {
	                elem.addEventListener('blur', this.onPopupChildBlur_);
	                elem.addEventListener('keydown', this.onPopupChildKeydown_);
	            });
	            this.pickerC_ = padC;
	            this.textC_ = new PointNdTextController(doc, {
	                assembly: Point2dAssembly,
	                axes: config.axes,
	                parser: config.parser,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.view = new Point2dView(doc, {
	                expanded: this.foldable_.value('expanded'),
	                pickerLayout: config.pickerLayout,
	                viewProps: this.viewProps,
	            });
	            this.view.textElement.appendChild(this.textC_.view.element);
	            (_a = this.view.buttonElement) === null || _a === void 0 ? void 0 : _a.addEventListener('blur', this.onPadButtonBlur_);
	            (_b = this.view.buttonElement) === null || _b === void 0 ? void 0 : _b.addEventListener('click', this.onPadButtonClick_);
	            if (this.popC_) {
	                this.view.element.appendChild(this.popC_.view.element);
	                this.popC_.view.element.appendChild(this.pickerC_.view.element);
	                connectValues({
	                    primary: this.foldable_.value('expanded'),
	                    secondary: this.popC_.shows,
	                    forward: (p) => p.rawValue,
	                    backward: (_, s) => s.rawValue,
	                });
	            }
	            else if (this.view.pickerElement) {
	                this.view.pickerElement.appendChild(this.pickerC_.view.element);
	                bindFoldable(this.foldable_, this.view.pickerElement);
	            }
	        }
	        onPadButtonBlur_(e) {
	            if (!this.popC_) {
	                return;
	            }
	            const elem = this.view.element;
	            const nextTarget = forceCast(e.relatedTarget);
	            if (!nextTarget || !elem.contains(nextTarget)) {
	                this.popC_.shows.rawValue = false;
	            }
	        }
	        onPadButtonClick_() {
	            this.foldable_.set('expanded', !this.foldable_.get('expanded'));
	            if (this.foldable_.get('expanded')) {
	                this.pickerC_.view.allFocusableElements[0].focus();
	            }
	        }
	        onPopupChildBlur_(ev) {
	            if (!this.popC_) {
	                return;
	            }
	            const elem = this.popC_.view.element;
	            const nextTarget = findNextTarget(ev);
	            if (nextTarget && elem.contains(nextTarget)) {
	                return;
	            }
	            if (nextTarget &&
	                nextTarget === this.view.buttonElement &&
	                !supportsTouch(elem.ownerDocument)) {
	                return;
	            }
	            this.popC_.shows.rawValue = false;
	        }
	        onPopupChildKeydown_(ev) {
	            if (this.popC_) {
	                if (ev.key === 'Escape') {
	                    this.popC_.shows.rawValue = false;
	                }
	            }
	            else if (this.view.pickerElement) {
	                if (ev.key === 'Escape') {
	                    this.view.buttonElement.focus();
	                }
	            }
	        }
	    }

	    class Point3d {
	        constructor(x = 0, y = 0, z = 0) {
	            this.x = x;
	            this.y = y;
	            this.z = z;
	        }
	        getComponents() {
	            return [this.x, this.y, this.z];
	        }
	        static isObject(obj) {
	            if (isEmpty(obj)) {
	                return false;
	            }
	            const x = obj.x;
	            const y = obj.y;
	            const z = obj.z;
	            if (typeof x !== 'number' ||
	                typeof y !== 'number' ||
	                typeof z !== 'number') {
	                return false;
	            }
	            return true;
	        }
	        static equals(v1, v2) {
	            return v1.x === v2.x && v1.y === v2.y && v1.z === v2.z;
	        }
	        toObject() {
	            return {
	                x: this.x,
	                y: this.y,
	                z: this.z,
	            };
	        }
	    }
	    const Point3dAssembly = {
	        toComponents: (p) => p.getComponents(),
	        fromComponents: (comps) => new Point3d(...comps),
	    };

	    function point3dFromUnknown(value) {
	        return Point3d.isObject(value)
	            ? new Point3d(value.x, value.y, value.z)
	            : new Point3d();
	    }
	    function writePoint3d(target, value) {
	        target.writeProperty('x', value.x);
	        target.writeProperty('y', value.y);
	        target.writeProperty('z', value.z);
	    }

	    function createConstraint$3(params, initialValue) {
	        return new PointNdConstraint({
	            assembly: Point3dAssembly,
	            components: [
	                createDimensionConstraint('x' in params ? params.x : undefined, initialValue.x),
	                createDimensionConstraint('y' in params ? params.y : undefined, initialValue.y),
	                createDimensionConstraint('z' in params ? params.z : undefined, initialValue.z),
	            ],
	        });
	    }
	    function createAxis$2(initialValue, constraint) {
	        return {
	            baseStep: getBaseStep(constraint),
	            constraint: constraint,
	            textProps: ValueMap.fromObject({
	                draggingScale: getSuitableDraggingScale(constraint, initialValue),
	                formatter: createNumberFormatter(getSuitableDecimalDigits(constraint, initialValue)),
	            }),
	        };
	    }
	    const Point3dInputPlugin = {
	        id: 'input-point3d',
	        type: 'input',
	        accept: (value, params) => {
	            if (!Point3d.isObject(value)) {
	                return null;
	            }
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                x: p.optional.custom(parsePointDimensionParams),
	                y: p.optional.custom(parsePointDimensionParams),
	                z: p.optional.custom(parsePointDimensionParams),
	            });
	            return result
	                ? {
	                    initialValue: value,
	                    params: result,
	                }
	                : null;
	        },
	        binding: {
	            reader: (_args) => point3dFromUnknown,
	            constraint: (args) => createConstraint$3(args.params, args.initialValue),
	            equals: Point3d.equals,
	            writer: (_args) => writePoint3d,
	        },
	        controller: (args) => {
	            const value = args.value;
	            const c = args.constraint;
	            if (!(c instanceof PointNdConstraint)) {
	                throw TpError.shouldNeverHappen();
	            }
	            return new PointNdTextController(args.document, {
	                assembly: Point3dAssembly,
	                axes: [
	                    createAxis$2(value.rawValue.x, c.components[0]),
	                    createAxis$2(value.rawValue.y, c.components[1]),
	                    createAxis$2(value.rawValue.z, c.components[2]),
	                ],
	                parser: parseNumber,
	                value: value,
	                viewProps: args.viewProps,
	            });
	        },
	    };

	    class Point4d {
	        constructor(x = 0, y = 0, z = 0, w = 0) {
	            this.x = x;
	            this.y = y;
	            this.z = z;
	            this.w = w;
	        }
	        getComponents() {
	            return [this.x, this.y, this.z, this.w];
	        }
	        static isObject(obj) {
	            if (isEmpty(obj)) {
	                return false;
	            }
	            const x = obj.x;
	            const y = obj.y;
	            const z = obj.z;
	            const w = obj.w;
	            if (typeof x !== 'number' ||
	                typeof y !== 'number' ||
	                typeof z !== 'number' ||
	                typeof w !== 'number') {
	                return false;
	            }
	            return true;
	        }
	        static equals(v1, v2) {
	            return v1.x === v2.x && v1.y === v2.y && v1.z === v2.z && v1.w === v2.w;
	        }
	        toObject() {
	            return {
	                x: this.x,
	                y: this.y,
	                z: this.z,
	                w: this.w,
	            };
	        }
	    }
	    const Point4dAssembly = {
	        toComponents: (p) => p.getComponents(),
	        fromComponents: (comps) => new Point4d(...comps),
	    };

	    function point4dFromUnknown(value) {
	        return Point4d.isObject(value)
	            ? new Point4d(value.x, value.y, value.z, value.w)
	            : new Point4d();
	    }
	    function writePoint4d(target, value) {
	        target.writeProperty('x', value.x);
	        target.writeProperty('y', value.y);
	        target.writeProperty('z', value.z);
	        target.writeProperty('w', value.w);
	    }

	    function createConstraint$2(params, initialValue) {
	        return new PointNdConstraint({
	            assembly: Point4dAssembly,
	            components: [
	                createDimensionConstraint('x' in params ? params.x : undefined, initialValue.x),
	                createDimensionConstraint('y' in params ? params.y : undefined, initialValue.y),
	                createDimensionConstraint('z' in params ? params.z : undefined, initialValue.z),
	                createDimensionConstraint('w' in params ? params.w : undefined, initialValue.w),
	            ],
	        });
	    }
	    function createAxis$1(initialValue, constraint) {
	        return {
	            baseStep: getBaseStep(constraint),
	            constraint: constraint,
	            textProps: ValueMap.fromObject({
	                draggingScale: getSuitableDraggingScale(constraint, initialValue),
	                formatter: createNumberFormatter(getSuitableDecimalDigits(constraint, initialValue)),
	            }),
	        };
	    }
	    const Point4dInputPlugin = {
	        id: 'input-point4d',
	        type: 'input',
	        accept: (value, params) => {
	            if (!Point4d.isObject(value)) {
	                return null;
	            }
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                x: p.optional.custom(parsePointDimensionParams),
	                y: p.optional.custom(parsePointDimensionParams),
	                z: p.optional.custom(parsePointDimensionParams),
	                w: p.optional.custom(parsePointDimensionParams),
	            });
	            return result
	                ? {
	                    initialValue: value,
	                    params: result,
	                }
	                : null;
	        },
	        binding: {
	            reader: (_args) => point4dFromUnknown,
	            constraint: (args) => createConstraint$2(args.params, args.initialValue),
	            equals: Point4d.equals,
	            writer: (_args) => writePoint4d,
	        },
	        controller: (args) => {
	            const value = args.value;
	            const c = args.constraint;
	            if (!(c instanceof PointNdConstraint)) {
	                throw TpError.shouldNeverHappen();
	            }
	            return new PointNdTextController(args.document, {
	                assembly: Point4dAssembly,
	                axes: value.rawValue
	                    .getComponents()
	                    .map((comp, index) => createAxis$1(comp, c.components[index])),
	                parser: parseNumber,
	                value: value,
	                viewProps: args.viewProps,
	            });
	        },
	    };

	    function createConstraint$1(params) {
	        const constraints = [];
	        const lc = createListConstraint(params.options);
	        if (lc) {
	            constraints.push(lc);
	        }
	        return new CompositeConstraint(constraints);
	    }
	    const StringInputPlugin = {
	        id: 'input-string',
	        type: 'input',
	        accept: (value, params) => {
	            if (typeof value !== 'string') {
	                return null;
	            }
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                options: p.optional.custom(parseListOptions),
	            });
	            return result
	                ? {
	                    initialValue: value,
	                    params: result,
	                }
	                : null;
	        },
	        binding: {
	            reader: (_args) => stringFromUnknown,
	            constraint: (args) => createConstraint$1(args.params),
	            writer: (_args) => writePrimitive,
	        },
	        controller: (args) => {
	            const doc = args.document;
	            const value = args.value;
	            const c = args.constraint;
	            const lc = c && findConstraint(c, ListConstraint);
	            if (lc) {
	                return new ListController(doc, {
	                    props: new ValueMap({
	                        options: lc.values.value('options'),
	                    }),
	                    value: value,
	                    viewProps: args.viewProps,
	                });
	            }
	            return new TextController(doc, {
	                parser: (v) => v,
	                props: ValueMap.fromObject({
	                    formatter: formatString,
	                }),
	                value: value,
	                viewProps: args.viewProps,
	            });
	        },
	    };

	    const Constants = {
	        monitor: {
	            defaultInterval: 200,
	            defaultLineCount: 3,
	        },
	    };

	    const className$2 = ClassName('mll');
	    class MultiLogView {
	        constructor(doc, config) {
	            this.onValueUpdate_ = this.onValueUpdate_.bind(this);
	            this.formatter_ = config.formatter;
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$2());
	            config.viewProps.bindClassModifiers(this.element);
	            const textareaElem = doc.createElement('textarea');
	            textareaElem.classList.add(className$2('i'));
	            textareaElem.style.height = `calc(var(--bld-us) * ${config.lineCount})`;
	            textareaElem.readOnly = true;
	            config.viewProps.bindDisabled(textareaElem);
	            this.element.appendChild(textareaElem);
	            this.textareaElem_ = textareaElem;
	            config.value.emitter.on('change', this.onValueUpdate_);
	            this.value = config.value;
	            this.update_();
	        }
	        update_() {
	            const elem = this.textareaElem_;
	            const shouldScroll = elem.scrollTop === elem.scrollHeight - elem.clientHeight;
	            const lines = [];
	            this.value.rawValue.forEach((value) => {
	                if (value !== undefined) {
	                    lines.push(this.formatter_(value));
	                }
	            });
	            elem.textContent = lines.join('\n');
	            if (shouldScroll) {
	                elem.scrollTop = elem.scrollHeight;
	            }
	        }
	        onValueUpdate_() {
	            this.update_();
	        }
	    }

	    class MultiLogController {
	        constructor(doc, config) {
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.view = new MultiLogView(doc, {
	                formatter: config.formatter,
	                lineCount: config.lineCount,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	        }
	    }

	    const className$1 = ClassName('sgl');
	    class SingleLogView {
	        constructor(doc, config) {
	            this.onValueUpdate_ = this.onValueUpdate_.bind(this);
	            this.formatter_ = config.formatter;
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$1());
	            config.viewProps.bindClassModifiers(this.element);
	            const inputElem = doc.createElement('input');
	            inputElem.classList.add(className$1('i'));
	            inputElem.readOnly = true;
	            inputElem.type = 'text';
	            config.viewProps.bindDisabled(inputElem);
	            this.element.appendChild(inputElem);
	            this.inputElement = inputElem;
	            config.value.emitter.on('change', this.onValueUpdate_);
	            this.value = config.value;
	            this.update_();
	        }
	        update_() {
	            const values = this.value.rawValue;
	            const lastValue = values[values.length - 1];
	            this.inputElement.value =
	                lastValue !== undefined ? this.formatter_(lastValue) : '';
	        }
	        onValueUpdate_() {
	            this.update_();
	        }
	    }

	    class SingleLogController {
	        constructor(doc, config) {
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.view = new SingleLogView(doc, {
	                formatter: config.formatter,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	        }
	    }

	    const BooleanMonitorPlugin = {
	        id: 'monitor-bool',
	        type: 'monitor',
	        accept: (value, params) => {
	            if (typeof value !== 'boolean') {
	                return null;
	            }
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                lineCount: p.optional.number,
	            });
	            return result
	                ? {
	                    initialValue: value,
	                    params: result,
	                }
	                : null;
	        },
	        binding: {
	            reader: (_args) => boolFromUnknown,
	        },
	        controller: (args) => {
	            var _a;
	            if (args.value.rawValue.length === 1) {
	                return new SingleLogController(args.document, {
	                    formatter: BooleanFormatter,
	                    value: args.value,
	                    viewProps: args.viewProps,
	                });
	            }
	            return new MultiLogController(args.document, {
	                formatter: BooleanFormatter,
	                lineCount: (_a = args.params.lineCount) !== null && _a !== void 0 ? _a : Constants.monitor.defaultLineCount,
	                value: args.value,
	                viewProps: args.viewProps,
	            });
	        },
	    };

	    const className = ClassName('grl');
	    class GraphLogView {
	        constructor(doc, config) {
	            this.onCursorChange_ = this.onCursorChange_.bind(this);
	            this.onValueUpdate_ = this.onValueUpdate_.bind(this);
	            this.element = doc.createElement('div');
	            this.element.classList.add(className());
	            config.viewProps.bindClassModifiers(this.element);
	            this.formatter_ = config.formatter;
	            this.props_ = config.props;
	            this.cursor_ = config.cursor;
	            this.cursor_.emitter.on('change', this.onCursorChange_);
	            const svgElem = doc.createElementNS(SVG_NS, 'svg');
	            svgElem.classList.add(className('g'));
	            svgElem.style.height = `calc(var(--bld-us) * ${config.lineCount})`;
	            this.element.appendChild(svgElem);
	            this.svgElem_ = svgElem;
	            const lineElem = doc.createElementNS(SVG_NS, 'polyline');
	            this.svgElem_.appendChild(lineElem);
	            this.lineElem_ = lineElem;
	            const tooltipElem = doc.createElement('div');
	            tooltipElem.classList.add(className('t'), ClassName('tt')());
	            this.element.appendChild(tooltipElem);
	            this.tooltipElem_ = tooltipElem;
	            config.value.emitter.on('change', this.onValueUpdate_);
	            this.value = config.value;
	            this.update_();
	        }
	        get graphElement() {
	            return this.svgElem_;
	        }
	        update_() {
	            const bounds = this.svgElem_.getBoundingClientRect();
	            const maxIndex = this.value.rawValue.length - 1;
	            const min = this.props_.get('minValue');
	            const max = this.props_.get('maxValue');
	            const points = [];
	            this.value.rawValue.forEach((v, index) => {
	                if (v === undefined) {
	                    return;
	                }
	                const x = mapRange(index, 0, maxIndex, 0, bounds.width);
	                const y = mapRange(v, min, max, bounds.height, 0);
	                points.push([x, y].join(','));
	            });
	            this.lineElem_.setAttributeNS(null, 'points', points.join(' '));
	            const tooltipElem = this.tooltipElem_;
	            const value = this.value.rawValue[this.cursor_.rawValue];
	            if (value === undefined) {
	                tooltipElem.classList.remove(className('t', 'a'));
	                return;
	            }
	            const tx = mapRange(this.cursor_.rawValue, 0, maxIndex, 0, bounds.width);
	            const ty = mapRange(value, min, max, bounds.height, 0);
	            tooltipElem.style.left = `${tx}px`;
	            tooltipElem.style.top = `${ty}px`;
	            tooltipElem.textContent = `${this.formatter_(value)}`;
	            if (!tooltipElem.classList.contains(className('t', 'a'))) {
	                tooltipElem.classList.add(className('t', 'a'), className('t', 'in'));
	                forceReflow(tooltipElem);
	                tooltipElem.classList.remove(className('t', 'in'));
	            }
	        }
	        onValueUpdate_() {
	            this.update_();
	        }
	        onCursorChange_() {
	            this.update_();
	        }
	    }

	    class GraphLogController {
	        constructor(doc, config) {
	            this.onGraphMouseMove_ = this.onGraphMouseMove_.bind(this);
	            this.onGraphMouseLeave_ = this.onGraphMouseLeave_.bind(this);
	            this.onGraphPointerDown_ = this.onGraphPointerDown_.bind(this);
	            this.onGraphPointerMove_ = this.onGraphPointerMove_.bind(this);
	            this.onGraphPointerUp_ = this.onGraphPointerUp_.bind(this);
	            this.props_ = config.props;
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.cursor_ = createValue(-1);
	            this.view = new GraphLogView(doc, {
	                cursor: this.cursor_,
	                formatter: config.formatter,
	                lineCount: config.lineCount,
	                props: this.props_,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            if (!supportsTouch(doc)) {
	                this.view.element.addEventListener('mousemove', this.onGraphMouseMove_);
	                this.view.element.addEventListener('mouseleave', this.onGraphMouseLeave_);
	            }
	            else {
	                const ph = new PointerHandler(this.view.element);
	                ph.emitter.on('down', this.onGraphPointerDown_);
	                ph.emitter.on('move', this.onGraphPointerMove_);
	                ph.emitter.on('up', this.onGraphPointerUp_);
	            }
	        }
	        onGraphMouseLeave_() {
	            this.cursor_.rawValue = -1;
	        }
	        onGraphMouseMove_(ev) {
	            const bounds = this.view.element.getBoundingClientRect();
	            this.cursor_.rawValue = Math.floor(mapRange(ev.offsetX, 0, bounds.width, 0, this.value.rawValue.length));
	        }
	        onGraphPointerDown_(ev) {
	            this.onGraphPointerMove_(ev);
	        }
	        onGraphPointerMove_(ev) {
	            if (!ev.data.point) {
	                this.cursor_.rawValue = -1;
	                return;
	            }
	            this.cursor_.rawValue = Math.floor(mapRange(ev.data.point.x, 0, ev.data.bounds.width, 0, this.value.rawValue.length));
	        }
	        onGraphPointerUp_() {
	            this.cursor_.rawValue = -1;
	        }
	    }

	    function createFormatter(params) {
	        return 'format' in params && !isEmpty(params.format)
	            ? params.format
	            : createNumberFormatter(2);
	    }
	    function createTextMonitor(args) {
	        var _a;
	        if (args.value.rawValue.length === 1) {
	            return new SingleLogController(args.document, {
	                formatter: createFormatter(args.params),
	                value: args.value,
	                viewProps: args.viewProps,
	            });
	        }
	        return new MultiLogController(args.document, {
	            formatter: createFormatter(args.params),
	            lineCount: (_a = args.params.lineCount) !== null && _a !== void 0 ? _a : Constants.monitor.defaultLineCount,
	            value: args.value,
	            viewProps: args.viewProps,
	        });
	    }
	    function createGraphMonitor(args) {
	        var _a, _b, _c;
	        return new GraphLogController(args.document, {
	            formatter: createFormatter(args.params),
	            lineCount: (_a = args.params.lineCount) !== null && _a !== void 0 ? _a : Constants.monitor.defaultLineCount,
	            props: ValueMap.fromObject({
	                maxValue: (_b = ('max' in args.params ? args.params.max : null)) !== null && _b !== void 0 ? _b : 100,
	                minValue: (_c = ('min' in args.params ? args.params.min : null)) !== null && _c !== void 0 ? _c : 0,
	            }),
	            value: args.value,
	            viewProps: args.viewProps,
	        });
	    }
	    function shouldShowGraph(params) {
	        return 'view' in params && params.view === 'graph';
	    }
	    const NumberMonitorPlugin = {
	        id: 'monitor-number',
	        type: 'monitor',
	        accept: (value, params) => {
	            if (typeof value !== 'number') {
	                return null;
	            }
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                format: p.optional.function,
	                lineCount: p.optional.number,
	                max: p.optional.number,
	                min: p.optional.number,
	                view: p.optional.string,
	            });
	            return result
	                ? {
	                    initialValue: value,
	                    params: result,
	                }
	                : null;
	        },
	        binding: {
	            defaultBufferSize: (params) => (shouldShowGraph(params) ? 64 : 1),
	            reader: (_args) => numberFromUnknown,
	        },
	        controller: (args) => {
	            if (shouldShowGraph(args.params)) {
	                return createGraphMonitor(args);
	            }
	            return createTextMonitor(args);
	        },
	    };

	    const StringMonitorPlugin = {
	        id: 'monitor-string',
	        type: 'monitor',
	        accept: (value, params) => {
	            if (typeof value !== 'string') {
	                return null;
	            }
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                lineCount: p.optional.number,
	                multiline: p.optional.boolean,
	            });
	            return result
	                ? {
	                    initialValue: value,
	                    params: result,
	                }
	                : null;
	        },
	        binding: {
	            reader: (_args) => stringFromUnknown,
	        },
	        controller: (args) => {
	            var _a;
	            const value = args.value;
	            const multiline = value.rawValue.length > 1 ||
	                ('multiline' in args.params && args.params.multiline);
	            if (multiline) {
	                return new MultiLogController(args.document, {
	                    formatter: formatString,
	                    lineCount: (_a = args.params.lineCount) !== null && _a !== void 0 ? _a : Constants.monitor.defaultLineCount,
	                    value: value,
	                    viewProps: args.viewProps,
	                });
	            }
	            return new SingleLogController(args.document, {
	                formatter: formatString,
	                value: value,
	                viewProps: args.viewProps,
	            });
	        },
	    };

	    function createInputBindingController(plugin, args) {
	        const result = plugin.accept(args.target.read(), args.params);
	        if (isEmpty(result)) {
	            return null;
	        }
	        const p = ParamsParsers;
	        const valueArgs = {
	            target: args.target,
	            initialValue: result.initialValue,
	            params: result.params,
	        };
	        const reader = plugin.binding.reader(valueArgs);
	        const constraint = plugin.binding.constraint
	            ? plugin.binding.constraint(valueArgs)
	            : undefined;
	        const value = createValue(reader(result.initialValue), {
	            constraint: constraint,
	            equals: plugin.binding.equals,
	        });
	        const binding = new InputBinding({
	            reader: reader,
	            target: args.target,
	            value: value,
	            writer: plugin.binding.writer(valueArgs),
	        });
	        const disabled = p.optional.boolean(args.params.disabled).value;
	        const hidden = p.optional.boolean(args.params.hidden).value;
	        const controller = plugin.controller({
	            constraint: constraint,
	            document: args.document,
	            initialValue: result.initialValue,
	            params: result.params,
	            value: binding.value,
	            viewProps: ViewProps.create({
	                disabled: disabled,
	                hidden: hidden,
	            }),
	        });
	        const label = p.optional.string(args.params.label).value;
	        return new InputBindingController(args.document, {
	            binding: binding,
	            blade: createBlade(),
	            props: ValueMap.fromObject({
	                label: label !== null && label !== void 0 ? label : args.target.key,
	            }),
	            valueController: controller,
	        });
	    }

	    function createTicker(document, interval) {
	        return interval === 0
	            ? new ManualTicker()
	            : new IntervalTicker(document, interval !== null && interval !== void 0 ? interval : Constants.monitor.defaultInterval);
	    }
	    function createMonitorBindingController(plugin, args) {
	        var _a, _b, _c;
	        const P = ParamsParsers;
	        const result = plugin.accept(args.target.read(), args.params);
	        if (isEmpty(result)) {
	            return null;
	        }
	        const bindingArgs = {
	            target: args.target,
	            initialValue: result.initialValue,
	            params: result.params,
	        };
	        const reader = plugin.binding.reader(bindingArgs);
	        const bufferSize = (_b = (_a = P.optional.number(args.params.bufferSize).value) !== null && _a !== void 0 ? _a : (plugin.binding.defaultBufferSize &&
	            plugin.binding.defaultBufferSize(result.params))) !== null && _b !== void 0 ? _b : 1;
	        const interval = P.optional.number(args.params.interval).value;
	        const binding = new MonitorBinding({
	            reader: reader,
	            target: args.target,
	            ticker: createTicker(args.document, interval),
	            value: initializeBuffer(bufferSize),
	        });
	        const disabled = P.optional.boolean(args.params.disabled).value;
	        const hidden = P.optional.boolean(args.params.hidden).value;
	        const controller = plugin.controller({
	            document: args.document,
	            params: result.params,
	            value: binding.value,
	            viewProps: ViewProps.create({
	                disabled: disabled,
	                hidden: hidden,
	            }),
	        });
	        const label = (_c = P.optional.string(args.params.label).value) !== null && _c !== void 0 ? _c : args.target.key;
	        return new MonitorBindingController(args.document, {
	            binding: binding,
	            blade: createBlade(),
	            props: ValueMap.fromObject({
	                label: label,
	            }),
	            valueController: controller,
	        });
	    }

	    class PluginPool {
	        constructor() {
	            this.pluginsMap_ = {
	                blades: [],
	                inputs: [],
	                monitors: [],
	            };
	        }
	        getAll() {
	            return [
	                ...this.pluginsMap_.blades,
	                ...this.pluginsMap_.inputs,
	                ...this.pluginsMap_.monitors,
	            ];
	        }
	        register(r) {
	            if (r.type === 'blade') {
	                this.pluginsMap_.blades.unshift(r);
	            }
	            else if (r.type === 'input') {
	                this.pluginsMap_.inputs.unshift(r);
	            }
	            else if (r.type === 'monitor') {
	                this.pluginsMap_.monitors.unshift(r);
	            }
	        }
	        createInput(document, target, params) {
	            const initialValue = target.read();
	            if (isEmpty(initialValue)) {
	                throw new TpError({
	                    context: {
	                        key: target.key,
	                    },
	                    type: 'nomatchingcontroller',
	                });
	            }
	            const bc = this.pluginsMap_.inputs.reduce((result, plugin) => result !== null && result !== void 0 ? result : createInputBindingController(plugin, {
	                document: document,
	                target: target,
	                params: params,
	            }), null);
	            if (bc) {
	                return bc;
	            }
	            throw new TpError({
	                context: {
	                    key: target.key,
	                },
	                type: 'nomatchingcontroller',
	            });
	        }
	        createMonitor(document, target, params) {
	            const bc = this.pluginsMap_.monitors.reduce((result, plugin) => result !== null && result !== void 0 ? result : createMonitorBindingController(plugin, {
	                document: document,
	                params: params,
	                target: target,
	            }), null);
	            if (bc) {
	                return bc;
	            }
	            throw new TpError({
	                context: {
	                    key: target.key,
	                },
	                type: 'nomatchingcontroller',
	            });
	        }
	        createBlade(document, params) {
	            const bc = this.pluginsMap_.blades.reduce((result, plugin) => result !== null && result !== void 0 ? result : createBladeController(plugin, {
	                document: document,
	                params: params,
	            }), null);
	            if (!bc) {
	                throw new TpError({
	                    type: 'nomatchingview',
	                    context: {
	                        params: params,
	                    },
	                });
	            }
	            return bc;
	        }
	        createBladeApi(bc) {
	            if (bc instanceof InputBindingController) {
	                return new InputBindingApi(bc);
	            }
	            if (bc instanceof MonitorBindingController) {
	                return new MonitorBindingApi(bc);
	            }
	            if (bc instanceof RackController) {
	                return new RackApi(bc, this);
	            }
	            const api = this.pluginsMap_.blades.reduce((result, plugin) => result !== null && result !== void 0 ? result : plugin.api({
	                controller: bc,
	                pool: this,
	            }), null);
	            if (!api) {
	                throw TpError.shouldNeverHappen();
	            }
	            return api;
	        }
	    }

	    function createDefaultPluginPool() {
	        const pool = new PluginPool();
	        [
	            Point2dInputPlugin,
	            Point3dInputPlugin,
	            Point4dInputPlugin,
	            StringInputPlugin,
	            NumberInputPlugin,
	            StringColorInputPlugin,
	            ObjectColorInputPlugin,
	            NumberColorInputPlugin,
	            BooleanInputPlugin,
	            BooleanMonitorPlugin,
	            StringMonitorPlugin,
	            NumberMonitorPlugin,
	            ButtonBladePlugin,
	            FolderBladePlugin,
	            SeparatorBladePlugin,
	            TabBladePlugin,
	        ].forEach((p) => {
	            pool.register(p);
	        });
	        return pool;
	    }

	    function point2dFromUnknown(value) {
	        return Point2d.isObject(value)
	            ? new Point2d(value.x, value.y)
	            : new Point2d();
	    }
	    function writePoint2d(target, value) {
	        target.writeProperty('x', value.x);
	        target.writeProperty('y', value.y);
	    }

	    function createDimensionConstraint(params, initialValue) {
	        if (!params) {
	            return undefined;
	        }
	        const constraints = [];
	        const cs = createStepConstraint(params, initialValue);
	        if (cs) {
	            constraints.push(cs);
	        }
	        const rs = createRangeConstraint(params);
	        if (rs) {
	            constraints.push(rs);
	        }
	        return new CompositeConstraint(constraints);
	    }
	    function createConstraint(params, initialValue) {
	        return new PointNdConstraint({
	            assembly: Point2dAssembly,
	            components: [
	                createDimensionConstraint('x' in params ? params.x : undefined, initialValue.x),
	                createDimensionConstraint('y' in params ? params.y : undefined, initialValue.y),
	            ],
	        });
	    }
	    function getSuitableMaxDimensionValue(constraint, rawValue) {
	        const [min, max] = constraint ? findNumberRange(constraint) : [];
	        if (!isEmpty(min) || !isEmpty(max)) {
	            return Math.max(Math.abs(min !== null && min !== void 0 ? min : 0), Math.abs(max !== null && max !== void 0 ? max : 0));
	        }
	        const step = getBaseStep(constraint);
	        return Math.max(Math.abs(step) * 10, Math.abs(rawValue) * 10);
	    }
	    function getSuitableMaxValue(initialValue, constraint) {
	        const xc = constraint instanceof PointNdConstraint
	            ? constraint.components[0]
	            : undefined;
	        const yc = constraint instanceof PointNdConstraint
	            ? constraint.components[1]
	            : undefined;
	        const xr = getSuitableMaxDimensionValue(xc, initialValue.x);
	        const yr = getSuitableMaxDimensionValue(yc, initialValue.y);
	        return Math.max(xr, yr);
	    }
	    function createAxis(initialValue, constraint) {
	        return {
	            baseStep: getBaseStep(constraint),
	            constraint: constraint,
	            textProps: ValueMap.fromObject({
	                draggingScale: getSuitableDraggingScale(constraint, initialValue),
	                formatter: createNumberFormatter(getSuitableDecimalDigits(constraint, initialValue)),
	            }),
	        };
	    }
	    function shouldInvertY(params) {
	        if (!('y' in params)) {
	            return false;
	        }
	        const yParams = params.y;
	        if (!yParams) {
	            return false;
	        }
	        return 'inverted' in yParams ? !!yParams.inverted : false;
	    }
	    const Point2dInputPlugin = {
	        id: 'input-point2d',
	        type: 'input',
	        accept: (value, params) => {
	            if (!Point2d.isObject(value)) {
	                return null;
	            }
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                expanded: p.optional.boolean,
	                picker: p.optional.custom(parsePickerLayout),
	                x: p.optional.custom(parsePointDimensionParams),
	                y: p.optional.object({
	                    inverted: p.optional.boolean,
	                    max: p.optional.number,
	                    min: p.optional.number,
	                    step: p.optional.number,
	                }),
	            });
	            return result
	                ? {
	                    initialValue: value,
	                    params: result,
	                }
	                : null;
	        },
	        binding: {
	            reader: (_args) => point2dFromUnknown,
	            constraint: (args) => createConstraint(args.params, args.initialValue),
	            equals: Point2d.equals,
	            writer: (_args) => writePoint2d,
	        },
	        controller: (args) => {
	            const doc = args.document;
	            const value = args.value;
	            const c = args.constraint;
	            if (!(c instanceof PointNdConstraint)) {
	                throw TpError.shouldNeverHappen();
	            }
	            const expanded = 'expanded' in args.params ? args.params.expanded : undefined;
	            const picker = 'picker' in args.params ? args.params.picker : undefined;
	            return new Point2dController(doc, {
	                axes: [
	                    createAxis(value.rawValue.x, c.components[0]),
	                    createAxis(value.rawValue.y, c.components[1]),
	                ],
	                expanded: expanded !== null && expanded !== void 0 ? expanded : false,
	                invertsY: shouldInvertY(args.params),
	                maxValue: getSuitableMaxValue(value.rawValue, c),
	                parser: parseNumber,
	                pickerLayout: picker !== null && picker !== void 0 ? picker : 'popup',
	                value: value,
	                viewProps: args.viewProps,
	            });
	        },
	    };

	    class ListApi extends BladeApi {
	        constructor(controller) {
	            super(controller);
	            this.emitter_ = new Emitter();
	            this.controller_.valueController.value.emitter.on('change', (ev) => {
	                this.emitter_.emit('change', {
	                    event: new TpChangeEvent(this, ev.rawValue),
	                });
	            });
	        }
	        get label() {
	            return this.controller_.props.get('label');
	        }
	        set label(label) {
	            this.controller_.props.set('label', label);
	        }
	        get options() {
	            return this.controller_.valueController.props.get('options');
	        }
	        set options(options) {
	            this.controller_.valueController.props.set('options', options);
	        }
	        get value() {
	            return this.controller_.valueController.value.rawValue;
	        }
	        set value(value) {
	            this.controller_.valueController.value.rawValue = value;
	        }
	        on(eventName, handler) {
	            const bh = handler.bind(this);
	            this.emitter_.on(eventName, (ev) => {
	                bh(ev.event);
	            });
	            return this;
	        }
	    }

	    class SliderApi extends BladeApi {
	        constructor(controller) {
	            super(controller);
	            this.emitter_ = new Emitter();
	            this.controller_.valueController.value.emitter.on('change', (ev) => {
	                this.emitter_.emit('change', {
	                    event: new TpChangeEvent(this, ev.rawValue),
	                });
	            });
	        }
	        get label() {
	            return this.controller_.props.get('label');
	        }
	        set label(label) {
	            this.controller_.props.set('label', label);
	        }
	        get maxValue() {
	            return this.controller_.valueController.sliderController.props.get('maxValue');
	        }
	        set maxValue(maxValue) {
	            this.controller_.valueController.sliderController.props.set('maxValue', maxValue);
	        }
	        get minValue() {
	            return this.controller_.valueController.sliderController.props.get('minValue');
	        }
	        set minValue(minValue) {
	            this.controller_.valueController.sliderController.props.set('minValue', minValue);
	        }
	        get value() {
	            return this.controller_.valueController.value.rawValue;
	        }
	        set value(value) {
	            this.controller_.valueController.value.rawValue = value;
	        }
	        on(eventName, handler) {
	            const bh = handler.bind(this);
	            this.emitter_.on(eventName, (ev) => {
	                bh(ev.event);
	            });
	            return this;
	        }
	    }

	    class TextApi extends BladeApi {
	        constructor(controller) {
	            super(controller);
	            this.emitter_ = new Emitter();
	            this.controller_.valueController.value.emitter.on('change', (ev) => {
	                this.emitter_.emit('change', {
	                    event: new TpChangeEvent(this, ev.rawValue),
	                });
	            });
	        }
	        get label() {
	            return this.controller_.props.get('label');
	        }
	        set label(label) {
	            this.controller_.props.set('label', label);
	        }
	        get formatter() {
	            return this.controller_.valueController.props.get('formatter');
	        }
	        set formatter(formatter) {
	            this.controller_.valueController.props.set('formatter', formatter);
	        }
	        get value() {
	            return this.controller_.valueController.value.rawValue;
	        }
	        set value(value) {
	            this.controller_.valueController.value.rawValue = value;
	        }
	        on(eventName, handler) {
	            const bh = handler.bind(this);
	            this.emitter_.on(eventName, (ev) => {
	                bh(ev.event);
	            });
	            return this;
	        }
	    }

	    const ListBladePlugin = (function () {
	        return {
	            id: 'list',
	            type: 'blade',
	            accept(params) {
	                const p = ParamsParsers;
	                const result = parseParams(params, {
	                    options: p.required.custom(parseListOptions),
	                    value: p.required.raw,
	                    view: p.required.constant('list'),
	                    label: p.optional.string,
	                });
	                return result ? { params: result } : null;
	            },
	            controller(args) {
	                const lc = new ListConstraint(normalizeListOptions(args.params.options));
	                const value = createValue(args.params.value, {
	                    constraint: lc,
	                });
	                const ic = new ListController(args.document, {
	                    props: new ValueMap({
	                        options: lc.values.value('options'),
	                    }),
	                    value: value,
	                    viewProps: args.viewProps,
	                });
	                return new LabeledValueController(args.document, {
	                    blade: args.blade,
	                    props: ValueMap.fromObject({
	                        label: args.params.label,
	                    }),
	                    valueController: ic,
	                });
	            },
	            api(args) {
	                if (!(args.controller instanceof LabeledValueController)) {
	                    return null;
	                }
	                if (!(args.controller.valueController instanceof ListController)) {
	                    return null;
	                }
	                return new ListApi(args.controller);
	            },
	        };
	    })();

	    /**
	     * @hidden
	     */
	    function exportPresetJson(targets) {
	        return targets.reduce((result, target) => {
	            return Object.assign(result, {
	                [target.presetKey]: target.read(),
	            });
	        }, {});
	    }
	    /**
	     * @hidden
	     */
	    function importPresetJson(bindings, preset) {
	        bindings.forEach((binding) => {
	            const value = preset[binding.target.presetKey];
	            if (value !== undefined) {
	                binding.writer(binding.target, value);
	            }
	        });
	    }

	    class RootApi extends FolderApi {
	        /**
	         * @hidden
	         */
	        constructor(controller, pool) {
	            super(controller, pool);
	        }
	        get element() {
	            return this.controller_.view.element;
	        }
	        /**
	         * Imports a preset of all inputs.
	         * @param preset The preset object to import.
	         */
	        importPreset(preset) {
	            const bindings = this.controller_.rackController.rack
	                .find(InputBindingController)
	                .map((ibc) => {
	                return ibc.binding;
	            });
	            importPresetJson(bindings, preset);
	            this.refresh();
	        }
	        /**
	         * Exports a preset of all inputs.
	         * @return An exported preset object.
	         */
	        exportPreset() {
	            const targets = this.controller_.rackController.rack
	                .find(InputBindingController)
	                .map((ibc) => {
	                return ibc.binding.target;
	            });
	            return exportPresetJson(targets);
	        }
	        /**
	         * Refreshes all bindings of the pane.
	         */
	        refresh() {
	            // Force-read all input bindings
	            this.controller_.rackController.rack
	                .find(InputBindingController)
	                .forEach((ibc) => {
	                ibc.binding.read();
	            });
	            // Force-read all monitor bindings
	            this.controller_.rackController.rack
	                .find(MonitorBindingController)
	                .forEach((mbc) => {
	                mbc.binding.read();
	            });
	        }
	    }

	    class RootController extends FolderController {
	        constructor(doc, config) {
	            super(doc, {
	                expanded: config.expanded,
	                blade: config.blade,
	                props: config.props,
	                root: true,
	                viewProps: config.viewProps,
	            });
	        }
	    }

	    const SliderBladePlugin = {
	        id: 'slider',
	        type: 'blade',
	        accept(params) {
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                max: p.required.number,
	                min: p.required.number,
	                view: p.required.constant('slider'),
	                format: p.optional.function,
	                label: p.optional.string,
	                value: p.optional.number,
	            });
	            return result ? { params: result } : null;
	        },
	        controller(args) {
	            var _a, _b;
	            const initialValue = (_a = args.params.value) !== null && _a !== void 0 ? _a : 0;
	            const drc = new DefiniteRangeConstraint({
	                max: args.params.max,
	                min: args.params.min,
	            });
	            const vc = new SliderTextController(args.document, {
	                baseStep: 1,
	                parser: parseNumber,
	                sliderProps: new ValueMap({
	                    maxValue: drc.values.value('max'),
	                    minValue: drc.values.value('min'),
	                }),
	                textProps: ValueMap.fromObject({
	                    draggingScale: getSuitableDraggingScale(undefined, initialValue),
	                    formatter: (_b = args.params.format) !== null && _b !== void 0 ? _b : numberToString,
	                }),
	                value: createValue(initialValue, {
	                    constraint: drc,
	                }),
	                viewProps: args.viewProps,
	            });
	            return new LabeledValueController(args.document, {
	                blade: args.blade,
	                props: ValueMap.fromObject({
	                    label: args.params.label,
	                }),
	                valueController: vc,
	            });
	        },
	        api(args) {
	            if (!(args.controller instanceof LabeledValueController)) {
	                return null;
	            }
	            if (!(args.controller.valueController instanceof SliderTextController)) {
	                return null;
	            }
	            return new SliderApi(args.controller);
	        },
	    };

	    const TextBladePlugin = (function () {
	        return {
	            id: 'text',
	            type: 'blade',
	            accept(params) {
	                const p = ParamsParsers;
	                const result = parseParams(params, {
	                    parse: p.required.function,
	                    value: p.required.raw,
	                    view: p.required.constant('text'),
	                    format: p.optional.function,
	                    label: p.optional.string,
	                });
	                return result ? { params: result } : null;
	            },
	            controller(args) {
	                var _a;
	                const ic = new TextController(args.document, {
	                    parser: args.params.parse,
	                    props: ValueMap.fromObject({
	                        formatter: (_a = args.params.format) !== null && _a !== void 0 ? _a : ((v) => String(v)),
	                    }),
	                    value: createValue(args.params.value),
	                    viewProps: args.viewProps,
	                });
	                return new LabeledValueController(args.document, {
	                    blade: args.blade,
	                    props: ValueMap.fromObject({
	                        label: args.params.label,
	                    }),
	                    valueController: ic,
	                });
	            },
	            api(args) {
	                if (!(args.controller instanceof LabeledValueController)) {
	                    return null;
	                }
	                if (!(args.controller.valueController instanceof TextController)) {
	                    return null;
	                }
	                return new TextApi(args.controller);
	            },
	        };
	    })();

	    function createDefaultWrapperElement(doc) {
	        const elem = doc.createElement('div');
	        elem.classList.add(ClassName('dfw')());
	        if (doc.body) {
	            doc.body.appendChild(elem);
	        }
	        return elem;
	    }
	    function embedStyle(doc, id, css) {
	        if (doc.querySelector(`style[data-tp-style=${id}]`)) {
	            return;
	        }
	        const styleElem = doc.createElement('style');
	        styleElem.dataset.tpStyle = id;
	        styleElem.textContent = css;
	        doc.head.appendChild(styleElem);
	    }
	    /**
	     * The root pane of Tweakpane.
	     */
	    class Pane extends RootApi {
	        constructor(opt_config) {
	            var _a, _b;
	            const config = opt_config !== null && opt_config !== void 0 ? opt_config : {};
	            const doc = (_a = config.document) !== null && _a !== void 0 ? _a : getWindowDocument();
	            const pool = createDefaultPluginPool();
	            const rootController = new RootController(doc, {
	                expanded: config.expanded,
	                blade: createBlade(),
	                props: ValueMap.fromObject({
	                    title: config.title,
	                }),
	                viewProps: ViewProps.create(),
	            });
	            super(rootController, pool);
	            this.pool_ = pool;
	            this.containerElem_ = (_b = config.container) !== null && _b !== void 0 ? _b : createDefaultWrapperElement(doc);
	            this.containerElem_.appendChild(this.element);
	            this.doc_ = doc;
	            this.usesDefaultWrapper_ = !config.container;
	            this.setUpDefaultPlugins_();
	        }
	        get document() {
	            if (!this.doc_) {
	                throw TpError.alreadyDisposed();
	            }
	            return this.doc_;
	        }
	        dispose() {
	            const containerElem = this.containerElem_;
	            if (!containerElem) {
	                throw TpError.alreadyDisposed();
	            }
	            if (this.usesDefaultWrapper_) {
	                const parentElem = containerElem.parentElement;
	                if (parentElem) {
	                    parentElem.removeChild(containerElem);
	                }
	            }
	            this.containerElem_ = null;
	            this.doc_ = null;
	            super.dispose();
	        }
	        registerPlugin(bundle) {
	            const plugins = 'plugin' in bundle
	                ? [bundle.plugin]
	                : 'plugins' in bundle
	                    ? bundle.plugins
	                    : [];
	            plugins.forEach((p) => {
	                this.pool_.register(p);
	                this.embedPluginStyle_(p);
	            });
	        }
	        embedPluginStyle_(plugin) {
	            if (plugin.css) {
	                embedStyle(this.document, `plugin-${plugin.id}`, plugin.css);
	            }
	        }
	        setUpDefaultPlugins_() {
	            // NOTE: This string literal will be replaced with the default CSS by Rollup at the compilation time
	            embedStyle(this.document, 'default', '.tp-tbiv_b,.tp-coltxtv_ms,.tp-ckbv_i,.tp-rotv_b,.tp-fldv_b,.tp-mllv_i,.tp-sglv_i,.tp-grlv_g,.tp-txtv_i,.tp-p2dpv_p,.tp-colswv_sw,.tp-p2dv_b,.tp-btnv_b,.tp-lstv_s{-webkit-appearance:none;-moz-appearance:none;appearance:none;background-color:rgba(0,0,0,0);border-width:0;font-family:inherit;font-size:inherit;font-weight:inherit;margin:0;outline:none;padding:0}.tp-p2dv_b,.tp-btnv_b,.tp-lstv_s{background-color:var(--btn-bg);border-radius:var(--elm-br);color:var(--btn-fg);cursor:pointer;display:block;font-weight:bold;height:var(--bld-us);line-height:var(--bld-us);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tp-p2dv_b:hover,.tp-btnv_b:hover,.tp-lstv_s:hover{background-color:var(--btn-bg-h)}.tp-p2dv_b:focus,.tp-btnv_b:focus,.tp-lstv_s:focus{background-color:var(--btn-bg-f)}.tp-p2dv_b:active,.tp-btnv_b:active,.tp-lstv_s:active{background-color:var(--btn-bg-a)}.tp-p2dv_b:disabled,.tp-btnv_b:disabled,.tp-lstv_s:disabled{opacity:.5}.tp-txtv_i,.tp-p2dpv_p,.tp-colswv_sw{background-color:var(--in-bg);border-radius:var(--elm-br);box-sizing:border-box;color:var(--in-fg);font-family:inherit;height:var(--bld-us);line-height:var(--bld-us);min-width:0;width:100%}.tp-txtv_i:hover,.tp-p2dpv_p:hover,.tp-colswv_sw:hover{background-color:var(--in-bg-h)}.tp-txtv_i:focus,.tp-p2dpv_p:focus,.tp-colswv_sw:focus{background-color:var(--in-bg-f)}.tp-txtv_i:active,.tp-p2dpv_p:active,.tp-colswv_sw:active{background-color:var(--in-bg-a)}.tp-txtv_i:disabled,.tp-p2dpv_p:disabled,.tp-colswv_sw:disabled{opacity:.5}.tp-mllv_i,.tp-sglv_i,.tp-grlv_g{background-color:var(--mo-bg);border-radius:var(--elm-br);box-sizing:border-box;color:var(--mo-fg);height:var(--bld-us);scrollbar-color:currentColor rgba(0,0,0,0);scrollbar-width:thin;width:100%}.tp-mllv_i::-webkit-scrollbar,.tp-sglv_i::-webkit-scrollbar,.tp-grlv_g::-webkit-scrollbar{height:8px;width:8px}.tp-mllv_i::-webkit-scrollbar-corner,.tp-sglv_i::-webkit-scrollbar-corner,.tp-grlv_g::-webkit-scrollbar-corner{background-color:rgba(0,0,0,0)}.tp-mllv_i::-webkit-scrollbar-thumb,.tp-sglv_i::-webkit-scrollbar-thumb,.tp-grlv_g::-webkit-scrollbar-thumb{background-clip:padding-box;background-color:currentColor;border:rgba(0,0,0,0) solid 2px;border-radius:4px}.tp-rotv{--font-family: var(--tp-font-family, Roboto Mono, Source Code Pro, Menlo, Courier, monospace);--bs-br: var(--tp-base-border-radius, 6px);--cnt-h-p: var(--tp-container-horizontal-padding, 4px);--cnt-v-p: var(--tp-container-vertical-padding, 4px);--elm-br: var(--tp-element-border-radius, 2px);--bld-s: var(--tp-blade-spacing, 4px);--bld-us: var(--tp-blade-unit-size, 20px);--bs-bg: var(--tp-base-background-color, hsl(230, 7%, 17%));--bs-sh: var(--tp-base-shadow-color, rgba(0, 0, 0, 0.2));--btn-bg: var(--tp-button-background-color, hsl(230, 7%, 70%));--btn-bg-a: var(--tp-button-background-color-active, #d6d7db);--btn-bg-f: var(--tp-button-background-color-focus, #c8cad0);--btn-bg-h: var(--tp-button-background-color-hover, #bbbcc4);--btn-fg: var(--tp-button-foreground-color, hsl(230, 7%, 17%));--cnt-bg: var(--tp-container-background-color, rgba(187, 188, 196, 0.1));--cnt-bg-a: var(--tp-container-background-color-active, rgba(187, 188, 196, 0.25));--cnt-bg-f: var(--tp-container-background-color-focus, rgba(187, 188, 196, 0.2));--cnt-bg-h: var(--tp-container-background-color-hover, rgba(187, 188, 196, 0.15));--cnt-fg: var(--tp-container-foreground-color, hsl(230, 7%, 75%));--in-bg: var(--tp-input-background-color, rgba(187, 188, 196, 0.1));--in-bg-a: var(--tp-input-background-color-active, rgba(187, 188, 196, 0.25));--in-bg-f: var(--tp-input-background-color-focus, rgba(187, 188, 196, 0.2));--in-bg-h: var(--tp-input-background-color-hover, rgba(187, 188, 196, 0.15));--in-fg: var(--tp-input-foreground-color, hsl(230, 7%, 75%));--lbl-fg: var(--tp-label-foreground-color, rgba(187, 188, 196, 0.7));--mo-bg: var(--tp-monitor-background-color, rgba(0, 0, 0, 0.2));--mo-fg: var(--tp-monitor-foreground-color, rgba(187, 188, 196, 0.7));--grv-fg: var(--tp-groove-foreground-color, rgba(187, 188, 196, 0.1))}.tp-rotv_c>.tp-cntv.tp-v-lst,.tp-tabv_c .tp-brkv>.tp-cntv.tp-v-lst,.tp-fldv_c>.tp-cntv.tp-v-lst{margin-bottom:calc(-1*var(--cnt-v-p))}.tp-rotv_c>.tp-fldv.tp-v-lst .tp-fldv_c,.tp-tabv_c .tp-brkv>.tp-fldv.tp-v-lst .tp-fldv_c,.tp-fldv_c>.tp-fldv.tp-v-lst .tp-fldv_c{border-bottom-left-radius:0}.tp-rotv_c>.tp-fldv.tp-v-lst .tp-fldv_b,.tp-tabv_c .tp-brkv>.tp-fldv.tp-v-lst .tp-fldv_b,.tp-fldv_c>.tp-fldv.tp-v-lst .tp-fldv_b{border-bottom-left-radius:0}.tp-rotv_c>*:not(.tp-v-fst),.tp-tabv_c .tp-brkv>*:not(.tp-v-fst),.tp-fldv_c>*:not(.tp-v-fst){margin-top:var(--bld-s)}.tp-rotv_c>.tp-sprv:not(.tp-v-fst),.tp-tabv_c .tp-brkv>.tp-sprv:not(.tp-v-fst),.tp-fldv_c>.tp-sprv:not(.tp-v-fst),.tp-rotv_c>.tp-cntv:not(.tp-v-fst),.tp-tabv_c .tp-brkv>.tp-cntv:not(.tp-v-fst),.tp-fldv_c>.tp-cntv:not(.tp-v-fst){margin-top:var(--cnt-v-p)}.tp-rotv_c>.tp-sprv+*:not(.tp-v-hidden),.tp-tabv_c .tp-brkv>.tp-sprv+*:not(.tp-v-hidden),.tp-fldv_c>.tp-sprv+*:not(.tp-v-hidden),.tp-rotv_c>.tp-cntv+*:not(.tp-v-hidden),.tp-tabv_c .tp-brkv>.tp-cntv+*:not(.tp-v-hidden),.tp-fldv_c>.tp-cntv+*:not(.tp-v-hidden){margin-top:var(--cnt-v-p)}.tp-rotv_c>.tp-sprv:not(.tp-v-hidden)+.tp-sprv,.tp-tabv_c .tp-brkv>.tp-sprv:not(.tp-v-hidden)+.tp-sprv,.tp-fldv_c>.tp-sprv:not(.tp-v-hidden)+.tp-sprv,.tp-rotv_c>.tp-cntv:not(.tp-v-hidden)+.tp-cntv,.tp-tabv_c .tp-brkv>.tp-cntv:not(.tp-v-hidden)+.tp-cntv,.tp-fldv_c>.tp-cntv:not(.tp-v-hidden)+.tp-cntv{margin-top:0}.tp-tabv_c .tp-brkv>.tp-cntv,.tp-fldv_c>.tp-cntv{margin-left:4px}.tp-tabv_c .tp-brkv>.tp-fldv>.tp-fldv_b,.tp-fldv_c>.tp-fldv>.tp-fldv_b{border-top-left-radius:var(--elm-br);border-bottom-left-radius:var(--elm-br)}.tp-tabv_c .tp-brkv>.tp-fldv.tp-fldv-expanded>.tp-fldv_b,.tp-fldv_c>.tp-fldv.tp-fldv-expanded>.tp-fldv_b{border-bottom-left-radius:0}.tp-tabv_c .tp-brkv .tp-fldv>.tp-fldv_c,.tp-fldv_c .tp-fldv>.tp-fldv_c{border-bottom-left-radius:var(--elm-br)}.tp-tabv_c .tp-brkv>.tp-cntv+.tp-fldv>.tp-fldv_b,.tp-fldv_c>.tp-cntv+.tp-fldv>.tp-fldv_b{border-top-left-radius:0}.tp-tabv_c .tp-brkv>.tp-cntv+.tp-tabv>.tp-tabv_t,.tp-fldv_c>.tp-cntv+.tp-tabv>.tp-tabv_t{border-top-left-radius:0}.tp-tabv_c .tp-brkv>.tp-tabv>.tp-tabv_t,.tp-fldv_c>.tp-tabv>.tp-tabv_t{border-top-left-radius:var(--elm-br)}.tp-tabv_c .tp-brkv .tp-tabv>.tp-tabv_c,.tp-fldv_c .tp-tabv>.tp-tabv_c{border-bottom-left-radius:var(--elm-br)}.tp-rotv_b,.tp-fldv_b{background-color:var(--cnt-bg);color:var(--cnt-fg);cursor:pointer;display:block;height:calc(var(--bld-us) + 4px);line-height:calc(var(--bld-us) + 4px);overflow:hidden;padding-left:var(--cnt-h-p);padding-right:calc(4px + var(--bld-us) + var(--cnt-h-p));position:relative;text-align:left;text-overflow:ellipsis;white-space:nowrap;width:100%;transition:border-radius .2s ease-in-out .2s}.tp-rotv_b:hover,.tp-fldv_b:hover{background-color:var(--cnt-bg-h)}.tp-rotv_b:focus,.tp-fldv_b:focus{background-color:var(--cnt-bg-f)}.tp-rotv_b:active,.tp-fldv_b:active{background-color:var(--cnt-bg-a)}.tp-rotv_b:disabled,.tp-fldv_b:disabled{opacity:.5}.tp-rotv_m,.tp-fldv_m{background:linear-gradient(to left, var(--cnt-fg), var(--cnt-fg) 2px, transparent 2px, transparent 4px, var(--cnt-fg) 4px);border-radius:2px;bottom:0;content:"";display:block;height:6px;right:calc(var(--cnt-h-p) + (var(--bld-us) + 4px - 6px)/2 - 2px);margin:auto;opacity:.5;position:absolute;top:0;transform:rotate(90deg);transition:transform .2s ease-in-out;width:6px}.tp-rotv.tp-rotv-expanded .tp-rotv_m,.tp-fldv.tp-fldv-expanded>.tp-fldv_b>.tp-fldv_m{transform:none}.tp-rotv_c,.tp-fldv_c{box-sizing:border-box;height:0;opacity:0;overflow:hidden;padding-bottom:0;padding-top:0;position:relative;transition:height .2s ease-in-out,opacity .2s linear,padding .2s ease-in-out}.tp-rotv.tp-rotv-cpl:not(.tp-rotv-expanded) .tp-rotv_c,.tp-fldv.tp-fldv-cpl:not(.tp-fldv-expanded)>.tp-fldv_c{display:none}.tp-rotv.tp-rotv-expanded .tp-rotv_c,.tp-fldv.tp-fldv-expanded>.tp-fldv_c{opacity:1;padding-bottom:var(--cnt-v-p);padding-top:var(--cnt-v-p);transform:none;overflow:visible;transition:height .2s ease-in-out,opacity .2s linear .2s,padding .2s ease-in-out}.tp-lstv,.tp-coltxtv_m{position:relative}.tp-lstv_s{padding:0 20px 0 4px;width:100%}.tp-lstv_m,.tp-coltxtv_mm{bottom:0;margin:auto;pointer-events:none;position:absolute;right:2px;top:0}.tp-lstv_m svg,.tp-coltxtv_mm svg{bottom:0;height:16px;margin:auto;position:absolute;right:0;top:0;width:16px}.tp-lstv_m svg path,.tp-coltxtv_mm svg path{fill:currentColor}.tp-pndtxtv,.tp-coltxtv_w{display:flex}.tp-pndtxtv_a,.tp-coltxtv_c{width:100%}.tp-pndtxtv_a+.tp-pndtxtv_a,.tp-coltxtv_c+.tp-pndtxtv_a,.tp-pndtxtv_a+.tp-coltxtv_c,.tp-coltxtv_c+.tp-coltxtv_c{margin-left:2px}.tp-btnv_b{width:100%}.tp-btnv_t{text-align:center}.tp-ckbv_l{display:block;position:relative}.tp-ckbv_i{left:0;opacity:0;position:absolute;top:0}.tp-ckbv_w{background-color:var(--in-bg);border-radius:var(--elm-br);cursor:pointer;display:block;height:var(--bld-us);position:relative;width:var(--bld-us)}.tp-ckbv_w svg{bottom:0;display:block;height:16px;left:0;margin:auto;opacity:0;position:absolute;right:0;top:0;width:16px}.tp-ckbv_w svg path{fill:none;stroke:var(--in-fg);stroke-width:2}.tp-ckbv_i:hover+.tp-ckbv_w{background-color:var(--in-bg-h)}.tp-ckbv_i:focus+.tp-ckbv_w{background-color:var(--in-bg-f)}.tp-ckbv_i:active+.tp-ckbv_w{background-color:var(--in-bg-a)}.tp-ckbv_i:checked+.tp-ckbv_w svg{opacity:1}.tp-ckbv.tp-v-disabled .tp-ckbv_w{opacity:.5}.tp-colv{position:relative}.tp-colv_h{display:flex}.tp-colv_s{flex-grow:0;flex-shrink:0;width:var(--bld-us)}.tp-colv_t{flex:1;margin-left:4px}.tp-colv_p{height:0;margin-top:0;opacity:0;overflow:hidden;transition:height .2s ease-in-out,opacity .2s linear,margin .2s ease-in-out}.tp-colv.tp-colv-cpl .tp-colv_p{overflow:visible}.tp-colv.tp-colv-expanded .tp-colv_p{margin-top:var(--bld-s);opacity:1}.tp-colv .tp-popv{left:calc(-1*var(--cnt-h-p));right:calc(-1*var(--cnt-h-p));top:var(--bld-us)}.tp-colpv_h,.tp-colpv_ap{margin-left:6px;margin-right:6px}.tp-colpv_h{margin-top:var(--bld-s)}.tp-colpv_rgb{display:flex;margin-top:var(--bld-s);width:100%}.tp-colpv_a{display:flex;margin-top:var(--cnt-v-p);padding-top:calc(var(--cnt-v-p) + 2px);position:relative}.tp-colpv_a::before{background-color:var(--grv-fg);content:"";height:2px;left:calc(-1*var(--cnt-h-p));position:absolute;right:calc(-1*var(--cnt-h-p));top:0}.tp-colpv.tp-v-disabled .tp-colpv_a::before{opacity:.5}.tp-colpv_ap{align-items:center;display:flex;flex:3}.tp-colpv_at{flex:1;margin-left:4px}.tp-svpv{border-radius:var(--elm-br);outline:none;overflow:hidden;position:relative}.tp-svpv.tp-v-disabled{opacity:.5}.tp-svpv_c{cursor:crosshair;display:block;height:calc(var(--bld-us)*4);width:100%}.tp-svpv_m{border-radius:100%;border:rgba(255,255,255,.75) solid 2px;box-sizing:border-box;filter:drop-shadow(0 0 1px rgba(0, 0, 0, 0.3));height:12px;margin-left:-6px;margin-top:-6px;pointer-events:none;position:absolute;width:12px}.tp-svpv:focus .tp-svpv_m{border-color:#fff}.tp-hplv{cursor:pointer;height:var(--bld-us);outline:none;position:relative}.tp-hplv.tp-v-disabled{opacity:.5}.tp-hplv_c{background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAABCAYAAABubagXAAAAQ0lEQVQoU2P8z8Dwn0GCgQEDi2OK/RBgYHjBgIpfovFh8j8YBIgzFGQxuqEgPhaDOT5gOhPkdCxOZeBg+IDFZZiGAgCaSSMYtcRHLgAAAABJRU5ErkJggg==);background-position:left top;background-repeat:no-repeat;background-size:100% 100%;border-radius:2px;display:block;height:4px;left:0;margin-top:-2px;position:absolute;top:50%;width:100%}.tp-hplv_m{border-radius:var(--elm-br);border:rgba(255,255,255,.75) solid 2px;box-shadow:0 0 2px rgba(0,0,0,.1);box-sizing:border-box;height:12px;left:50%;margin-left:-6px;margin-top:-6px;pointer-events:none;position:absolute;top:50%;width:12px}.tp-hplv:focus .tp-hplv_m{border-color:#fff}.tp-aplv{cursor:pointer;height:var(--bld-us);outline:none;position:relative;width:100%}.tp-aplv.tp-v-disabled{opacity:.5}.tp-aplv_b{background-color:#fff;background-image:linear-gradient(to top right, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%),linear-gradient(to top right, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%);background-size:4px 4px;background-position:0 0,2px 2px;border-radius:2px;display:block;height:4px;left:0;margin-top:-2px;overflow:hidden;position:absolute;top:50%;width:100%}.tp-aplv_c{bottom:0;left:0;position:absolute;right:0;top:0}.tp-aplv_m{background-color:#fff;background-image:linear-gradient(to top right, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%),linear-gradient(to top right, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%);background-size:12px 12px;background-position:0 0,6px 6px;border-radius:var(--elm-br);box-shadow:0 0 2px rgba(0,0,0,.1);height:12px;left:50%;margin-left:-6px;margin-top:-6px;overflow:hidden;pointer-events:none;position:absolute;top:50%;width:12px}.tp-aplv_p{border-radius:var(--elm-br);border:rgba(255,255,255,.75) solid 2px;box-sizing:border-box;bottom:0;left:0;position:absolute;right:0;top:0}.tp-aplv:focus .tp-aplv_p{border-color:#fff}.tp-colswv{background-color:#fff;background-image:linear-gradient(to top right, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%),linear-gradient(to top right, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%);background-size:10px 10px;background-position:0 0,5px 5px;border-radius:var(--elm-br);overflow:hidden}.tp-colswv.tp-v-disabled{opacity:.5}.tp-colswv_sw{border-radius:0}.tp-colswv_b{-webkit-appearance:none;-moz-appearance:none;appearance:none;background-color:rgba(0,0,0,0);border-width:0;cursor:pointer;display:block;height:var(--bld-us);left:0;margin:0;outline:none;padding:0;position:absolute;top:0;width:var(--bld-us)}.tp-colswv_b:focus::after{border:rgba(255,255,255,.75) solid 2px;border-radius:var(--elm-br);bottom:0;content:"";display:block;left:0;position:absolute;right:0;top:0}.tp-coltxtv{display:flex;width:100%}.tp-coltxtv_m{margin-right:4px}.tp-coltxtv_ms{border-radius:var(--elm-br);color:var(--lbl-fg);cursor:pointer;height:var(--bld-us);line-height:var(--bld-us);padding:0 18px 0 4px}.tp-coltxtv_ms:hover{background-color:var(--in-bg-h)}.tp-coltxtv_ms:focus{background-color:var(--in-bg-f)}.tp-coltxtv_ms:active{background-color:var(--in-bg-a)}.tp-coltxtv_mm{color:var(--lbl-fg)}.tp-coltxtv.tp-v-disabled .tp-coltxtv_mm{opacity:.5}.tp-coltxtv_w{flex:1}.tp-dfwv{position:absolute;top:8px;right:8px;width:256px}.tp-fldv{position:relative}.tp-fldv.tp-fldv-not .tp-fldv_b{display:none}.tp-fldv_t{padding-left:4px}.tp-fldv_b:disabled .tp-fldv_m{display:none}.tp-fldv_c{padding-left:4px}.tp-fldv_i{bottom:0;color:var(--cnt-bg);left:0;overflow:hidden;position:absolute;top:calc(var(--bld-us) + 4px);width:var(--bs-br)}.tp-fldv_i::before{background-color:currentColor;bottom:0;content:"";left:0;position:absolute;top:0;width:4px}.tp-fldv_b:hover+.tp-fldv_i{color:var(--cnt-bg-h)}.tp-fldv_b:focus+.tp-fldv_i{color:var(--cnt-bg-f)}.tp-fldv_b:active+.tp-fldv_i{color:var(--cnt-bg-a)}.tp-fldv.tp-v-disabled>.tp-fldv_i{opacity:.5}.tp-grlv{position:relative}.tp-grlv_g{display:block;height:calc(var(--bld-us)*3)}.tp-grlv_g polyline{fill:none;stroke:var(--mo-fg);stroke-linejoin:round}.tp-grlv_t{margin-top:-4px;transition:left .05s,top .05s;visibility:hidden}.tp-grlv_t.tp-grlv_t-a{visibility:visible}.tp-grlv_t.tp-grlv_t-in{transition:none}.tp-grlv.tp-v-disabled .tp-grlv_g{opacity:.5}.tp-grlv .tp-ttv{background-color:var(--mo-fg)}.tp-grlv .tp-ttv::before{border-top-color:var(--mo-fg)}.tp-lblv{align-items:center;display:flex;line-height:1.3;padding-left:var(--cnt-h-p);padding-right:var(--cnt-h-p)}.tp-lblv.tp-lblv-nol{display:block}.tp-lblv_l{color:var(--lbl-fg);flex:1;-webkit-hyphens:auto;hyphens:auto;overflow:hidden;padding-left:4px;padding-right:16px}.tp-lblv.tp-v-disabled .tp-lblv_l{opacity:.5}.tp-lblv.tp-lblv-nol .tp-lblv_l{display:none}.tp-lblv_v{align-self:flex-start;flex-grow:0;flex-shrink:0;width:160px}.tp-lblv.tp-lblv-nol .tp-lblv_v{width:100%}.tp-lstv_s{padding:0 20px 0 4px;width:100%}.tp-lstv_m{color:var(--btn-fg)}.tp-sglv_i{padding:0 4px}.tp-sglv.tp-v-disabled .tp-sglv_i{opacity:.5}.tp-mllv_i{display:block;height:calc(var(--bld-us)*3);line-height:var(--bld-us);padding:0 4px;resize:none;white-space:pre}.tp-mllv.tp-v-disabled .tp-mllv_i{opacity:.5}.tp-p2dv{position:relative}.tp-p2dv_h{display:flex}.tp-p2dv_b{height:var(--bld-us);margin-right:4px;position:relative;width:var(--bld-us)}.tp-p2dv_b svg{display:block;height:16px;left:50%;margin-left:-8px;margin-top:-8px;position:absolute;top:50%;width:16px}.tp-p2dv_b svg path{stroke:currentColor;stroke-width:2}.tp-p2dv_b svg circle{fill:currentColor}.tp-p2dv_t{flex:1}.tp-p2dv_p{height:0;margin-top:0;opacity:0;overflow:hidden;transition:height .2s ease-in-out,opacity .2s linear,margin .2s ease-in-out}.tp-p2dv.tp-p2dv-expanded .tp-p2dv_p{margin-top:var(--bld-s);opacity:1}.tp-p2dv .tp-popv{left:calc(-1*var(--cnt-h-p));right:calc(-1*var(--cnt-h-p));top:var(--bld-us)}.tp-p2dpv{padding-left:calc(var(--bld-us) + 4px)}.tp-p2dpv_p{cursor:crosshair;height:0;overflow:hidden;padding-bottom:100%;position:relative}.tp-p2dpv.tp-v-disabled .tp-p2dpv_p{opacity:.5}.tp-p2dpv_g{display:block;height:100%;left:0;pointer-events:none;position:absolute;top:0;width:100%}.tp-p2dpv_ax{opacity:.1;stroke:var(--in-fg);stroke-dasharray:1}.tp-p2dpv_l{opacity:.5;stroke:var(--in-fg);stroke-dasharray:1}.tp-p2dpv_m{border:var(--in-fg) solid 1px;border-radius:50%;box-sizing:border-box;height:4px;margin-left:-2px;margin-top:-2px;position:absolute;width:4px}.tp-p2dpv_p:focus .tp-p2dpv_m{background-color:var(--in-fg);border-width:0}.tp-popv{background-color:var(--bs-bg);border-radius:6px;box-shadow:0 2px 4px var(--bs-sh);display:none;max-width:168px;padding:var(--cnt-v-p) var(--cnt-h-p);position:absolute;visibility:hidden;z-index:1000}.tp-popv.tp-popv-v{display:block;visibility:visible}.tp-sprv_r{background-color:var(--grv-fg);border-width:0;display:block;height:2px;margin:0;width:100%}.tp-sprv.tp-v-disabled .tp-sprv_r{opacity:.5}.tp-sldv.tp-v-disabled{opacity:.5}.tp-sldv_t{box-sizing:border-box;cursor:pointer;height:var(--bld-us);margin:0 6px;outline:none;position:relative}.tp-sldv_t::before{background-color:var(--in-bg);border-radius:1px;bottom:0;content:"";display:block;height:2px;left:0;margin:auto;position:absolute;right:0;top:0}.tp-sldv_k{height:100%;left:0;position:absolute;top:0}.tp-sldv_k::before{background-color:var(--in-fg);border-radius:1px;bottom:0;content:"";display:block;height:2px;left:0;margin-bottom:auto;margin-top:auto;position:absolute;right:0;top:0}.tp-sldv_k::after{background-color:var(--btn-bg);border-radius:var(--elm-br);bottom:0;content:"";display:block;height:12px;margin-bottom:auto;margin-top:auto;position:absolute;right:-6px;top:0;width:12px}.tp-sldv_t:hover .tp-sldv_k::after{background-color:var(--btn-bg-h)}.tp-sldv_t:focus .tp-sldv_k::after{background-color:var(--btn-bg-f)}.tp-sldv_t:active .tp-sldv_k::after{background-color:var(--btn-bg-a)}.tp-sldtxtv{display:flex}.tp-sldtxtv_s{flex:2}.tp-sldtxtv_t{flex:1;margin-left:4px}.tp-tabv{position:relative}.tp-tabv_t{align-items:flex-end;color:var(--cnt-bg);display:flex;overflow:hidden;position:relative}.tp-tabv_t:hover{color:var(--cnt-bg-h)}.tp-tabv_t:has(*:focus){color:var(--cnt-bg-f)}.tp-tabv_t:has(*:active){color:var(--cnt-bg-a)}.tp-tabv_t::before{background-color:currentColor;bottom:0;content:"";height:2px;left:0;pointer-events:none;position:absolute;right:0}.tp-tabv.tp-v-disabled .tp-tabv_t::before{opacity:.5}.tp-tabv.tp-tabv-nop .tp-tabv_t{height:calc(var(--bld-us) + 4px);position:relative}.tp-tabv.tp-tabv-nop .tp-tabv_t::before{background-color:var(--cnt-bg);bottom:0;content:"";height:2px;left:0;position:absolute;right:0}.tp-tabv_c{padding-bottom:var(--cnt-v-p);padding-left:4px;padding-top:var(--cnt-v-p)}.tp-tabv_i{bottom:0;color:var(--cnt-bg);left:0;overflow:hidden;position:absolute;top:calc(var(--bld-us) + 4px);width:var(--bs-br)}.tp-tabv_i::before{background-color:currentColor;bottom:0;content:"";left:0;position:absolute;top:0;width:4px}.tp-tabv_t:hover+.tp-tabv_i{color:var(--cnt-bg-h)}.tp-tabv_t:has(*:focus)+.tp-tabv_i{color:var(--cnt-bg-f)}.tp-tabv_t:has(*:active)+.tp-tabv_i{color:var(--cnt-bg-a)}.tp-tabv.tp-v-disabled>.tp-tabv_i{opacity:.5}.tp-tbiv{flex:1;min-width:0;position:relative}.tp-tbiv+.tp-tbiv{margin-left:2px}.tp-tbiv+.tp-tbiv.tp-v-disabled::before{opacity:.5}.tp-tbiv_b{display:block;padding-left:calc(var(--cnt-h-p) + 4px);padding-right:calc(var(--cnt-h-p) + 4px);position:relative;width:100%}.tp-tbiv_b:disabled{opacity:.5}.tp-tbiv_b::before{background-color:var(--cnt-bg);bottom:2px;content:"";left:0;pointer-events:none;position:absolute;right:0;top:0}.tp-tbiv_b:hover::before{background-color:var(--cnt-bg-h)}.tp-tbiv_b:focus::before{background-color:var(--cnt-bg-f)}.tp-tbiv_b:active::before{background-color:var(--cnt-bg-a)}.tp-tbiv_t{color:var(--cnt-fg);height:calc(var(--bld-us) + 4px);line-height:calc(var(--bld-us) + 4px);opacity:.5;overflow:hidden;text-overflow:ellipsis}.tp-tbiv.tp-tbiv-sel .tp-tbiv_t{opacity:1}.tp-txtv{position:relative}.tp-txtv_i{padding:0 4px}.tp-txtv.tp-txtv-fst .tp-txtv_i{border-bottom-right-radius:0;border-top-right-radius:0}.tp-txtv.tp-txtv-mid .tp-txtv_i{border-radius:0}.tp-txtv.tp-txtv-lst .tp-txtv_i{border-bottom-left-radius:0;border-top-left-radius:0}.tp-txtv.tp-txtv-num .tp-txtv_i{text-align:right}.tp-txtv.tp-txtv-drg .tp-txtv_i{opacity:.3}.tp-txtv_k{cursor:pointer;height:100%;left:-3px;position:absolute;top:0;width:12px}.tp-txtv_k::before{background-color:var(--in-fg);border-radius:1px;bottom:0;content:"";height:calc(var(--bld-us) - 4px);left:50%;margin-bottom:auto;margin-left:-1px;margin-top:auto;opacity:.1;position:absolute;top:0;transition:border-radius .1s,height .1s,transform .1s,width .1s;width:2px}.tp-txtv_k:hover::before,.tp-txtv.tp-txtv-drg .tp-txtv_k::before{opacity:1}.tp-txtv.tp-txtv-drg .tp-txtv_k::before{border-radius:50%;height:4px;transform:translateX(-1px);width:4px}.tp-txtv_g{bottom:0;display:block;height:8px;left:50%;margin:auto;overflow:visible;pointer-events:none;position:absolute;top:0;visibility:hidden;width:100%}.tp-txtv.tp-txtv-drg .tp-txtv_g{visibility:visible}.tp-txtv_gb{fill:none;stroke:var(--in-fg);stroke-dasharray:1}.tp-txtv_gh{fill:none;stroke:var(--in-fg)}.tp-txtv .tp-ttv{margin-left:6px;visibility:hidden}.tp-txtv.tp-txtv-drg .tp-ttv{visibility:visible}.tp-ttv{background-color:var(--in-fg);border-radius:var(--elm-br);color:var(--bs-bg);padding:2px 4px;pointer-events:none;position:absolute;transform:translate(-50%, -100%)}.tp-ttv::before{border-color:var(--in-fg) rgba(0,0,0,0) rgba(0,0,0,0) rgba(0,0,0,0);border-style:solid;border-width:2px;box-sizing:border-box;content:"";font-size:.9em;height:4px;left:50%;margin-left:-2px;position:absolute;top:100%;width:4px}.tp-rotv{background-color:var(--bs-bg);border-radius:var(--bs-br);box-shadow:0 2px 4px var(--bs-sh);font-family:var(--font-family);font-size:11px;font-weight:500;line-height:1;text-align:left}.tp-rotv_b{border-bottom-left-radius:var(--bs-br);border-bottom-right-radius:var(--bs-br);border-top-left-radius:var(--bs-br);border-top-right-radius:var(--bs-br);padding-left:calc(4px + var(--bld-us) + var(--cnt-h-p));text-align:center}.tp-rotv.tp-rotv-expanded .tp-rotv_b{border-bottom-left-radius:0;border-bottom-right-radius:0}.tp-rotv.tp-rotv-not .tp-rotv_b{display:none}.tp-rotv_b:disabled .tp-rotv_m{display:none}.tp-rotv_c>.tp-fldv.tp-v-lst>.tp-fldv_c{border-bottom-left-radius:var(--bs-br);border-bottom-right-radius:var(--bs-br)}.tp-rotv_c>.tp-fldv.tp-v-lst>.tp-fldv_i{border-bottom-left-radius:var(--bs-br)}.tp-rotv_c>.tp-fldv.tp-v-lst:not(.tp-fldv-expanded)>.tp-fldv_b{border-bottom-left-radius:var(--bs-br);border-bottom-right-radius:var(--bs-br)}.tp-rotv_c .tp-fldv.tp-v-vlst:not(.tp-fldv-expanded)>.tp-fldv_b{border-bottom-right-radius:var(--bs-br)}.tp-rotv.tp-rotv-not .tp-rotv_c>.tp-fldv.tp-v-fst{margin-top:calc(-1*var(--cnt-v-p))}.tp-rotv.tp-rotv-not .tp-rotv_c>.tp-fldv.tp-v-fst>.tp-fldv_b{border-top-left-radius:var(--bs-br);border-top-right-radius:var(--bs-br)}.tp-rotv_c>.tp-tabv.tp-v-lst>.tp-tabv_c{border-bottom-left-radius:var(--bs-br);border-bottom-right-radius:var(--bs-br)}.tp-rotv_c>.tp-tabv.tp-v-lst>.tp-tabv_i{border-bottom-left-radius:var(--bs-br)}.tp-rotv.tp-rotv-not .tp-rotv_c>.tp-tabv.tp-v-fst{margin-top:calc(-1*var(--cnt-v-p))}.tp-rotv.tp-rotv-not .tp-rotv_c>.tp-tabv.tp-v-fst>.tp-tabv_t{border-top-left-radius:var(--bs-br);border-top-right-radius:var(--bs-br)}.tp-rotv.tp-v-disabled,.tp-rotv .tp-v-disabled{pointer-events:none}.tp-rotv.tp-v-hidden,.tp-rotv .tp-v-hidden{display:none}');
	            this.pool_.getAll().forEach((plugin) => {
	                this.embedPluginStyle_(plugin);
	            });
	            this.registerPlugin({
	                plugins: [
	                    SliderBladePlugin,
	                    ListBladePlugin,
	                    TabBladePlugin,
	                    TextBladePlugin,
	                ],
	            });
	        }
	    }

	    const VERSION = new Semver('3.1.5');

	    exports.BladeApi = BladeApi;
	    exports.ButtonApi = ButtonApi;
	    exports.FolderApi = FolderApi;
	    exports.InputBindingApi = InputBindingApi;
	    exports.ListApi = ListApi;
	    exports.MonitorBindingApi = MonitorBindingApi;
	    exports.Pane = Pane;
	    exports.SeparatorApi = SeparatorApi;
	    exports.SliderApi = SliderApi;
	    exports.TabApi = TabApi;
	    exports.TabPageApi = TabPageApi;
	    exports.TextApi = TextApi;
	    exports.TpChangeEvent = TpChangeEvent;
	    exports.VERSION = VERSION;

	    Object.defineProperty(exports, '__esModule', { value: true });

	}));
} (tweakpane, tweakpaneExports));

var tweakpanePluginEssentialsExports = {};
var tweakpanePluginEssentials$1 = {
  get exports(){ return tweakpanePluginEssentialsExports; },
  set exports(v){ tweakpanePluginEssentialsExports = v; },
};

(function (module, exports) {
	(function (global, factory) {
	    factory(exports) ;
	})(commonjsGlobal, (function (exports) {
	    class BladeApi {
	        constructor(controller) {
	            this.controller_ = controller;
	        }
	        get element() {
	            return this.controller_.view.element;
	        }
	        get disabled() {
	            return this.controller_.viewProps.get('disabled');
	        }
	        set disabled(disabled) {
	            this.controller_.viewProps.set('disabled', disabled);
	        }
	        get hidden() {
	            return this.controller_.viewProps.get('hidden');
	        }
	        set hidden(hidden) {
	            this.controller_.viewProps.set('hidden', hidden);
	        }
	        dispose() {
	            this.controller_.viewProps.set('disposed', true);
	        }
	    }

	    class TpEvent {
	        constructor(target) {
	            this.target = target;
	        }
	    }
	    class TpChangeEvent extends TpEvent {
	        constructor(target, value, presetKey, last) {
	            super(target);
	            this.value = value;
	            this.presetKey = presetKey;
	            this.last = last !== null && last !== void 0 ? last : true;
	        }
	    }

	    function forceCast(v) {
	        return v;
	    }
	    function isEmpty(value) {
	        return value === null || value === undefined;
	    }

	    const CREATE_MESSAGE_MAP = {
	        alreadydisposed: () => 'View has been already disposed',
	        invalidparams: (context) => `Invalid parameters for '${context.name}'`,
	        nomatchingcontroller: (context) => `No matching controller for '${context.key}'`,
	        nomatchingview: (context) => `No matching view for '${JSON.stringify(context.params)}'`,
	        notbindable: () => `Value is not bindable`,
	        propertynotfound: (context) => `Property '${context.name}' not found`,
	        shouldneverhappen: () => 'This error should never happen',
	    };
	    class TpError {
	        constructor(config) {
	            var _a;
	            this.message =
	                (_a = CREATE_MESSAGE_MAP[config.type](forceCast(config.context))) !== null && _a !== void 0 ? _a : 'Unexpected error';
	            this.name = this.constructor.name;
	            this.stack = new Error(this.message).stack;
	            this.type = config.type;
	        }
	        static alreadyDisposed() {
	            return new TpError({ type: 'alreadydisposed' });
	        }
	        static notBindable() {
	            return new TpError({
	                type: 'notbindable',
	            });
	        }
	        static propertyNotFound(name) {
	            return new TpError({
	                type: 'propertynotfound',
	                context: {
	                    name: name,
	                },
	            });
	        }
	        static shouldNeverHappen() {
	            return new TpError({ type: 'shouldneverhappen' });
	        }
	    }

	    class Emitter {
	        constructor() {
	            this.observers_ = {};
	        }
	        on(eventName, handler) {
	            let observers = this.observers_[eventName];
	            if (!observers) {
	                observers = this.observers_[eventName] = [];
	            }
	            observers.push({
	                handler: handler,
	            });
	            return this;
	        }
	        off(eventName, handler) {
	            const observers = this.observers_[eventName];
	            if (observers) {
	                this.observers_[eventName] = observers.filter((observer) => {
	                    return observer.handler !== handler;
	                });
	            }
	            return this;
	        }
	        emit(eventName, event) {
	            const observers = this.observers_[eventName];
	            if (!observers) {
	                return;
	            }
	            observers.forEach((observer) => {
	                observer.handler(event);
	            });
	        }
	    }

	    const PREFIX = 'tp';
	    function ClassName(viewName) {
	        const fn = (opt_elementName, opt_modifier) => {
	            return [
	                PREFIX,
	                '-',
	                viewName,
	                'v',
	                opt_elementName ? `_${opt_elementName}` : '',
	                opt_modifier ? `-${opt_modifier}` : '',
	            ].join('');
	        };
	        return fn;
	    }

	    function compose$1(h1, h2) {
	        return (input) => h2(h1(input));
	    }
	    function extractValue(ev) {
	        return ev.rawValue;
	    }
	    function bindValue(value, applyValue) {
	        value.emitter.on('change', compose$1(extractValue, applyValue));
	        applyValue(value.rawValue);
	    }
	    function bindValueMap(valueMap, key, applyValue) {
	        bindValue(valueMap.value(key), applyValue);
	    }

	    function applyClass(elem, className, active) {
	        if (active) {
	            elem.classList.add(className);
	        }
	        else {
	            elem.classList.remove(className);
	        }
	    }
	    function valueToClassName(elem, className) {
	        return (value) => {
	            applyClass(elem, className, value);
	        };
	    }
	    function bindValueToTextContent(value, elem) {
	        bindValue(value, (text) => {
	            elem.textContent = text !== null && text !== void 0 ? text : '';
	        });
	    }

	    const className$g = ClassName('btn');
	    class ButtonView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$g());
	            config.viewProps.bindClassModifiers(this.element);
	            const buttonElem = doc.createElement('button');
	            buttonElem.classList.add(className$g('b'));
	            config.viewProps.bindDisabled(buttonElem);
	            this.element.appendChild(buttonElem);
	            this.buttonElement = buttonElem;
	            const titleElem = doc.createElement('div');
	            titleElem.classList.add(className$g('t'));
	            bindValueToTextContent(config.props.value('title'), titleElem);
	            this.buttonElement.appendChild(titleElem);
	        }
	    }

	    class ButtonController {
	        constructor(doc, config) {
	            this.emitter = new Emitter();
	            this.onClick_ = this.onClick_.bind(this);
	            this.props = config.props;
	            this.viewProps = config.viewProps;
	            this.view = new ButtonView(doc, {
	                props: this.props,
	                viewProps: this.viewProps,
	            });
	            this.view.buttonElement.addEventListener('click', this.onClick_);
	        }
	        onClick_() {
	            this.emitter.emit('click', {
	                sender: this,
	            });
	        }
	    }

	    class BoundValue {
	        constructor(initialValue, config) {
	            var _a;
	            this.constraint_ = config === null || config === void 0 ? void 0 : config.constraint;
	            this.equals_ = (_a = config === null || config === void 0 ? void 0 : config.equals) !== null && _a !== void 0 ? _a : ((v1, v2) => v1 === v2);
	            this.emitter = new Emitter();
	            this.rawValue_ = initialValue;
	        }
	        get constraint() {
	            return this.constraint_;
	        }
	        get rawValue() {
	            return this.rawValue_;
	        }
	        set rawValue(rawValue) {
	            this.setRawValue(rawValue, {
	                forceEmit: false,
	                last: true,
	            });
	        }
	        setRawValue(rawValue, options) {
	            const opts = options !== null && options !== void 0 ? options : {
	                forceEmit: false,
	                last: true,
	            };
	            const constrainedValue = this.constraint_
	                ? this.constraint_.constrain(rawValue)
	                : rawValue;
	            const prevValue = this.rawValue_;
	            const changed = !this.equals_(prevValue, constrainedValue);
	            if (!changed && !opts.forceEmit) {
	                return;
	            }
	            this.emitter.emit('beforechange', {
	                sender: this,
	            });
	            this.rawValue_ = constrainedValue;
	            this.emitter.emit('change', {
	                options: opts,
	                previousRawValue: prevValue,
	                rawValue: constrainedValue,
	                sender: this,
	            });
	        }
	    }

	    class PrimitiveValue {
	        constructor(initialValue) {
	            this.emitter = new Emitter();
	            this.value_ = initialValue;
	        }
	        get rawValue() {
	            return this.value_;
	        }
	        set rawValue(value) {
	            this.setRawValue(value, {
	                forceEmit: false,
	                last: true,
	            });
	        }
	        setRawValue(value, options) {
	            const opts = options !== null && options !== void 0 ? options : {
	                forceEmit: false,
	                last: true,
	            };
	            const prevValue = this.value_;
	            if (prevValue === value && !opts.forceEmit) {
	                return;
	            }
	            this.emitter.emit('beforechange', {
	                sender: this,
	            });
	            this.value_ = value;
	            this.emitter.emit('change', {
	                options: opts,
	                previousRawValue: prevValue,
	                rawValue: this.value_,
	                sender: this,
	            });
	        }
	    }

	    function createValue(initialValue, config) {
	        const constraint = config === null || config === void 0 ? void 0 : config.constraint;
	        const equals = config === null || config === void 0 ? void 0 : config.equals;
	        if (!constraint && !equals) {
	            return new PrimitiveValue(initialValue);
	        }
	        return new BoundValue(initialValue, config);
	    }

	    class ValueMap {
	        constructor(valueMap) {
	            this.emitter = new Emitter();
	            this.valMap_ = valueMap;
	            for (const key in this.valMap_) {
	                const v = this.valMap_[key];
	                v.emitter.on('change', () => {
	                    this.emitter.emit('change', {
	                        key: key,
	                        sender: this,
	                    });
	                });
	            }
	        }
	        static createCore(initialValue) {
	            const keys = Object.keys(initialValue);
	            return keys.reduce((o, key) => {
	                return Object.assign(o, {
	                    [key]: createValue(initialValue[key]),
	                });
	            }, {});
	        }
	        static fromObject(initialValue) {
	            const core = this.createCore(initialValue);
	            return new ValueMap(core);
	        }
	        get(key) {
	            return this.valMap_[key].rawValue;
	        }
	        set(key, value) {
	            this.valMap_[key].rawValue = value;
	        }
	        value(key) {
	            return this.valMap_[key];
	        }
	    }

	    function parseObject(value, keyToParserMap) {
	        const keys = Object.keys(keyToParserMap);
	        const result = keys.reduce((tmp, key) => {
	            if (tmp === undefined) {
	                return undefined;
	            }
	            const parser = keyToParserMap[key];
	            const result = parser(value[key]);
	            return result.succeeded
	                ? Object.assign(Object.assign({}, tmp), { [key]: result.value }) : undefined;
	        }, {});
	        return forceCast(result);
	    }
	    function parseArray(value, parseItem) {
	        return value.reduce((tmp, item) => {
	            if (tmp === undefined) {
	                return undefined;
	            }
	            const result = parseItem(item);
	            if (!result.succeeded || result.value === undefined) {
	                return undefined;
	            }
	            return [...tmp, result.value];
	        }, []);
	    }
	    function isObject(value) {
	        if (value === null) {
	            return false;
	        }
	        return typeof value === 'object';
	    }
	    function createParamsParserBuilder(parse) {
	        return (optional) => (v) => {
	            if (!optional && v === undefined) {
	                return {
	                    succeeded: false,
	                    value: undefined,
	                };
	            }
	            if (optional && v === undefined) {
	                return {
	                    succeeded: true,
	                    value: undefined,
	                };
	            }
	            const result = parse(v);
	            return result !== undefined
	                ? {
	                    succeeded: true,
	                    value: result,
	                }
	                : {
	                    succeeded: false,
	                    value: undefined,
	                };
	        };
	    }
	    function createParamsParserBuilders(optional) {
	        return {
	            custom: (parse) => createParamsParserBuilder(parse)(optional),
	            boolean: createParamsParserBuilder((v) => typeof v === 'boolean' ? v : undefined)(optional),
	            number: createParamsParserBuilder((v) => typeof v === 'number' ? v : undefined)(optional),
	            string: createParamsParserBuilder((v) => typeof v === 'string' ? v : undefined)(optional),
	            function: createParamsParserBuilder((v) =>
	            typeof v === 'function' ? v : undefined)(optional),
	            constant: (value) => createParamsParserBuilder((v) => (v === value ? value : undefined))(optional),
	            raw: createParamsParserBuilder((v) => v)(optional),
	            object: (keyToParserMap) => createParamsParserBuilder((v) => {
	                if (!isObject(v)) {
	                    return undefined;
	                }
	                return parseObject(v, keyToParserMap);
	            })(optional),
	            array: (itemParser) => createParamsParserBuilder((v) => {
	                if (!Array.isArray(v)) {
	                    return undefined;
	                }
	                return parseArray(v, itemParser);
	            })(optional),
	        };
	    }
	    const ParamsParsers = {
	        optional: createParamsParserBuilders(true),
	        required: createParamsParserBuilders(false),
	    };
	    function parseParams(value, keyToParserMap) {
	        const result = ParamsParsers.required.object(keyToParserMap)(value);
	        return result.succeeded ? result.value : undefined;
	    }

	    function warnMissing(info) {
	        console.warn([
	            `Missing '${info.key}' of ${info.target} in ${info.place}.`,
	            'Please rebuild plugins with the latest core package.',
	        ].join(' '));
	    }

	    function disposeElement(elem) {
	        if (elem && elem.parentElement) {
	            elem.parentElement.removeChild(elem);
	        }
	        return null;
	    }

	    class ReadonlyValue {
	        constructor(value) {
	            this.value_ = value;
	        }
	        static create(value) {
	            return [
	                new ReadonlyValue(value),
	                (rawValue, options) => {
	                    value.setRawValue(rawValue, options);
	                },
	            ];
	        }
	        get emitter() {
	            return this.value_.emitter;
	        }
	        get rawValue() {
	            return this.value_.rawValue;
	        }
	    }

	    const className$f = ClassName('');
	    function valueToModifier(elem, modifier) {
	        return valueToClassName(elem, className$f(undefined, modifier));
	    }
	    class ViewProps extends ValueMap {
	        constructor(valueMap) {
	            var _a;
	            super(valueMap);
	            this.onDisabledChange_ = this.onDisabledChange_.bind(this);
	            this.onParentChange_ = this.onParentChange_.bind(this);
	            this.onParentGlobalDisabledChange_ =
	                this.onParentGlobalDisabledChange_.bind(this);
	            [this.globalDisabled_, this.setGlobalDisabled_] = ReadonlyValue.create(createValue(this.getGlobalDisabled_()));
	            this.value('disabled').emitter.on('change', this.onDisabledChange_);
	            this.value('parent').emitter.on('change', this.onParentChange_);
	            (_a = this.get('parent')) === null || _a === void 0 ? void 0 : _a.globalDisabled.emitter.on('change', this.onParentGlobalDisabledChange_);
	        }
	        static create(opt_initialValue) {
	            var _a, _b, _c;
	            const initialValue = opt_initialValue !== null && opt_initialValue !== void 0 ? opt_initialValue : {};
	            return new ViewProps(ValueMap.createCore({
	                disabled: (_a = initialValue.disabled) !== null && _a !== void 0 ? _a : false,
	                disposed: false,
	                hidden: (_b = initialValue.hidden) !== null && _b !== void 0 ? _b : false,
	                parent: (_c = initialValue.parent) !== null && _c !== void 0 ? _c : null,
	            }));
	        }
	        get globalDisabled() {
	            return this.globalDisabled_;
	        }
	        bindClassModifiers(elem) {
	            bindValue(this.globalDisabled_, valueToModifier(elem, 'disabled'));
	            bindValueMap(this, 'hidden', valueToModifier(elem, 'hidden'));
	        }
	        bindDisabled(target) {
	            bindValue(this.globalDisabled_, (disabled) => {
	                target.disabled = disabled;
	            });
	        }
	        bindTabIndex(elem) {
	            bindValue(this.globalDisabled_, (disabled) => {
	                elem.tabIndex = disabled ? -1 : 0;
	            });
	        }
	        handleDispose(callback) {
	            this.value('disposed').emitter.on('change', (disposed) => {
	                if (disposed) {
	                    callback();
	                }
	            });
	        }
	        getGlobalDisabled_() {
	            const parent = this.get('parent');
	            const parentDisabled = parent ? parent.globalDisabled.rawValue : false;
	            return parentDisabled || this.get('disabled');
	        }
	        updateGlobalDisabled_() {
	            this.setGlobalDisabled_(this.getGlobalDisabled_());
	        }
	        onDisabledChange_() {
	            this.updateGlobalDisabled_();
	        }
	        onParentGlobalDisabledChange_() {
	            this.updateGlobalDisabled_();
	        }
	        onParentChange_(ev) {
	            var _a;
	            const prevParent = ev.previousRawValue;
	            prevParent === null || prevParent === void 0 ? void 0 : prevParent.globalDisabled.emitter.off('change', this.onParentGlobalDisabledChange_);
	            (_a = this.get('parent')) === null || _a === void 0 ? void 0 : _a.globalDisabled.emitter.on('change', this.onParentGlobalDisabledChange_);
	            this.updateGlobalDisabled_();
	        }
	    }

	    function getAllBladePositions() {
	        return ['veryfirst', 'first', 'last', 'verylast'];
	    }

	    const className$e = ClassName('');
	    const POS_TO_CLASS_NAME_MAP = {
	        veryfirst: 'vfst',
	        first: 'fst',
	        last: 'lst',
	        verylast: 'vlst',
	    };
	    class BladeController {
	        constructor(config) {
	            this.parent_ = null;
	            this.blade = config.blade;
	            this.view = config.view;
	            this.viewProps = config.viewProps;
	            const elem = this.view.element;
	            this.blade.value('positions').emitter.on('change', () => {
	                getAllBladePositions().forEach((pos) => {
	                    elem.classList.remove(className$e(undefined, POS_TO_CLASS_NAME_MAP[pos]));
	                });
	                this.blade.get('positions').forEach((pos) => {
	                    elem.classList.add(className$e(undefined, POS_TO_CLASS_NAME_MAP[pos]));
	                });
	            });
	            this.viewProps.handleDispose(() => {
	                disposeElement(elem);
	            });
	        }
	        get parent() {
	            return this.parent_;
	        }
	        set parent(parent) {
	            this.parent_ = parent;
	            if (!('parent' in this.viewProps.valMap_)) {
	                warnMissing({
	                    key: 'parent',
	                    target: ViewProps.name,
	                    place: 'BladeController.parent',
	                });
	                return;
	            }
	            this.viewProps.set('parent', this.parent_ ? this.parent_.viewProps : null);
	        }
	    }

	    const SVG_NS = 'http://www.w3.org/2000/svg';
	    function forceReflow(element) {
	        element.offsetHeight;
	    }
	    function disableTransitionTemporarily(element, callback) {
	        const t = element.style.transition;
	        element.style.transition = 'none';
	        callback();
	        element.style.transition = t;
	    }
	    function supportsTouch(doc) {
	        return doc.ontouchstart !== undefined;
	    }
	    function removeChildNodes(element) {
	        while (element.childNodes.length > 0) {
	            element.removeChild(element.childNodes[0]);
	        }
	    }
	    function findNextTarget(ev) {
	        if (ev.relatedTarget) {
	            return forceCast(ev.relatedTarget);
	        }
	        if ('explicitOriginalTarget' in ev) {
	            return ev.explicitOriginalTarget;
	        }
	        return null;
	    }

	    const className$d = ClassName('lbl');
	    function createLabelNode(doc, label) {
	        const frag = doc.createDocumentFragment();
	        const lineNodes = label.split('\n').map((line) => {
	            return doc.createTextNode(line);
	        });
	        lineNodes.forEach((lineNode, index) => {
	            if (index > 0) {
	                frag.appendChild(doc.createElement('br'));
	            }
	            frag.appendChild(lineNode);
	        });
	        return frag;
	    }
	    class LabelView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$d());
	            config.viewProps.bindClassModifiers(this.element);
	            const labelElem = doc.createElement('div');
	            labelElem.classList.add(className$d('l'));
	            bindValueMap(config.props, 'label', (value) => {
	                if (isEmpty(value)) {
	                    this.element.classList.add(className$d(undefined, 'nol'));
	                }
	                else {
	                    this.element.classList.remove(className$d(undefined, 'nol'));
	                    removeChildNodes(labelElem);
	                    labelElem.appendChild(createLabelNode(doc, value));
	                }
	            });
	            this.element.appendChild(labelElem);
	            this.labelElement = labelElem;
	            const valueElem = doc.createElement('div');
	            valueElem.classList.add(className$d('v'));
	            this.element.appendChild(valueElem);
	            this.valueElement = valueElem;
	        }
	    }

	    class LabelController extends BladeController {
	        constructor(doc, config) {
	            const viewProps = config.valueController.viewProps;
	            super(Object.assign(Object.assign({}, config), { view: new LabelView(doc, {
	                    props: config.props,
	                    viewProps: viewProps,
	                }), viewProps: viewProps }));
	            this.props = config.props;
	            this.valueController = config.valueController;
	            this.view.valueElement.appendChild(this.valueController.view.element);
	        }
	    }

	    class ValueBladeController extends BladeController {
	        constructor(config) {
	            super(config);
	            this.value = config.value;
	        }
	    }

	    class Foldable extends ValueMap {
	        constructor(valueMap) {
	            super(valueMap);
	        }
	        static create(expanded) {
	            const coreObj = {
	                completed: true,
	                expanded: expanded,
	                expandedHeight: null,
	                shouldFixHeight: false,
	                temporaryExpanded: null,
	            };
	            const core = ValueMap.createCore(coreObj);
	            return new Foldable(core);
	        }
	        get styleExpanded() {
	            var _a;
	            return (_a = this.get('temporaryExpanded')) !== null && _a !== void 0 ? _a : this.get('expanded');
	        }
	        get styleHeight() {
	            if (!this.styleExpanded) {
	                return '0';
	            }
	            const exHeight = this.get('expandedHeight');
	            if (this.get('shouldFixHeight') && !isEmpty(exHeight)) {
	                return `${exHeight}px`;
	            }
	            return 'auto';
	        }
	        bindExpandedClass(elem, expandedClassName) {
	            const onExpand = () => {
	                const expanded = this.styleExpanded;
	                if (expanded) {
	                    elem.classList.add(expandedClassName);
	                }
	                else {
	                    elem.classList.remove(expandedClassName);
	                }
	            };
	            bindValueMap(this, 'expanded', onExpand);
	            bindValueMap(this, 'temporaryExpanded', onExpand);
	        }
	        cleanUpTransition() {
	            this.set('shouldFixHeight', false);
	            this.set('expandedHeight', null);
	            this.set('completed', true);
	        }
	    }
	    function createFoldable(expanded) {
	        return Foldable.create(expanded);
	    }
	    function computeExpandedFolderHeight(folder, containerElement) {
	        let height = 0;
	        disableTransitionTemporarily(containerElement, () => {
	            folder.set('expandedHeight', null);
	            folder.set('temporaryExpanded', true);
	            forceReflow(containerElement);
	            height = containerElement.clientHeight;
	            folder.set('temporaryExpanded', null);
	            forceReflow(containerElement);
	        });
	        return height;
	    }
	    function applyHeight(foldable, elem) {
	        elem.style.height = foldable.styleHeight;
	    }
	    function bindFoldable(foldable, elem) {
	        foldable.value('expanded').emitter.on('beforechange', () => {
	            foldable.set('completed', false);
	            if (isEmpty(foldable.get('expandedHeight'))) {
	                foldable.set('expandedHeight', computeExpandedFolderHeight(foldable, elem));
	            }
	            foldable.set('shouldFixHeight', true);
	            forceReflow(elem);
	        });
	        foldable.emitter.on('change', () => {
	            applyHeight(foldable, elem);
	        });
	        applyHeight(foldable, elem);
	        elem.addEventListener('transitionend', (ev) => {
	            if (ev.propertyName !== 'height') {
	                return;
	            }
	            foldable.cleanUpTransition();
	        });
	    }

	    class PlainView {
	        constructor(doc, config) {
	            const className = ClassName(config.viewName);
	            this.element = doc.createElement('div');
	            this.element.classList.add(className());
	            config.viewProps.bindClassModifiers(this.element);
	        }
	    }

	    class LabeledValueController extends ValueBladeController {
	        constructor(doc, config) {
	            const viewProps = config.valueController.viewProps;
	            super(Object.assign(Object.assign({}, config), { value: config.valueController.value, view: new LabelView(doc, {
	                    props: config.props,
	                    viewProps: viewProps,
	                }), viewProps: viewProps }));
	            this.props = config.props;
	            this.valueController = config.valueController;
	            this.view.valueElement.appendChild(this.valueController.view.element);
	        }
	    }

	    class ManualTicker {
	        constructor() {
	            this.disabled = false;
	            this.emitter = new Emitter();
	        }
	        dispose() { }
	        tick() {
	            if (this.disabled) {
	                return;
	            }
	            this.emitter.emit('tick', {
	                sender: this,
	            });
	        }
	    }

	    class IntervalTicker {
	        constructor(doc, interval) {
	            this.disabled_ = false;
	            this.timerId_ = null;
	            this.onTick_ = this.onTick_.bind(this);
	            this.doc_ = doc;
	            this.emitter = new Emitter();
	            this.interval_ = interval;
	            this.setTimer_();
	        }
	        get disabled() {
	            return this.disabled_;
	        }
	        set disabled(inactive) {
	            this.disabled_ = inactive;
	            if (this.disabled_) {
	                this.clearTimer_();
	            }
	            else {
	                this.setTimer_();
	            }
	        }
	        dispose() {
	            this.clearTimer_();
	        }
	        clearTimer_() {
	            if (this.timerId_ === null) {
	                return;
	            }
	            const win = this.doc_.defaultView;
	            if (win) {
	                win.clearInterval(this.timerId_);
	            }
	            this.timerId_ = null;
	        }
	        setTimer_() {
	            this.clearTimer_();
	            if (this.interval_ <= 0) {
	                return;
	            }
	            const win = this.doc_.defaultView;
	            if (win) {
	                this.timerId_ = win.setInterval(this.onTick_, this.interval_);
	            }
	        }
	        onTick_() {
	            if (this.disabled_) {
	                return;
	            }
	            this.emitter.emit('tick', {
	                sender: this,
	            });
	        }
	    }

	    class CompositeConstraint {
	        constructor(constraints) {
	            this.constraints = constraints;
	        }
	        constrain(value) {
	            return this.constraints.reduce((result, c) => {
	                return c.constrain(result);
	            }, value);
	        }
	    }
	    function findConstraint(c, constraintClass) {
	        if (c instanceof constraintClass) {
	            return c;
	        }
	        if (c instanceof CompositeConstraint) {
	            const result = c.constraints.reduce((tmpResult, sc) => {
	                if (tmpResult) {
	                    return tmpResult;
	                }
	                return sc instanceof constraintClass ? sc : null;
	            }, null);
	            if (result) {
	                return result;
	            }
	        }
	        return null;
	    }

	    class DefiniteRangeConstraint {
	        constructor(config) {
	            this.values = ValueMap.fromObject({
	                max: config.max,
	                min: config.min,
	            });
	        }
	        constrain(value) {
	            const max = this.values.get('max');
	            const min = this.values.get('min');
	            return Math.min(Math.max(value, min), max);
	        }
	    }

	    class RangeConstraint {
	        constructor(config) {
	            this.values = ValueMap.fromObject({
	                max: config.max,
	                min: config.min,
	            });
	        }
	        get maxValue() {
	            return this.values.get('max');
	        }
	        get minValue() {
	            return this.values.get('min');
	        }
	        constrain(value) {
	            const max = this.values.get('max');
	            const min = this.values.get('min');
	            let result = value;
	            if (!isEmpty(min)) {
	                result = Math.max(result, min);
	            }
	            if (!isEmpty(max)) {
	                result = Math.min(result, max);
	            }
	            return result;
	        }
	    }

	    class StepConstraint {
	        constructor(step, origin = 0) {
	            this.step = step;
	            this.origin = origin;
	        }
	        constrain(value) {
	            const o = this.origin % this.step;
	            const r = Math.round((value - o) / this.step);
	            return o + r * this.step;
	        }
	    }

	    const className$c = ClassName('pop');
	    class PopupView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$c());
	            config.viewProps.bindClassModifiers(this.element);
	            bindValue(config.shows, valueToClassName(this.element, className$c(undefined, 'v')));
	        }
	    }

	    class PopupController {
	        constructor(doc, config) {
	            this.shows = createValue(false);
	            this.viewProps = config.viewProps;
	            this.view = new PopupView(doc, {
	                shows: this.shows,
	                viewProps: this.viewProps,
	            });
	        }
	    }

	    const className$b = ClassName('txt');
	    class TextView {
	        constructor(doc, config) {
	            this.onChange_ = this.onChange_.bind(this);
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$b());
	            config.viewProps.bindClassModifiers(this.element);
	            this.props_ = config.props;
	            this.props_.emitter.on('change', this.onChange_);
	            const inputElem = doc.createElement('input');
	            inputElem.classList.add(className$b('i'));
	            inputElem.type = 'text';
	            config.viewProps.bindDisabled(inputElem);
	            this.element.appendChild(inputElem);
	            this.inputElement = inputElem;
	            config.value.emitter.on('change', this.onChange_);
	            this.value_ = config.value;
	            this.refresh();
	        }
	        refresh() {
	            const formatter = this.props_.get('formatter');
	            this.inputElement.value = formatter(this.value_.rawValue);
	        }
	        onChange_() {
	            this.refresh();
	        }
	    }

	    class TextController {
	        constructor(doc, config) {
	            this.onInputChange_ = this.onInputChange_.bind(this);
	            this.parser_ = config.parser;
	            this.props = config.props;
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.view = new TextView(doc, {
	                props: config.props,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.view.inputElement.addEventListener('change', this.onInputChange_);
	        }
	        onInputChange_(e) {
	            const inputElem = forceCast(e.currentTarget);
	            const value = inputElem.value;
	            const parsedValue = this.parser_(value);
	            if (!isEmpty(parsedValue)) {
	                this.value.rawValue = parsedValue;
	            }
	            this.view.refresh();
	        }
	    }

	    function boolFromUnknown(value) {
	        if (value === 'false') {
	            return false;
	        }
	        return !!value;
	    }

	    class NumberLiteralNode {
	        constructor(text) {
	            this.text = text;
	        }
	        evaluate() {
	            return Number(this.text);
	        }
	        toString() {
	            return this.text;
	        }
	    }
	    const BINARY_OPERATION_MAP = {
	        '**': (v1, v2) => Math.pow(v1, v2),
	        '*': (v1, v2) => v1 * v2,
	        '/': (v1, v2) => v1 / v2,
	        '%': (v1, v2) => v1 % v2,
	        '+': (v1, v2) => v1 + v2,
	        '-': (v1, v2) => v1 - v2,
	        '<<': (v1, v2) => v1 << v2,
	        '>>': (v1, v2) => v1 >> v2,
	        '>>>': (v1, v2) => v1 >>> v2,
	        '&': (v1, v2) => v1 & v2,
	        '^': (v1, v2) => v1 ^ v2,
	        '|': (v1, v2) => v1 | v2,
	    };
	    class BinaryOperationNode {
	        constructor(operator, left, right) {
	            this.left = left;
	            this.operator = operator;
	            this.right = right;
	        }
	        evaluate() {
	            const op = BINARY_OPERATION_MAP[this.operator];
	            if (!op) {
	                throw new Error(`unexpected binary operator: '${this.operator}`);
	            }
	            return op(this.left.evaluate(), this.right.evaluate());
	        }
	        toString() {
	            return [
	                'b(',
	                this.left.toString(),
	                this.operator,
	                this.right.toString(),
	                ')',
	            ].join(' ');
	        }
	    }
	    const UNARY_OPERATION_MAP = {
	        '+': (v) => v,
	        '-': (v) => -v,
	        '~': (v) => ~v,
	    };
	    class UnaryOperationNode {
	        constructor(operator, expr) {
	            this.operator = operator;
	            this.expression = expr;
	        }
	        evaluate() {
	            const op = UNARY_OPERATION_MAP[this.operator];
	            if (!op) {
	                throw new Error(`unexpected unary operator: '${this.operator}`);
	            }
	            return op(this.expression.evaluate());
	        }
	        toString() {
	            return ['u(', this.operator, this.expression.toString(), ')'].join(' ');
	        }
	    }

	    function combineReader(parsers) {
	        return (text, cursor) => {
	            for (let i = 0; i < parsers.length; i++) {
	                const result = parsers[i](text, cursor);
	                if (result !== '') {
	                    return result;
	                }
	            }
	            return '';
	        };
	    }
	    function readWhitespace(text, cursor) {
	        var _a;
	        const m = text.substr(cursor).match(/^\s+/);
	        return (_a = (m && m[0])) !== null && _a !== void 0 ? _a : '';
	    }
	    function readNonZeroDigit(text, cursor) {
	        const ch = text.substr(cursor, 1);
	        return ch.match(/^[1-9]$/) ? ch : '';
	    }
	    function readDecimalDigits(text, cursor) {
	        var _a;
	        const m = text.substr(cursor).match(/^[0-9]+/);
	        return (_a = (m && m[0])) !== null && _a !== void 0 ? _a : '';
	    }
	    function readSignedInteger(text, cursor) {
	        const ds = readDecimalDigits(text, cursor);
	        if (ds !== '') {
	            return ds;
	        }
	        const sign = text.substr(cursor, 1);
	        cursor += 1;
	        if (sign !== '-' && sign !== '+') {
	            return '';
	        }
	        const sds = readDecimalDigits(text, cursor);
	        if (sds === '') {
	            return '';
	        }
	        return sign + sds;
	    }
	    function readExponentPart(text, cursor) {
	        const e = text.substr(cursor, 1);
	        cursor += 1;
	        if (e.toLowerCase() !== 'e') {
	            return '';
	        }
	        const si = readSignedInteger(text, cursor);
	        if (si === '') {
	            return '';
	        }
	        return e + si;
	    }
	    function readDecimalIntegerLiteral(text, cursor) {
	        const ch = text.substr(cursor, 1);
	        if (ch === '0') {
	            return ch;
	        }
	        const nzd = readNonZeroDigit(text, cursor);
	        cursor += nzd.length;
	        if (nzd === '') {
	            return '';
	        }
	        return nzd + readDecimalDigits(text, cursor);
	    }
	    function readDecimalLiteral1(text, cursor) {
	        const dil = readDecimalIntegerLiteral(text, cursor);
	        cursor += dil.length;
	        if (dil === '') {
	            return '';
	        }
	        const dot = text.substr(cursor, 1);
	        cursor += dot.length;
	        if (dot !== '.') {
	            return '';
	        }
	        const dds = readDecimalDigits(text, cursor);
	        cursor += dds.length;
	        return dil + dot + dds + readExponentPart(text, cursor);
	    }
	    function readDecimalLiteral2(text, cursor) {
	        const dot = text.substr(cursor, 1);
	        cursor += dot.length;
	        if (dot !== '.') {
	            return '';
	        }
	        const dds = readDecimalDigits(text, cursor);
	        cursor += dds.length;
	        if (dds === '') {
	            return '';
	        }
	        return dot + dds + readExponentPart(text, cursor);
	    }
	    function readDecimalLiteral3(text, cursor) {
	        const dil = readDecimalIntegerLiteral(text, cursor);
	        cursor += dil.length;
	        if (dil === '') {
	            return '';
	        }
	        return dil + readExponentPart(text, cursor);
	    }
	    const readDecimalLiteral = combineReader([
	        readDecimalLiteral1,
	        readDecimalLiteral2,
	        readDecimalLiteral3,
	    ]);
	    function parseBinaryDigits(text, cursor) {
	        var _a;
	        const m = text.substr(cursor).match(/^[01]+/);
	        return (_a = (m && m[0])) !== null && _a !== void 0 ? _a : '';
	    }
	    function readBinaryIntegerLiteral(text, cursor) {
	        const prefix = text.substr(cursor, 2);
	        cursor += prefix.length;
	        if (prefix.toLowerCase() !== '0b') {
	            return '';
	        }
	        const bds = parseBinaryDigits(text, cursor);
	        if (bds === '') {
	            return '';
	        }
	        return prefix + bds;
	    }
	    function readOctalDigits(text, cursor) {
	        var _a;
	        const m = text.substr(cursor).match(/^[0-7]+/);
	        return (_a = (m && m[0])) !== null && _a !== void 0 ? _a : '';
	    }
	    function readOctalIntegerLiteral(text, cursor) {
	        const prefix = text.substr(cursor, 2);
	        cursor += prefix.length;
	        if (prefix.toLowerCase() !== '0o') {
	            return '';
	        }
	        const ods = readOctalDigits(text, cursor);
	        if (ods === '') {
	            return '';
	        }
	        return prefix + ods;
	    }
	    function readHexDigits(text, cursor) {
	        var _a;
	        const m = text.substr(cursor).match(/^[0-9a-f]+/i);
	        return (_a = (m && m[0])) !== null && _a !== void 0 ? _a : '';
	    }
	    function readHexIntegerLiteral(text, cursor) {
	        const prefix = text.substr(cursor, 2);
	        cursor += prefix.length;
	        if (prefix.toLowerCase() !== '0x') {
	            return '';
	        }
	        const hds = readHexDigits(text, cursor);
	        if (hds === '') {
	            return '';
	        }
	        return prefix + hds;
	    }
	    const readNonDecimalIntegerLiteral = combineReader([
	        readBinaryIntegerLiteral,
	        readOctalIntegerLiteral,
	        readHexIntegerLiteral,
	    ]);
	    const readNumericLiteral = combineReader([
	        readNonDecimalIntegerLiteral,
	        readDecimalLiteral,
	    ]);

	    function parseLiteral(text, cursor) {
	        const num = readNumericLiteral(text, cursor);
	        cursor += num.length;
	        if (num === '') {
	            return null;
	        }
	        return {
	            evaluable: new NumberLiteralNode(num),
	            cursor: cursor,
	        };
	    }
	    function parseParenthesizedExpression(text, cursor) {
	        const op = text.substr(cursor, 1);
	        cursor += op.length;
	        if (op !== '(') {
	            return null;
	        }
	        const expr = parseExpression(text, cursor);
	        if (!expr) {
	            return null;
	        }
	        cursor = expr.cursor;
	        cursor += readWhitespace(text, cursor).length;
	        const cl = text.substr(cursor, 1);
	        cursor += cl.length;
	        if (cl !== ')') {
	            return null;
	        }
	        return {
	            evaluable: expr.evaluable,
	            cursor: cursor,
	        };
	    }
	    function parsePrimaryExpression(text, cursor) {
	        var _a;
	        return ((_a = parseLiteral(text, cursor)) !== null && _a !== void 0 ? _a : parseParenthesizedExpression(text, cursor));
	    }
	    function parseUnaryExpression(text, cursor) {
	        const expr = parsePrimaryExpression(text, cursor);
	        if (expr) {
	            return expr;
	        }
	        const op = text.substr(cursor, 1);
	        cursor += op.length;
	        if (op !== '+' && op !== '-' && op !== '~') {
	            return null;
	        }
	        const num = parseUnaryExpression(text, cursor);
	        if (!num) {
	            return null;
	        }
	        cursor = num.cursor;
	        return {
	            cursor: cursor,
	            evaluable: new UnaryOperationNode(op, num.evaluable),
	        };
	    }
	    function readBinaryOperator(ops, text, cursor) {
	        cursor += readWhitespace(text, cursor).length;
	        const op = ops.filter((op) => text.startsWith(op, cursor))[0];
	        if (!op) {
	            return null;
	        }
	        cursor += op.length;
	        cursor += readWhitespace(text, cursor).length;
	        return {
	            cursor: cursor,
	            operator: op,
	        };
	    }
	    function createBinaryOperationExpressionParser(exprParser, ops) {
	        return (text, cursor) => {
	            const firstExpr = exprParser(text, cursor);
	            if (!firstExpr) {
	                return null;
	            }
	            cursor = firstExpr.cursor;
	            let expr = firstExpr.evaluable;
	            for (;;) {
	                const op = readBinaryOperator(ops, text, cursor);
	                if (!op) {
	                    break;
	                }
	                cursor = op.cursor;
	                const nextExpr = exprParser(text, cursor);
	                if (!nextExpr) {
	                    return null;
	                }
	                cursor = nextExpr.cursor;
	                expr = new BinaryOperationNode(op.operator, expr, nextExpr.evaluable);
	            }
	            return expr
	                ? {
	                    cursor: cursor,
	                    evaluable: expr,
	                }
	                : null;
	        };
	    }
	    const parseBinaryOperationExpression = [
	        ['**'],
	        ['*', '/', '%'],
	        ['+', '-'],
	        ['<<', '>>>', '>>'],
	        ['&'],
	        ['^'],
	        ['|'],
	    ].reduce((parser, ops) => {
	        return createBinaryOperationExpressionParser(parser, ops);
	    }, parseUnaryExpression);
	    function parseExpression(text, cursor) {
	        cursor += readWhitespace(text, cursor).length;
	        return parseBinaryOperationExpression(text, cursor);
	    }
	    function parseEcmaNumberExpression(text) {
	        const expr = parseExpression(text, 0);
	        if (!expr) {
	            return null;
	        }
	        const cursor = expr.cursor + readWhitespace(text, expr.cursor).length;
	        if (cursor !== text.length) {
	            return null;
	        }
	        return expr.evaluable;
	    }

	    function parseNumber(text) {
	        var _a;
	        const r = parseEcmaNumberExpression(text);
	        return (_a = r === null || r === void 0 ? void 0 : r.evaluate()) !== null && _a !== void 0 ? _a : null;
	    }
	    function numberFromUnknown(value) {
	        if (typeof value === 'number') {
	            return value;
	        }
	        if (typeof value === 'string') {
	            const pv = parseNumber(value);
	            if (!isEmpty(pv)) {
	                return pv;
	            }
	        }
	        return 0;
	    }
	    function createNumberFormatter(digits) {
	        return (value) => {
	            return value.toFixed(Math.max(Math.min(digits, 20), 0));
	        };
	    }

	    const innerFormatter = createNumberFormatter(0);
	    function formatPercentage(value) {
	        return innerFormatter(value) + '%';
	    }

	    function stringFromUnknown(value) {
	        return String(value);
	    }

	    function fillBuffer(buffer, bufferSize) {
	        while (buffer.length < bufferSize) {
	            buffer.push(undefined);
	        }
	    }
	    function initializeBuffer(bufferSize) {
	        const buffer = [];
	        fillBuffer(buffer, bufferSize);
	        return createValue(buffer);
	    }
	    function createTrimmedBuffer(buffer) {
	        const index = buffer.indexOf(undefined);
	        return forceCast(index < 0 ? buffer : buffer.slice(0, index));
	    }
	    function createPushedBuffer(buffer, newValue) {
	        const newBuffer = [...createTrimmedBuffer(buffer), newValue];
	        if (newBuffer.length > buffer.length) {
	            newBuffer.splice(0, newBuffer.length - buffer.length);
	        }
	        else {
	            fillBuffer(newBuffer, buffer.length);
	        }
	        return newBuffer;
	    }

	    function connectValues({ primary, secondary, forward, backward, }) {
	        let changing = false;
	        function preventFeedback(callback) {
	            if (changing) {
	                return;
	            }
	            changing = true;
	            callback();
	            changing = false;
	        }
	        primary.emitter.on('change', (ev) => {
	            preventFeedback(() => {
	                secondary.setRawValue(forward(primary, secondary), ev.options);
	            });
	        });
	        secondary.emitter.on('change', (ev) => {
	            preventFeedback(() => {
	                primary.setRawValue(backward(primary, secondary), ev.options);
	            });
	            preventFeedback(() => {
	                secondary.setRawValue(forward(primary, secondary), ev.options);
	            });
	        });
	        preventFeedback(() => {
	            secondary.setRawValue(forward(primary, secondary), {
	                forceEmit: false,
	                last: true,
	            });
	        });
	    }

	    function getStepForKey(baseStep, keys) {
	        const step = baseStep * (keys.altKey ? 0.1 : 1) * (keys.shiftKey ? 10 : 1);
	        if (keys.upKey) {
	            return +step;
	        }
	        else if (keys.downKey) {
	            return -step;
	        }
	        return 0;
	    }
	    function getVerticalStepKeys(ev) {
	        return {
	            altKey: ev.altKey,
	            downKey: ev.key === 'ArrowDown',
	            shiftKey: ev.shiftKey,
	            upKey: ev.key === 'ArrowUp',
	        };
	    }
	    function getHorizontalStepKeys(ev) {
	        return {
	            altKey: ev.altKey,
	            downKey: ev.key === 'ArrowLeft',
	            shiftKey: ev.shiftKey,
	            upKey: ev.key === 'ArrowRight',
	        };
	    }
	    function isVerticalArrowKey(key) {
	        return key === 'ArrowUp' || key === 'ArrowDown';
	    }
	    function isArrowKey(key) {
	        return isVerticalArrowKey(key) || key === 'ArrowLeft' || key === 'ArrowRight';
	    }

	    function computeOffset(ev, elem) {
	        var _a, _b;
	        const win = elem.ownerDocument.defaultView;
	        const rect = elem.getBoundingClientRect();
	        return {
	            x: ev.pageX - (((_a = (win && win.scrollX)) !== null && _a !== void 0 ? _a : 0) + rect.left),
	            y: ev.pageY - (((_b = (win && win.scrollY)) !== null && _b !== void 0 ? _b : 0) + rect.top),
	        };
	    }
	    class PointerHandler {
	        constructor(element) {
	            this.lastTouch_ = null;
	            this.onDocumentMouseMove_ = this.onDocumentMouseMove_.bind(this);
	            this.onDocumentMouseUp_ = this.onDocumentMouseUp_.bind(this);
	            this.onMouseDown_ = this.onMouseDown_.bind(this);
	            this.onTouchEnd_ = this.onTouchEnd_.bind(this);
	            this.onTouchMove_ = this.onTouchMove_.bind(this);
	            this.onTouchStart_ = this.onTouchStart_.bind(this);
	            this.elem_ = element;
	            this.emitter = new Emitter();
	            element.addEventListener('touchstart', this.onTouchStart_, {
	                passive: false,
	            });
	            element.addEventListener('touchmove', this.onTouchMove_, {
	                passive: true,
	            });
	            element.addEventListener('touchend', this.onTouchEnd_);
	            element.addEventListener('mousedown', this.onMouseDown_);
	        }
	        computePosition_(offset) {
	            const rect = this.elem_.getBoundingClientRect();
	            return {
	                bounds: {
	                    width: rect.width,
	                    height: rect.height,
	                },
	                point: offset
	                    ? {
	                        x: offset.x,
	                        y: offset.y,
	                    }
	                    : null,
	            };
	        }
	        onMouseDown_(ev) {
	            var _a;
	            ev.preventDefault();
	            (_a = ev.currentTarget) === null || _a === void 0 ? void 0 : _a.focus();
	            const doc = this.elem_.ownerDocument;
	            doc.addEventListener('mousemove', this.onDocumentMouseMove_);
	            doc.addEventListener('mouseup', this.onDocumentMouseUp_);
	            this.emitter.emit('down', {
	                altKey: ev.altKey,
	                data: this.computePosition_(computeOffset(ev, this.elem_)),
	                sender: this,
	                shiftKey: ev.shiftKey,
	            });
	        }
	        onDocumentMouseMove_(ev) {
	            this.emitter.emit('move', {
	                altKey: ev.altKey,
	                data: this.computePosition_(computeOffset(ev, this.elem_)),
	                sender: this,
	                shiftKey: ev.shiftKey,
	            });
	        }
	        onDocumentMouseUp_(ev) {
	            const doc = this.elem_.ownerDocument;
	            doc.removeEventListener('mousemove', this.onDocumentMouseMove_);
	            doc.removeEventListener('mouseup', this.onDocumentMouseUp_);
	            this.emitter.emit('up', {
	                altKey: ev.altKey,
	                data: this.computePosition_(computeOffset(ev, this.elem_)),
	                sender: this,
	                shiftKey: ev.shiftKey,
	            });
	        }
	        onTouchStart_(ev) {
	            ev.preventDefault();
	            const touch = ev.targetTouches.item(0);
	            const rect = this.elem_.getBoundingClientRect();
	            this.emitter.emit('down', {
	                altKey: ev.altKey,
	                data: this.computePosition_(touch
	                    ? {
	                        x: touch.clientX - rect.left,
	                        y: touch.clientY - rect.top,
	                    }
	                    : undefined),
	                sender: this,
	                shiftKey: ev.shiftKey,
	            });
	            this.lastTouch_ = touch;
	        }
	        onTouchMove_(ev) {
	            const touch = ev.targetTouches.item(0);
	            const rect = this.elem_.getBoundingClientRect();
	            this.emitter.emit('move', {
	                altKey: ev.altKey,
	                data: this.computePosition_(touch
	                    ? {
	                        x: touch.clientX - rect.left,
	                        y: touch.clientY - rect.top,
	                    }
	                    : undefined),
	                sender: this,
	                shiftKey: ev.shiftKey,
	            });
	            this.lastTouch_ = touch;
	        }
	        onTouchEnd_(ev) {
	            var _a;
	            const touch = (_a = ev.targetTouches.item(0)) !== null && _a !== void 0 ? _a : this.lastTouch_;
	            const rect = this.elem_.getBoundingClientRect();
	            this.emitter.emit('up', {
	                altKey: ev.altKey,
	                data: this.computePosition_(touch
	                    ? {
	                        x: touch.clientX - rect.left,
	                        y: touch.clientY - rect.top,
	                    }
	                    : undefined),
	                sender: this,
	                shiftKey: ev.shiftKey,
	            });
	        }
	    }

	    function mapRange(value, start1, end1, start2, end2) {
	        const p = (value - start1) / (end1 - start1);
	        return start2 + p * (end2 - start2);
	    }
	    function getDecimalDigits(value) {
	        const text = String(value.toFixed(10));
	        const frac = text.split('.')[1];
	        return frac.replace(/0+$/, '').length;
	    }
	    function constrainRange(value, min, max) {
	        return Math.min(Math.max(value, min), max);
	    }

	    const className$a = ClassName('txt');
	    class NumberTextView {
	        constructor(doc, config) {
	            this.onChange_ = this.onChange_.bind(this);
	            this.props_ = config.props;
	            this.props_.emitter.on('change', this.onChange_);
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$a(), className$a(undefined, 'num'));
	            if (config.arrayPosition) {
	                this.element.classList.add(className$a(undefined, config.arrayPosition));
	            }
	            config.viewProps.bindClassModifiers(this.element);
	            const inputElem = doc.createElement('input');
	            inputElem.classList.add(className$a('i'));
	            inputElem.type = 'text';
	            config.viewProps.bindDisabled(inputElem);
	            this.element.appendChild(inputElem);
	            this.inputElement = inputElem;
	            this.onDraggingChange_ = this.onDraggingChange_.bind(this);
	            this.dragging_ = config.dragging;
	            this.dragging_.emitter.on('change', this.onDraggingChange_);
	            this.element.classList.add(className$a());
	            this.inputElement.classList.add(className$a('i'));
	            const knobElem = doc.createElement('div');
	            knobElem.classList.add(className$a('k'));
	            this.element.appendChild(knobElem);
	            this.knobElement = knobElem;
	            const guideElem = doc.createElementNS(SVG_NS, 'svg');
	            guideElem.classList.add(className$a('g'));
	            this.knobElement.appendChild(guideElem);
	            const bodyElem = doc.createElementNS(SVG_NS, 'path');
	            bodyElem.classList.add(className$a('gb'));
	            guideElem.appendChild(bodyElem);
	            this.guideBodyElem_ = bodyElem;
	            const headElem = doc.createElementNS(SVG_NS, 'path');
	            headElem.classList.add(className$a('gh'));
	            guideElem.appendChild(headElem);
	            this.guideHeadElem_ = headElem;
	            const tooltipElem = doc.createElement('div');
	            tooltipElem.classList.add(ClassName('tt')());
	            this.knobElement.appendChild(tooltipElem);
	            this.tooltipElem_ = tooltipElem;
	            config.value.emitter.on('change', this.onChange_);
	            this.value = config.value;
	            this.refresh();
	        }
	        onDraggingChange_(ev) {
	            if (ev.rawValue === null) {
	                this.element.classList.remove(className$a(undefined, 'drg'));
	                return;
	            }
	            this.element.classList.add(className$a(undefined, 'drg'));
	            const x = ev.rawValue / this.props_.get('draggingScale');
	            const aox = x + (x > 0 ? -1 : x < 0 ? +1 : 0);
	            const adx = constrainRange(-aox, -4, +4);
	            this.guideHeadElem_.setAttributeNS(null, 'd', [`M ${aox + adx},0 L${aox},4 L${aox + adx},8`, `M ${x},-1 L${x},9`].join(' '));
	            this.guideBodyElem_.setAttributeNS(null, 'd', `M 0,4 L${x},4`);
	            const formatter = this.props_.get('formatter');
	            this.tooltipElem_.textContent = formatter(this.value.rawValue);
	            this.tooltipElem_.style.left = `${x}px`;
	        }
	        refresh() {
	            const formatter = this.props_.get('formatter');
	            this.inputElement.value = formatter(this.value.rawValue);
	        }
	        onChange_() {
	            this.refresh();
	        }
	    }

	    class NumberTextController {
	        constructor(doc, config) {
	            var _a;
	            this.originRawValue_ = 0;
	            this.onInputChange_ = this.onInputChange_.bind(this);
	            this.onInputKeyDown_ = this.onInputKeyDown_.bind(this);
	            this.onInputKeyUp_ = this.onInputKeyUp_.bind(this);
	            this.onPointerDown_ = this.onPointerDown_.bind(this);
	            this.onPointerMove_ = this.onPointerMove_.bind(this);
	            this.onPointerUp_ = this.onPointerUp_.bind(this);
	            this.baseStep_ = config.baseStep;
	            this.parser_ = config.parser;
	            this.props = config.props;
	            this.sliderProps_ = (_a = config.sliderProps) !== null && _a !== void 0 ? _a : null;
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.dragging_ = createValue(null);
	            this.view = new NumberTextView(doc, {
	                arrayPosition: config.arrayPosition,
	                dragging: this.dragging_,
	                props: this.props,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.view.inputElement.addEventListener('change', this.onInputChange_);
	            this.view.inputElement.addEventListener('keydown', this.onInputKeyDown_);
	            this.view.inputElement.addEventListener('keyup', this.onInputKeyUp_);
	            const ph = new PointerHandler(this.view.knobElement);
	            ph.emitter.on('down', this.onPointerDown_);
	            ph.emitter.on('move', this.onPointerMove_);
	            ph.emitter.on('up', this.onPointerUp_);
	        }
	        constrainValue_(value) {
	            var _a, _b;
	            const min = (_a = this.sliderProps_) === null || _a === void 0 ? void 0 : _a.get('minValue');
	            const max = (_b = this.sliderProps_) === null || _b === void 0 ? void 0 : _b.get('maxValue');
	            let v = value;
	            if (min !== undefined) {
	                v = Math.max(v, min);
	            }
	            if (max !== undefined) {
	                v = Math.min(v, max);
	            }
	            return v;
	        }
	        onInputChange_(e) {
	            const inputElem = forceCast(e.currentTarget);
	            const value = inputElem.value;
	            const parsedValue = this.parser_(value);
	            if (!isEmpty(parsedValue)) {
	                this.value.rawValue = this.constrainValue_(parsedValue);
	            }
	            this.view.refresh();
	        }
	        onInputKeyDown_(ev) {
	            const step = getStepForKey(this.baseStep_, getVerticalStepKeys(ev));
	            if (step === 0) {
	                return;
	            }
	            this.value.setRawValue(this.constrainValue_(this.value.rawValue + step), {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onInputKeyUp_(ev) {
	            const step = getStepForKey(this.baseStep_, getVerticalStepKeys(ev));
	            if (step === 0) {
	                return;
	            }
	            this.value.setRawValue(this.value.rawValue, {
	                forceEmit: true,
	                last: true,
	            });
	        }
	        onPointerDown_() {
	            this.originRawValue_ = this.value.rawValue;
	            this.dragging_.rawValue = 0;
	        }
	        computeDraggingValue_(data) {
	            if (!data.point) {
	                return null;
	            }
	            const dx = data.point.x - data.bounds.width / 2;
	            return this.constrainValue_(this.originRawValue_ + dx * this.props.get('draggingScale'));
	        }
	        onPointerMove_(ev) {
	            const v = this.computeDraggingValue_(ev.data);
	            if (v === null) {
	                return;
	            }
	            this.value.setRawValue(v, {
	                forceEmit: false,
	                last: false,
	            });
	            this.dragging_.rawValue = this.value.rawValue - this.originRawValue_;
	        }
	        onPointerUp_(ev) {
	            const v = this.computeDraggingValue_(ev.data);
	            if (v === null) {
	                return;
	            }
	            this.value.setRawValue(v, {
	                forceEmit: true,
	                last: true,
	            });
	            this.dragging_.rawValue = null;
	        }
	    }

	    function writePrimitive(target, value) {
	        target.write(value);
	    }

	    function findStep(constraint) {
	        const c = constraint ? findConstraint(constraint, StepConstraint) : null;
	        if (!c) {
	            return null;
	        }
	        return c.step;
	    }
	    function getSuitableDecimalDigits(constraint, rawValue) {
	        const sc = constraint && findConstraint(constraint, StepConstraint);
	        if (sc) {
	            return getDecimalDigits(sc.step);
	        }
	        return Math.max(getDecimalDigits(rawValue), 2);
	    }
	    function getBaseStep(constraint) {
	        const step = findStep(constraint);
	        return step !== null && step !== void 0 ? step : 1;
	    }
	    function getSuitableDraggingScale(constraint, rawValue) {
	        var _a;
	        const sc = constraint && findConstraint(constraint, StepConstraint);
	        const base = Math.abs((_a = sc === null || sc === void 0 ? void 0 : sc.step) !== null && _a !== void 0 ? _a : rawValue);
	        return base === 0 ? 0.1 : Math.pow(10, Math.floor(Math.log10(base)) - 1);
	    }

	    function removeAlphaComponent(comps) {
	        return [comps[0], comps[1], comps[2]];
	    }

	    function zerofill(comp) {
	        const hex = constrainRange(Math.floor(comp), 0, 255).toString(16);
	        return hex.length === 1 ? `0${hex}` : hex;
	    }
	    function colorToHexRgbString(value, prefix = '#') {
	        const hexes = removeAlphaComponent(value.getComponents('rgb'))
	            .map(zerofill)
	            .join('');
	        return `${prefix}${hexes}`;
	    }
	    function colorToHexRgbaString(value, prefix = '#') {
	        const rgbaComps = value.getComponents('rgb');
	        const hexes = [rgbaComps[0], rgbaComps[1], rgbaComps[2], rgbaComps[3] * 255]
	            .map(zerofill)
	            .join('');
	        return `${prefix}${hexes}`;
	    }
	    function colorToFunctionalRgbString(value, opt_type) {
	        const formatter = createNumberFormatter(opt_type === 'float' ? 2 : 0);
	        const comps = removeAlphaComponent(value.getComponents('rgb', opt_type)).map((comp) => formatter(comp));
	        return `rgb(${comps.join(', ')})`;
	    }
	    function createFunctionalRgbColorFormatter(type) {
	        return (value) => {
	            return colorToFunctionalRgbString(value, type);
	        };
	    }
	    function colorToFunctionalRgbaString(value, opt_type) {
	        const aFormatter = createNumberFormatter(2);
	        const rgbFormatter = createNumberFormatter(opt_type === 'float' ? 2 : 0);
	        const comps = value.getComponents('rgb', opt_type).map((comp, index) => {
	            const formatter = index === 3 ? aFormatter : rgbFormatter;
	            return formatter(comp);
	        });
	        return `rgba(${comps.join(', ')})`;
	    }
	    function createFunctionalRgbaColorFormatter(type) {
	        return (value) => {
	            return colorToFunctionalRgbaString(value, type);
	        };
	    }
	    function colorToFunctionalHslString(value) {
	        const formatters = [
	            createNumberFormatter(0),
	            formatPercentage,
	            formatPercentage,
	        ];
	        const comps = removeAlphaComponent(value.getComponents('hsl')).map((comp, index) => formatters[index](comp));
	        return `hsl(${comps.join(', ')})`;
	    }
	    function colorToFunctionalHslaString(value) {
	        const formatters = [
	            createNumberFormatter(0),
	            formatPercentage,
	            formatPercentage,
	            createNumberFormatter(2),
	        ];
	        const comps = value
	            .getComponents('hsl')
	            .map((comp, index) => formatters[index](comp));
	        return `hsla(${comps.join(', ')})`;
	    }
	    function colorToObjectRgbString(value, type) {
	        const formatter = createNumberFormatter(type === 'float' ? 2 : 0);
	        const names = ['r', 'g', 'b'];
	        const comps = removeAlphaComponent(value.getComponents('rgb', type)).map((comp, index) => `${names[index]}: ${formatter(comp)}`);
	        return `{${comps.join(', ')}}`;
	    }
	    function createObjectRgbColorFormatter(type) {
	        return (value) => colorToObjectRgbString(value, type);
	    }
	    function colorToObjectRgbaString(value, type) {
	        const aFormatter = createNumberFormatter(2);
	        const rgbFormatter = createNumberFormatter(type === 'float' ? 2 : 0);
	        const names = ['r', 'g', 'b', 'a'];
	        const comps = value.getComponents('rgb', type).map((comp, index) => {
	            const formatter = index === 3 ? aFormatter : rgbFormatter;
	            return `${names[index]}: ${formatter(comp)}`;
	        });
	        return `{${comps.join(', ')}}`;
	    }
	    function createObjectRgbaColorFormatter(type) {
	        return (value) => colorToObjectRgbaString(value, type);
	    }
	    [
	        {
	            format: {
	                alpha: false,
	                mode: 'rgb',
	                notation: 'hex',
	                type: 'int',
	            },
	            stringifier: colorToHexRgbString,
	        },
	        {
	            format: {
	                alpha: true,
	                mode: 'rgb',
	                notation: 'hex',
	                type: 'int',
	            },
	            stringifier: colorToHexRgbaString,
	        },
	        {
	            format: {
	                alpha: false,
	                mode: 'hsl',
	                notation: 'func',
	                type: 'int',
	            },
	            stringifier: colorToFunctionalHslString,
	        },
	        {
	            format: {
	                alpha: true,
	                mode: 'hsl',
	                notation: 'func',
	                type: 'int',
	            },
	            stringifier: colorToFunctionalHslaString,
	        },
	        ...['int', 'float'].reduce((prev, type) => {
	            return [
	                ...prev,
	                {
	                    format: {
	                        alpha: false,
	                        mode: 'rgb',
	                        notation: 'func',
	                        type: type,
	                    },
	                    stringifier: createFunctionalRgbColorFormatter(type),
	                },
	                {
	                    format: {
	                        alpha: true,
	                        mode: 'rgb',
	                        notation: 'func',
	                        type: type,
	                    },
	                    stringifier: createFunctionalRgbaColorFormatter(type),
	                },
	                {
	                    format: {
	                        alpha: false,
	                        mode: 'rgb',
	                        notation: 'object',
	                        type: type,
	                    },
	                    stringifier: createObjectRgbColorFormatter(type),
	                },
	                {
	                    format: {
	                        alpha: true,
	                        mode: 'rgb',
	                        notation: 'object',
	                        type: type,
	                    },
	                    stringifier: createObjectRgbaColorFormatter(type),
	                },
	            ];
	        }, []),
	    ];

	    class PointNdConstraint {
	        constructor(config) {
	            this.components = config.components;
	            this.asm_ = config.assembly;
	        }
	        constrain(value) {
	            const comps = this.asm_
	                .toComponents(value)
	                .map((comp, index) => { var _a, _b; return (_b = (_a = this.components[index]) === null || _a === void 0 ? void 0 : _a.constrain(comp)) !== null && _b !== void 0 ? _b : comp; });
	            return this.asm_.fromComponents(comps);
	        }
	    }

	    const className$9 = ClassName('pndtxt');
	    class PointNdTextView {
	        constructor(doc, config) {
	            this.textViews = config.textViews;
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$9());
	            this.textViews.forEach((v) => {
	                const axisElem = doc.createElement('div');
	                axisElem.classList.add(className$9('a'));
	                axisElem.appendChild(v.element);
	                this.element.appendChild(axisElem);
	            });
	        }
	    }

	    function createAxisController(doc, config, index) {
	        return new NumberTextController(doc, {
	            arrayPosition: index === 0 ? 'fst' : index === config.axes.length - 1 ? 'lst' : 'mid',
	            baseStep: config.axes[index].baseStep,
	            parser: config.parser,
	            props: config.axes[index].textProps,
	            value: createValue(0, {
	                constraint: config.axes[index].constraint,
	            }),
	            viewProps: config.viewProps,
	        });
	    }
	    class PointNdTextController {
	        constructor(doc, config) {
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.acs_ = config.axes.map((_, index) => createAxisController(doc, config, index));
	            this.acs_.forEach((c, index) => {
	                connectValues({
	                    primary: this.value,
	                    secondary: c.value,
	                    forward: (p) => {
	                        return config.assembly.toComponents(p.rawValue)[index];
	                    },
	                    backward: (p, s) => {
	                        const comps = config.assembly.toComponents(p.rawValue);
	                        comps[index] = s.rawValue;
	                        return config.assembly.fromComponents(comps);
	                    },
	                });
	            });
	            this.view = new PointNdTextView(doc, {
	                textViews: this.acs_.map((ac) => ac.view),
	            });
	        }
	    }

	    function createStepConstraint(params, initialValue) {
	        if ('step' in params && !isEmpty(params.step)) {
	            return new StepConstraint(params.step, initialValue);
	        }
	        return null;
	    }
	    function createRangeConstraint(params) {
	        if (!isEmpty(params.max) && !isEmpty(params.min)) {
	            return new DefiniteRangeConstraint({
	                max: params.max,
	                min: params.min,
	            });
	        }
	        if (!isEmpty(params.max) || !isEmpty(params.min)) {
	            return new RangeConstraint({
	                max: params.max,
	                min: params.min,
	            });
	        }
	        return null;
	    }

	    const Constants = {
	        monitor: {
	            defaultInterval: 200,
	            defaultLineCount: 3,
	        },
	    };

	    const className$8 = ClassName('grl');
	    class GraphLogView {
	        constructor(doc, config) {
	            this.onCursorChange_ = this.onCursorChange_.bind(this);
	            this.onValueUpdate_ = this.onValueUpdate_.bind(this);
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$8());
	            config.viewProps.bindClassModifiers(this.element);
	            this.formatter_ = config.formatter;
	            this.props_ = config.props;
	            this.cursor_ = config.cursor;
	            this.cursor_.emitter.on('change', this.onCursorChange_);
	            const svgElem = doc.createElementNS(SVG_NS, 'svg');
	            svgElem.classList.add(className$8('g'));
	            svgElem.style.height = `calc(var(--bld-us) * ${config.lineCount})`;
	            this.element.appendChild(svgElem);
	            this.svgElem_ = svgElem;
	            const lineElem = doc.createElementNS(SVG_NS, 'polyline');
	            this.svgElem_.appendChild(lineElem);
	            this.lineElem_ = lineElem;
	            const tooltipElem = doc.createElement('div');
	            tooltipElem.classList.add(className$8('t'), ClassName('tt')());
	            this.element.appendChild(tooltipElem);
	            this.tooltipElem_ = tooltipElem;
	            config.value.emitter.on('change', this.onValueUpdate_);
	            this.value = config.value;
	            this.update_();
	        }
	        get graphElement() {
	            return this.svgElem_;
	        }
	        update_() {
	            const bounds = this.svgElem_.getBoundingClientRect();
	            const maxIndex = this.value.rawValue.length - 1;
	            const min = this.props_.get('minValue');
	            const max = this.props_.get('maxValue');
	            const points = [];
	            this.value.rawValue.forEach((v, index) => {
	                if (v === undefined) {
	                    return;
	                }
	                const x = mapRange(index, 0, maxIndex, 0, bounds.width);
	                const y = mapRange(v, min, max, bounds.height, 0);
	                points.push([x, y].join(','));
	            });
	            this.lineElem_.setAttributeNS(null, 'points', points.join(' '));
	            const tooltipElem = this.tooltipElem_;
	            const value = this.value.rawValue[this.cursor_.rawValue];
	            if (value === undefined) {
	                tooltipElem.classList.remove(className$8('t', 'a'));
	                return;
	            }
	            const tx = mapRange(this.cursor_.rawValue, 0, maxIndex, 0, bounds.width);
	            const ty = mapRange(value, min, max, bounds.height, 0);
	            tooltipElem.style.left = `${tx}px`;
	            tooltipElem.style.top = `${ty}px`;
	            tooltipElem.textContent = `${this.formatter_(value)}`;
	            if (!tooltipElem.classList.contains(className$8('t', 'a'))) {
	                tooltipElem.classList.add(className$8('t', 'a'), className$8('t', 'in'));
	                forceReflow(tooltipElem);
	                tooltipElem.classList.remove(className$8('t', 'in'));
	            }
	        }
	        onValueUpdate_() {
	            this.update_();
	        }
	        onCursorChange_() {
	            this.update_();
	        }
	    }

	    class GraphLogController {
	        constructor(doc, config) {
	            this.onGraphMouseMove_ = this.onGraphMouseMove_.bind(this);
	            this.onGraphMouseLeave_ = this.onGraphMouseLeave_.bind(this);
	            this.onGraphPointerDown_ = this.onGraphPointerDown_.bind(this);
	            this.onGraphPointerMove_ = this.onGraphPointerMove_.bind(this);
	            this.onGraphPointerUp_ = this.onGraphPointerUp_.bind(this);
	            this.props_ = config.props;
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.cursor_ = createValue(-1);
	            this.view = new GraphLogView(doc, {
	                cursor: this.cursor_,
	                formatter: config.formatter,
	                lineCount: config.lineCount,
	                props: this.props_,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            if (!supportsTouch(doc)) {
	                this.view.element.addEventListener('mousemove', this.onGraphMouseMove_);
	                this.view.element.addEventListener('mouseleave', this.onGraphMouseLeave_);
	            }
	            else {
	                const ph = new PointerHandler(this.view.element);
	                ph.emitter.on('down', this.onGraphPointerDown_);
	                ph.emitter.on('move', this.onGraphPointerMove_);
	                ph.emitter.on('up', this.onGraphPointerUp_);
	            }
	        }
	        onGraphMouseLeave_() {
	            this.cursor_.rawValue = -1;
	        }
	        onGraphMouseMove_(ev) {
	            const bounds = this.view.element.getBoundingClientRect();
	            this.cursor_.rawValue = Math.floor(mapRange(ev.offsetX, 0, bounds.width, 0, this.value.rawValue.length));
	        }
	        onGraphPointerDown_(ev) {
	            this.onGraphPointerMove_(ev);
	        }
	        onGraphPointerMove_(ev) {
	            if (!ev.data.point) {
	                this.cursor_.rawValue = -1;
	                return;
	            }
	            this.cursor_.rawValue = Math.floor(mapRange(ev.data.point.x, 0, ev.data.bounds.width, 0, this.value.rawValue.length));
	        }
	        onGraphPointerUp_() {
	            this.cursor_.rawValue = -1;
	        }
	    }

	    class ButtonCellApi {
	        constructor(controller) {
	            this.controller_ = controller;
	        }
	        get disabled() {
	            return this.controller_.viewProps.get('disabled');
	        }
	        set disabled(disabled) {
	            this.controller_.viewProps.set('disabled', disabled);
	        }
	        get title() {
	            var _a;
	            return (_a = this.controller_.props.get('title')) !== null && _a !== void 0 ? _a : '';
	        }
	        set title(title) {
	            this.controller_.props.set('title', title);
	        }
	        on(eventName, handler) {
	            const bh = handler.bind(this);
	            const emitter = this.controller_.emitter;
	            emitter.on(eventName, () => {
	                bh(new TpEvent(this));
	            });
	            return this;
	        }
	    }

	    class TpButtonGridEvent extends TpEvent {
	        constructor(target, cell, index) {
	            super(target);
	            this.cell = cell;
	            this.index = index;
	        }
	    }

	    class ButtonGridApi extends BladeApi {
	        constructor(controller) {
	            super(controller);
	            this.cellToApiMap_ = new Map();
	            this.emitter_ = new Emitter();
	            const gc = this.controller_.valueController;
	            gc.cellControllers.forEach((cc, i) => {
	                const api = new ButtonCellApi(cc);
	                this.cellToApiMap_.set(cc, api);
	                cc.emitter.on('click', () => {
	                    const x = i % gc.size[0];
	                    const y = Math.floor(i / gc.size[0]);
	                    this.emitter_.emit('click', {
	                        event: new TpButtonGridEvent(this, api, [x, y]),
	                    });
	                });
	            });
	        }
	        cell(x, y) {
	            const gc = this.controller_.valueController;
	            const cc = gc.cellControllers[y * gc.size[0] + x];
	            return this.cellToApiMap_.get(cc);
	        }
	        on(eventName, handler) {
	            const bh = handler.bind(this);
	            this.emitter_.on(eventName, (ev) => {
	                bh(ev.event);
	            });
	            return this;
	        }
	    }

	    class ButtonGridController {
	        constructor(doc, config) {
	            this.size = config.size;
	            const [w, h] = this.size;
	            const bcs = [];
	            for (let y = 0; y < h; y++) {
	                for (let x = 0; x < w; x++) {
	                    const bc = new ButtonController(doc, {
	                        props: ValueMap.fromObject(Object.assign({}, config.cellConfig(x, y))),
	                        viewProps: ViewProps.create(),
	                    });
	                    bcs.push(bc);
	                }
	            }
	            this.cellCs_ = bcs;
	            this.viewProps = ViewProps.create();
	            this.viewProps.handleDispose(() => {
	                this.cellCs_.forEach((c) => {
	                    c.viewProps.set('disposed', true);
	                });
	            });
	            this.view = new PlainView(doc, {
	                viewProps: this.viewProps,
	                viewName: 'btngrid',
	            });
	            this.view.element.style.gridTemplateColumns = `repeat(${w}, 1fr)`;
	            this.cellCs_.forEach((bc) => {
	                this.view.element.appendChild(bc.view.element);
	            });
	        }
	        get cellControllers() {
	            return this.cellCs_;
	        }
	    }

	    const ButtonGridBladePlugin = {
	        id: 'buttongrid',
	        type: 'blade',
	        // TODO:
	        css: '.tp-cbzgv,.tp-radv_b,.tp-rslv_k,.tp-cbzv_b{-webkit-appearance:none;-moz-appearance:none;appearance:none;background-color:rgba(0,0,0,0);border-width:0;font-family:inherit;font-size:inherit;font-weight:inherit;margin:0;outline:none;padding:0}.tp-radv_b,.tp-rslv_k,.tp-cbzv_b{background-color:var(--btn-bg);border-radius:var(--elm-br);color:var(--btn-fg);cursor:pointer;display:block;font-weight:bold;height:var(--bld-us);line-height:var(--bld-us);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tp-radv_b:hover,.tp-rslv_k:hover,.tp-cbzv_b:hover{background-color:var(--btn-bg-h)}.tp-radv_b:focus,.tp-rslv_k:focus,.tp-cbzv_b:focus{background-color:var(--btn-bg-f)}.tp-radv_b:active,.tp-rslv_k:active,.tp-cbzv_b:active{background-color:var(--btn-bg-a)}.tp-radv_b:disabled,.tp-rslv_k:disabled,.tp-cbzv_b:disabled{opacity:.5}.tp-cbzgv{background-color:var(--in-bg);border-radius:var(--elm-br);box-sizing:border-box;color:var(--in-fg);font-family:inherit;height:var(--bld-us);line-height:var(--bld-us);min-width:0;width:100%}.tp-cbzgv:hover{background-color:var(--in-bg-h)}.tp-cbzgv:focus{background-color:var(--in-bg-f)}.tp-cbzgv:active{background-color:var(--in-bg-a)}.tp-cbzgv:disabled{opacity:.5}.tp-btngridv{border-radius:var(--elm-br);display:grid;overflow:hidden;gap:2px}.tp-btngridv.tp-v-disabled{opacity:.5}.tp-btngridv .tp-btnv_b:disabled{opacity:1}.tp-btngridv .tp-btnv_b:disabled .tp-btnv_t{opacity:.5}.tp-btngridv .tp-btnv_b{border-radius:0}.tp-cbzv{position:relative}.tp-cbzv_h{display:flex}.tp-cbzv_b{margin-right:4px;position:relative;width:var(--bld-us)}.tp-cbzv_b svg{display:block;height:16px;left:50%;margin-left:-8px;margin-top:-8px;position:absolute;top:50%;width:16px}.tp-cbzv_b svg path{stroke:var(--bs-bg);stroke-width:2}.tp-cbzv_t{flex:1}.tp-cbzv_p{height:0;margin-top:0;opacity:0;overflow:hidden;transition:height .2s ease-in-out,opacity .2s linear,margin .2s ease-in-out}.tp-cbzv.tp-cbzv-expanded .tp-cbzv_p{margin-top:var(--bld-s);opacity:1}.tp-cbzv.tp-cbzv-cpl .tp-cbzv_p{overflow:visible}.tp-cbzv .tp-popv{left:calc(-1*var(--cnt-h-p));position:absolute;right:calc(-1*var(--cnt-h-p));top:var(--bld-us)}.tp-cbzpv_t{margin-top:var(--bld-s)}.tp-cbzgv{height:auto;overflow:hidden;position:relative}.tp-cbzgv.tp-v-disabled{opacity:.5}.tp-cbzgv_p{left:16px;position:absolute;right:16px;top:0}.tp-cbzgv_g{cursor:pointer;display:block;height:calc(var(--bld-us)*5);width:100%}.tp-cbzgv_u{opacity:.1;stroke:var(--in-fg);stroke-dasharray:1}.tp-cbzgv_l{fill:rgba(0,0,0,0);stroke:var(--in-fg)}.tp-cbzgv_v{opacity:.5;stroke:var(--in-fg);stroke-dasharray:1}.tp-cbzgv_h{border:var(--in-fg) solid 1px;border-radius:50%;box-sizing:border-box;height:4px;margin-left:-2px;margin-top:-2px;pointer-events:none;position:absolute;width:4px}.tp-cbzgv:focus .tp-cbzgv_h-sel{background-color:var(--in-fg);border-width:0}.tp-cbzprvv{cursor:pointer;height:4px;padding:4px 0;position:relative}.tp-cbzprvv_g{display:block;height:100%;overflow:visible;width:100%}.tp-cbzprvv_t{opacity:.5;stroke:var(--mo-fg)}.tp-cbzprvv_m{background-color:var(--mo-fg);border-radius:50%;height:4px;margin-left:-2px;margin-top:-2px;opacity:0;position:absolute;top:50%;transition:opacity .2s ease-out;width:4px}.tp-cbzprvv_m.tp-cbzprvv_m-a{opacity:1}.tp-fpsv{position:relative}.tp-fpsv_l{bottom:4px;color:var(--mo-fg);line-height:1;right:4px;pointer-events:none;position:absolute}.tp-fpsv_u{margin-left:.2em;opacity:.7}.tp-rslv{cursor:pointer;padding-left:8px;padding-right:8px}.tp-rslv.tp-v-disabled{opacity:.5}.tp-rslv_t{height:calc(var(--bld-us));position:relative}.tp-rslv_t::before{background-color:var(--in-bg);border-radius:1px;content:"";height:2px;margin-top:-1px;position:absolute;top:50%;left:-4px;right:-4px}.tp-rslv_b{bottom:0;top:0;position:absolute}.tp-rslv_b::before{background-color:var(--in-fg);content:"";height:2px;margin-top:-1px;position:absolute;top:50%;left:0;right:0}.tp-rslv_k{height:calc(var(--bld-us) - 8px);margin-top:calc((var(--bld-us) - 8px)/-2);position:absolute;top:50%;width:8px}.tp-rslv_k.tp-rslv_k-min{margin-left:-8px}.tp-rslv_k.tp-rslv_k-max{margin-left:0}.tp-rslv.tp-rslv-zero .tp-rslv_k.tp-rslv_k-min{border-bottom-right-radius:0;border-top-right-radius:0}.tp-rslv.tp-rslv-zero .tp-rslv_k.tp-rslv_k-max{border-bottom-left-radius:0;border-top-left-radius:0}.tp-rsltxtv{display:flex}.tp-rsltxtv_s{flex:1}.tp-rsltxtv_t{flex:1;margin-left:4px}.tp-radv_l{display:block;position:relative}.tp-radv_i{left:0;opacity:0;position:absolute;top:0}.tp-radv_b{opacity:.5}.tp-radv_i:hover+.tp-radv_b{background-color:var(--btn-bg-h)}.tp-radv_i:focus+.tp-radv_b{background-color:var(--btn-bg-f)}.tp-radv_i:active+.tp-radv_b{background-color:var(--btn-bg-a)}.tp-radv_i:checked+.tp-radv_b{opacity:1}.tp-radv_t{bottom:0;color:inherit;left:0;overflow:hidden;position:absolute;right:0;text-align:center;text-overflow:ellipsis;top:0}.tp-radv_i:disabled+.tp-radv_b>.tp-radv_t{opacity:.5}.tp-radgridv{border-radius:var(--elm-br);display:grid;overflow:hidden;gap:2px}.tp-radgridv.tp-v-disabled{opacity:.5}.tp-radgridv .tp-radv_b{border-radius:0}',
	        accept(params) {
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                cells: p.required.function,
	                size: p.required.array(p.required.number),
	                view: p.required.constant('buttongrid'),
	                label: p.optional.string,
	            });
	            return result ? { params: result } : null;
	        },
	        controller(args) {
	            return new LabelController(args.document, {
	                blade: args.blade,
	                props: ValueMap.fromObject({
	                    label: args.params.label,
	                }),
	                valueController: new ButtonGridController(args.document, {
	                    cellConfig: args.params.cells,
	                    size: args.params.size,
	                }),
	            });
	        },
	        api(args) {
	            if (!(args.controller instanceof LabelController)) {
	                return null;
	            }
	            if (!(args.controller.valueController instanceof ButtonGridController)) {
	                return null;
	            }
	            return new ButtonGridApi(args.controller);
	        },
	    };

	    class CubicBezierApi extends BladeApi {
	        get label() {
	            return this.controller_.props.get('label');
	        }
	        set label(label) {
	            this.controller_.props.set('label', label);
	        }
	        get value() {
	            return this.controller_.valueController.value.rawValue;
	        }
	        set value(value) {
	            this.controller_.valueController.value.rawValue = value;
	        }
	        on(eventName, handler) {
	            const bh = handler.bind(this);
	            this.controller_.valueController.value.emitter.on(eventName, (ev) => {
	                bh(new TpChangeEvent(this, ev.rawValue, undefined, ev.options.last));
	            });
	            return this;
	        }
	    }

	    function interpolate(x1, x2, t) {
	        return x1 * (1 - t) + x2 * t;
	    }
	    const MAX_ITERATION = 20;
	    const X_DELTA = 0.001;
	    const CACHE_RESOLUTION = 100;
	    function y(cb, x) {
	        let dt = 0.25;
	        let t = 0.5;
	        let y = -1;
	        for (let i = 0; i < MAX_ITERATION; i++) {
	            const [tx, ty] = cb.curve(t);
	            t += dt * (tx < x ? +1 : -1);
	            y = ty;
	            dt *= 0.5;
	            if (Math.abs(x - tx) < X_DELTA) {
	                break;
	            }
	        }
	        return y;
	    }
	    class CubicBezier {
	        constructor(x1 = 0, y1 = 0, x2 = 1, y2 = 1) {
	            this.cache_ = [];
	            this.comps_ = [x1, y1, x2, y2];
	        }
	        get x1() {
	            return this.comps_[0];
	        }
	        get y1() {
	            return this.comps_[1];
	        }
	        get x2() {
	            return this.comps_[2];
	        }
	        get y2() {
	            return this.comps_[3];
	        }
	        static isObject(obj) {
	            if (isEmpty(obj)) {
	                return false;
	            }
	            if (!Array.isArray(obj)) {
	                return false;
	            }
	            return (typeof obj[0] === 'number' &&
	                typeof obj[1] === 'number' &&
	                typeof obj[2] === 'number' &&
	                typeof obj[3] === 'number');
	        }
	        static equals(v1, v2) {
	            return (v1.x1 === v2.x1 && v1.y1 === v2.y1 && v1.x2 === v2.x2 && v1.y2 === v2.y2);
	        }
	        curve(t) {
	            const x01 = interpolate(0, this.x1, t);
	            const y01 = interpolate(0, this.y1, t);
	            const x12 = interpolate(this.x1, this.x2, t);
	            const y12 = interpolate(this.y1, this.y2, t);
	            const x23 = interpolate(this.x2, 1, t);
	            const y23 = interpolate(this.y2, 1, t);
	            const xr0 = interpolate(x01, x12, t);
	            const yr0 = interpolate(y01, y12, t);
	            const xr1 = interpolate(x12, x23, t);
	            const yr1 = interpolate(y12, y23, t);
	            return [interpolate(xr0, xr1, t), interpolate(yr0, yr1, t)];
	        }
	        y(x) {
	            if (this.cache_.length === 0) {
	                const cache = [];
	                for (let i = 0; i < CACHE_RESOLUTION; i++) {
	                    cache.push(y(this, mapRange(i, 0, CACHE_RESOLUTION - 1, 0, 1)));
	                }
	                this.cache_ = cache;
	            }
	            return this.cache_[Math.round(mapRange(constrainRange(x, 0, 1), 0, 1, 0, CACHE_RESOLUTION - 1))];
	        }
	        toObject() {
	            return [this.comps_[0], this.comps_[1], this.comps_[2], this.comps_[3]];
	        }
	    }
	    const CubicBezierAssembly = {
	        toComponents: (p) => p.toObject(),
	        fromComponents: (comps) => new CubicBezier(...comps),
	    };

	    function cubicBezierToString(cb) {
	        const formatter = createNumberFormatter(2);
	        const comps = cb.toObject().map((c) => formatter(c));
	        return `cubic-bezier(${comps.join(', ')})`;
	    }
	    const COMPS_EMPTY = [0, 0.5, 0.5, 1];
	    function cubicBezierFromString(text) {
	        const m = text.match(/^cubic-bezier\s*\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)$/);
	        if (!m) {
	            return new CubicBezier(...COMPS_EMPTY);
	        }
	        const comps = [m[1], m[2], m[3], m[4]].reduce((comps, comp) => {
	            if (!comps) {
	                return null;
	            }
	            const n = Number(comp);
	            if (isNaN(n)) {
	                return null;
	            }
	            return [...comps, n];
	        }, []);
	        return new CubicBezier(...(comps !== null && comps !== void 0 ? comps : COMPS_EMPTY));
	    }

	    const className$7 = ClassName('cbz');
	    class CubicBezierView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$7());
	            config.viewProps.bindClassModifiers(this.element);
	            config.foldable.bindExpandedClass(this.element, className$7(undefined, 'expanded'));
	            bindValueMap(config.foldable, 'completed', valueToClassName(this.element, className$7(undefined, 'cpl')));
	            const headElem = doc.createElement('div');
	            headElem.classList.add(className$7('h'));
	            this.element.appendChild(headElem);
	            const buttonElem = doc.createElement('button');
	            buttonElem.classList.add(className$7('b'));
	            config.viewProps.bindDisabled(buttonElem);
	            const iconElem = doc.createElementNS(SVG_NS, 'svg');
	            iconElem.innerHTML = '<path d="M2 13C8 13 8 3 14 3"/>';
	            buttonElem.appendChild(iconElem);
	            headElem.appendChild(buttonElem);
	            this.buttonElement = buttonElem;
	            const textElem = doc.createElement('div');
	            textElem.classList.add(className$7('t'));
	            headElem.appendChild(textElem);
	            this.textElement = textElem;
	            if (config.pickerLayout === 'inline') {
	                const pickerElem = doc.createElement('div');
	                pickerElem.classList.add(className$7('p'));
	                this.element.appendChild(pickerElem);
	                this.pickerElement = pickerElem;
	            }
	            else {
	                this.pickerElement = null;
	            }
	        }
	    }

	    const className$6 = ClassName('cbzp');
	    class CubicBezierPickerView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$6());
	            config.viewProps.bindClassModifiers(this.element);
	            const graphElem = doc.createElement('div');
	            graphElem.classList.add(className$6('g'));
	            this.element.appendChild(graphElem);
	            this.graphElement = graphElem;
	            const textElem = doc.createElement('div');
	            textElem.classList.add(className$6('t'));
	            this.element.appendChild(textElem);
	            this.textElement = textElem;
	        }
	    }

	    function waitToBeAddedToDom(elem, callback) {
	        const ob = new MutationObserver((ml) => {
	            for (const m of ml) {
	                if (m.type !== 'childList') {
	                    continue;
	                }
	                m.addedNodes.forEach((elem) => {
	                    if (!elem.contains(elem)) {
	                        return;
	                    }
	                    callback();
	                    ob.disconnect();
	                });
	            }
	        });
	        const doc = elem.ownerDocument;
	        ob.observe(doc.body, {
	            attributes: true,
	            childList: true,
	            subtree: true,
	        });
	    }

	    const className$5 = ClassName('cbzg');
	    // TODO: Apply to core
	    function compose(h1, h2) {
	        return (input) => h2(h1(input));
	    }
	    class CubicBezierGraphView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$5());
	            config.viewProps.bindClassModifiers(this.element);
	            config.viewProps.bindTabIndex(this.element);
	            const previewElem = doc.createElement('div');
	            previewElem.classList.add(className$5('p'));
	            this.element.appendChild(previewElem);
	            this.previewElement = previewElem;
	            const svgElem = doc.createElementNS(SVG_NS, 'svg');
	            svgElem.classList.add(className$5('g'));
	            this.element.appendChild(svgElem);
	            this.svgElem_ = svgElem;
	            const guideElem = doc.createElementNS(SVG_NS, 'path');
	            guideElem.classList.add(className$5('u'));
	            this.svgElem_.appendChild(guideElem);
	            this.guideElem_ = guideElem;
	            const lineElem = doc.createElementNS(SVG_NS, 'polyline');
	            lineElem.classList.add(className$5('l'));
	            this.svgElem_.appendChild(lineElem);
	            this.lineElem_ = lineElem;
	            this.handleElems_ = [doc.createElement('div'), doc.createElement('div')];
	            this.handleElems_.forEach((elem) => {
	                elem.classList.add(className$5('h'));
	                this.element.appendChild(elem);
	            });
	            this.vectorElems_ = [
	                doc.createElementNS(SVG_NS, 'line'),
	                doc.createElementNS(SVG_NS, 'line'),
	            ];
	            this.vectorElems_.forEach((elem) => {
	                elem.classList.add(className$5('v'));
	                this.svgElem_.appendChild(elem);
	            });
	            this.value_ = config.value;
	            this.value_.emitter.on('change', this.onValueChange_.bind(this));
	            this.sel_ = config.selection;
	            this.handleElems_.forEach((elem, index) => {
	                bindValue(this.sel_, compose((selection) => selection === index, valueToClassName(elem, className$5('h', 'sel'))));
	            });
	            waitToBeAddedToDom(this.element, () => {
	                this.refresh();
	            });
	        }
	        getVertMargin_(h) {
	            return h * 0.25;
	        }
	        valueToPosition(x, y) {
	            const bounds = this.element.getBoundingClientRect();
	            const w = bounds.width;
	            const h = bounds.height;
	            const vm = this.getVertMargin_(h);
	            return {
	                x: mapRange(x, 0, 1, 0, w),
	                y: mapRange(y, 0, 1, h - vm, vm),
	            };
	        }
	        positionToValue(x, y) {
	            const bounds = this.element.getBoundingClientRect();
	            const w = bounds.width;
	            const h = bounds.height;
	            const vm = this.getVertMargin_(h);
	            return {
	                x: constrainRange(mapRange(x, 0, w, 0, 1), 0, 1),
	                y: mapRange(y, h - vm, vm, 0, 1),
	            };
	        }
	        refresh() {
	            this.guideElem_.setAttributeNS(null, 'd', [0, 1]
	                .map((index) => {
	                const p1 = this.valueToPosition(0, index);
	                const p2 = this.valueToPosition(1, index);
	                return [`M ${p1.x},${p1.y}`, `L ${p2.x},${p2.y}`].join(' ');
	            })
	                .join(' '));
	            const bezier = this.value_.rawValue;
	            const points = [];
	            let t = 0;
	            for (;;) {
	                const p = this.valueToPosition(...bezier.curve(t));
	                points.push([p.x, p.y].join(','));
	                if (t >= 1) {
	                    break;
	                }
	                t = Math.min(t + 0.05, 1);
	            }
	            this.lineElem_.setAttributeNS(null, 'points', points.join(' '));
	            const obj = bezier.toObject();
	            [0, 1].forEach((index) => {
	                const p1 = this.valueToPosition(index, index);
	                const p2 = this.valueToPosition(obj[index * 2], obj[index * 2 + 1]);
	                const vElem = this.vectorElems_[index];
	                vElem.setAttributeNS(null, 'x1', String(p1.x));
	                vElem.setAttributeNS(null, 'y1', String(p1.y));
	                vElem.setAttributeNS(null, 'x2', String(p2.x));
	                vElem.setAttributeNS(null, 'y2', String(p2.y));
	                const hElem = this.handleElems_[index];
	                hElem.style.left = `${p2.x}px`;
	                hElem.style.top = `${p2.y}px`;
	            });
	        }
	        onValueChange_() {
	            this.refresh();
	        }
	    }

	    const TICK_COUNT = 24;
	    const PREVIEW_DELAY = 400;
	    const PREVIEW_DURATION = 1000;
	    const className$4 = ClassName('cbzprv');
	    class CubicBezierPreviewView {
	        constructor(doc, config) {
	            this.stopped_ = true;
	            this.startTime_ = -1;
	            this.onDispose_ = this.onDispose_.bind(this);
	            this.onTimer_ = this.onTimer_.bind(this);
	            this.onValueChange_ = this.onValueChange_.bind(this);
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$4());
	            config.viewProps.bindClassModifiers(this.element);
	            const svgElem = doc.createElementNS(SVG_NS, 'svg');
	            svgElem.classList.add(className$4('g'));
	            this.element.appendChild(svgElem);
	            this.svgElem_ = svgElem;
	            const ticksElem = doc.createElementNS(SVG_NS, 'path');
	            ticksElem.classList.add(className$4('t'));
	            this.svgElem_.appendChild(ticksElem);
	            this.ticksElem_ = ticksElem;
	            const markerElem = doc.createElement('div');
	            markerElem.classList.add(className$4('m'));
	            this.element.appendChild(markerElem);
	            this.markerElem_ = markerElem;
	            this.value_ = config.value;
	            this.value_.emitter.on('change', this.onValueChange_);
	            config.viewProps.handleDispose(this.onDispose_);
	            waitToBeAddedToDom(this.element, () => {
	                this.refresh();
	            });
	        }
	        play() {
	            this.stop();
	            this.updateMarker_(0);
	            this.markerElem_.classList.add(className$4('m', 'a'));
	            this.startTime_ = new Date().getTime() + PREVIEW_DELAY;
	            this.stopped_ = false;
	            requestAnimationFrame(this.onTimer_);
	        }
	        stop() {
	            this.stopped_ = true;
	            this.markerElem_.classList.remove(className$4('m', 'a'));
	        }
	        onDispose_() {
	            this.stop();
	        }
	        updateMarker_(progress) {
	            const p = this.value_.rawValue.y(constrainRange(progress, 0, 1));
	            this.markerElem_.style.left = `${p * 100}%`;
	        }
	        refresh() {
	            const bounds = this.svgElem_.getBoundingClientRect();
	            const w = bounds.width;
	            const h = bounds.height;
	            const ds = [];
	            const bezier = this.value_.rawValue;
	            for (let i = 0; i < TICK_COUNT; i++) {
	                const px = mapRange(i, 0, TICK_COUNT - 1, 0, 1);
	                const x = mapRange(bezier.y(px), 0, 1, 0, w);
	                ds.push(`M ${x},0 v${h}`);
	            }
	            this.ticksElem_.setAttributeNS(null, 'd', ds.join(' '));
	        }
	        onTimer_() {
	            if (this.startTime_ === null) {
	                return;
	            }
	            const dt = new Date().getTime() - this.startTime_;
	            const p = dt / PREVIEW_DURATION;
	            this.updateMarker_(p);
	            if (dt > PREVIEW_DURATION + PREVIEW_DELAY) {
	                this.stop();
	            }
	            if (!this.stopped_) {
	                requestAnimationFrame(this.onTimer_);
	            }
	        }
	        onValueChange_() {
	            this.refresh();
	            this.play();
	        }
	    }

	    function getDistance(x1, y1, x2, y2) {
	        const dx = x2 - x1;
	        const dy = y2 - y1;
	        return Math.sqrt(dx * dx + dy * dy);
	    }
	    function lockAngle(x1, y1, x2, y2) {
	        const d = getDistance(x1, y1, x2, y2);
	        const a = Math.atan2(y2 - y1, x2 - x1);
	        const la = (Math.round(a / (Math.PI / 4)) * Math.PI) / 4;
	        return {
	            x: x1 + Math.cos(la) * d,
	            y: y1 + Math.sin(la) * d,
	        };
	    }
	    class CubicBezierGraphController {
	        constructor(doc, config) {
	            this.onKeyDown_ = this.onKeyDown_.bind(this);
	            this.onKeyUp_ = this.onKeyUp_.bind(this);
	            this.onPointerDown_ = this.onPointerDown_.bind(this);
	            this.onPointerMove_ = this.onPointerMove_.bind(this);
	            this.onPointerUp_ = this.onPointerUp_.bind(this);
	            this.baseStep_ = config.baseStep;
	            this.value = config.value;
	            this.sel_ = createValue(0);
	            this.viewProps = config.viewProps;
	            this.view = new CubicBezierGraphView(doc, {
	                selection: this.sel_,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.view.element.addEventListener('keydown', this.onKeyDown_);
	            this.view.element.addEventListener('keyup', this.onKeyUp_);
	            this.prevView_ = new CubicBezierPreviewView(doc, {
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.prevView_.element.addEventListener('mousedown', (ev) => {
	                ev.stopImmediatePropagation();
	                ev.preventDefault();
	                this.prevView_.play();
	            });
	            this.view.previewElement.appendChild(this.prevView_.element);
	            const ptHandler = new PointerHandler(this.view.element);
	            ptHandler.emitter.on('down', this.onPointerDown_);
	            ptHandler.emitter.on('move', this.onPointerMove_);
	            ptHandler.emitter.on('up', this.onPointerUp_);
	        }
	        refresh() {
	            this.view.refresh();
	            this.prevView_.refresh();
	            this.prevView_.play();
	        }
	        updateValue_(point, locksAngle, opts) {
	            const index = this.sel_.rawValue;
	            const comps = this.value.rawValue.toObject();
	            const vp = this.view.positionToValue(point.x, point.y);
	            const v = locksAngle ? lockAngle(index, index, vp.x, vp.y) : vp;
	            comps[index * 2] = v.x;
	            comps[index * 2 + 1] = v.y;
	            this.value.setRawValue(new CubicBezier(...comps), opts);
	        }
	        onPointerDown_(ev) {
	            const data = ev.data;
	            if (!data.point) {
	                return;
	            }
	            const bezier = this.value.rawValue;
	            const p1 = this.view.valueToPosition(bezier.x1, bezier.y1);
	            const d1 = getDistance(data.point.x, data.point.y, p1.x, p1.y);
	            const p2 = this.view.valueToPosition(bezier.x2, bezier.y2);
	            const d2 = getDistance(data.point.x, data.point.y, p2.x, p2.y);
	            this.sel_.rawValue = d1 <= d2 ? 0 : 1;
	            this.updateValue_(data.point, ev.shiftKey, {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onPointerMove_(ev) {
	            const data = ev.data;
	            if (!data.point) {
	                return;
	            }
	            this.updateValue_(data.point, ev.shiftKey, {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onPointerUp_(ev) {
	            const data = ev.data;
	            if (!data.point) {
	                return;
	            }
	            this.updateValue_(data.point, ev.shiftKey, {
	                forceEmit: true,
	                last: true,
	            });
	        }
	        onKeyDown_(ev) {
	            if (isArrowKey(ev.key)) {
	                ev.preventDefault();
	            }
	            const index = this.sel_.rawValue;
	            const comps = this.value.rawValue.toObject();
	            comps[index * 2] += getStepForKey(this.baseStep_, getHorizontalStepKeys(ev));
	            comps[index * 2 + 1] += getStepForKey(this.baseStep_, getVerticalStepKeys(ev));
	            this.value.setRawValue(new CubicBezier(...comps), {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onKeyUp_(ev) {
	            if (isArrowKey(ev.key)) {
	                ev.preventDefault();
	            }
	            const xStep = getStepForKey(this.baseStep_, getHorizontalStepKeys(ev));
	            const yStep = getStepForKey(this.baseStep_, getVerticalStepKeys(ev));
	            if (xStep === 0 && yStep === 0) {
	                return;
	            }
	            this.value.setRawValue(this.value.rawValue, {
	                forceEmit: true,
	                last: true,
	            });
	        }
	    }

	    class CubicBezierPickerController {
	        constructor(doc, config) {
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.view = new CubicBezierPickerView(doc, {
	                viewProps: this.viewProps,
	            });
	            this.gc_ = new CubicBezierGraphController(doc, {
	                baseStep: config.axis.baseStep,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.view.graphElement.appendChild(this.gc_.view.element);
	            const xAxis = Object.assign(Object.assign({}, config.axis), { constraint: new RangeConstraint({ max: 1, min: 0 }) });
	            const yAxis = Object.assign(Object.assign({}, config.axis), { constraint: undefined });
	            this.tc_ = new PointNdTextController(doc, {
	                assembly: CubicBezierAssembly,
	                axes: [xAxis, yAxis, xAxis, yAxis],
	                parser: parseNumber,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.view.textElement.appendChild(this.tc_.view.element);
	        }
	        get allFocusableElements() {
	            return [
	                this.gc_.view.element,
	                ...this.tc_.view.textViews.map((v) => v.inputElement),
	            ];
	        }
	        refresh() {
	            this.gc_.refresh();
	        }
	    }

	    class CubicBezierController {
	        constructor(doc, config) {
	            this.onButtonBlur_ = this.onButtonBlur_.bind(this);
	            this.onButtonClick_ = this.onButtonClick_.bind(this);
	            this.onPopupChildBlur_ = this.onPopupChildBlur_.bind(this);
	            this.onPopupChildKeydown_ = this.onPopupChildKeydown_.bind(this);
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.foldable_ = createFoldable(config.expanded);
	            this.view = new CubicBezierView(doc, {
	                foldable: this.foldable_,
	                pickerLayout: config.pickerLayout,
	                viewProps: this.viewProps,
	            });
	            this.view.buttonElement.addEventListener('blur', this.onButtonBlur_);
	            this.view.buttonElement.addEventListener('click', this.onButtonClick_);
	            this.tc_ = new TextController(doc, {
	                parser: cubicBezierFromString,
	                props: ValueMap.fromObject({
	                    formatter: cubicBezierToString,
	                }),
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            this.view.textElement.appendChild(this.tc_.view.element);
	            this.popC_ =
	                config.pickerLayout === 'popup'
	                    ? new PopupController(doc, {
	                        viewProps: this.viewProps,
	                    })
	                    : null;
	            const pickerC = new CubicBezierPickerController(doc, {
	                axis: config.axis,
	                value: this.value,
	                viewProps: this.viewProps,
	            });
	            pickerC.allFocusableElements.forEach((elem) => {
	                elem.addEventListener('blur', this.onPopupChildBlur_);
	                elem.addEventListener('keydown', this.onPopupChildKeydown_);
	            });
	            this.pickerC_ = pickerC;
	            if (this.popC_) {
	                this.view.element.appendChild(this.popC_.view.element);
	                this.popC_.view.element.appendChild(this.pickerC_.view.element);
	                bindValue(this.popC_.shows, (shows) => {
	                    if (shows) {
	                        pickerC.refresh();
	                    }
	                });
	                connectValues({
	                    primary: this.foldable_.value('expanded'),
	                    secondary: this.popC_.shows,
	                    forward: (p) => p.rawValue,
	                    backward: (_, s) => s.rawValue,
	                });
	            }
	            else if (this.view.pickerElement) {
	                this.view.pickerElement.appendChild(this.pickerC_.view.element);
	                bindFoldable(this.foldable_, this.view.pickerElement);
	            }
	        }
	        onButtonBlur_(ev) {
	            if (!this.popC_) {
	                return;
	            }
	            const nextTarget = forceCast(ev.relatedTarget);
	            if (!nextTarget || !this.popC_.view.element.contains(nextTarget)) {
	                this.popC_.shows.rawValue = false;
	            }
	        }
	        onButtonClick_() {
	            this.foldable_.set('expanded', !this.foldable_.get('expanded'));
	            if (this.foldable_.get('expanded')) {
	                this.pickerC_.allFocusableElements[0].focus();
	            }
	        }
	        onPopupChildBlur_(ev) {
	            if (!this.popC_) {
	                return;
	            }
	            const elem = this.popC_.view.element;
	            const nextTarget = findNextTarget(ev);
	            if (nextTarget && elem.contains(nextTarget)) {
	                // Next target is in the popup
	                return;
	            }
	            if (nextTarget &&
	                nextTarget === this.view.buttonElement &&
	                !supportsTouch(elem.ownerDocument)) {
	                // Next target is the trigger button
	                return;
	            }
	            this.popC_.shows.rawValue = false;
	        }
	        onPopupChildKeydown_(ev) {
	            if (!this.popC_) {
	                return;
	            }
	            if (ev.key === 'Escape') {
	                this.popC_.shows.rawValue = false;
	            }
	        }
	    }

	    function createConstraint$1() {
	        return new PointNdConstraint({
	            assembly: CubicBezierAssembly,
	            components: [0, 1, 2, 3].map((index) => index % 2 === 0
	                ? new RangeConstraint({
	                    min: 0,
	                    max: 1,
	                })
	                : undefined),
	        });
	    }
	    const CubicBezierBladePlugin = {
	        id: 'cubic-bezier',
	        type: 'blade',
	        css: '.tp-cbzgv,.tp-radv_b,.tp-rslv_k,.tp-cbzv_b{-webkit-appearance:none;-moz-appearance:none;appearance:none;background-color:rgba(0,0,0,0);border-width:0;font-family:inherit;font-size:inherit;font-weight:inherit;margin:0;outline:none;padding:0}.tp-radv_b,.tp-rslv_k,.tp-cbzv_b{background-color:var(--btn-bg);border-radius:var(--elm-br);color:var(--btn-fg);cursor:pointer;display:block;font-weight:bold;height:var(--bld-us);line-height:var(--bld-us);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tp-radv_b:hover,.tp-rslv_k:hover,.tp-cbzv_b:hover{background-color:var(--btn-bg-h)}.tp-radv_b:focus,.tp-rslv_k:focus,.tp-cbzv_b:focus{background-color:var(--btn-bg-f)}.tp-radv_b:active,.tp-rslv_k:active,.tp-cbzv_b:active{background-color:var(--btn-bg-a)}.tp-radv_b:disabled,.tp-rslv_k:disabled,.tp-cbzv_b:disabled{opacity:.5}.tp-cbzgv{background-color:var(--in-bg);border-radius:var(--elm-br);box-sizing:border-box;color:var(--in-fg);font-family:inherit;height:var(--bld-us);line-height:var(--bld-us);min-width:0;width:100%}.tp-cbzgv:hover{background-color:var(--in-bg-h)}.tp-cbzgv:focus{background-color:var(--in-bg-f)}.tp-cbzgv:active{background-color:var(--in-bg-a)}.tp-cbzgv:disabled{opacity:.5}.tp-btngridv{border-radius:var(--elm-br);display:grid;overflow:hidden;gap:2px}.tp-btngridv.tp-v-disabled{opacity:.5}.tp-btngridv .tp-btnv_b:disabled{opacity:1}.tp-btngridv .tp-btnv_b:disabled .tp-btnv_t{opacity:.5}.tp-btngridv .tp-btnv_b{border-radius:0}.tp-cbzv{position:relative}.tp-cbzv_h{display:flex}.tp-cbzv_b{margin-right:4px;position:relative;width:var(--bld-us)}.tp-cbzv_b svg{display:block;height:16px;left:50%;margin-left:-8px;margin-top:-8px;position:absolute;top:50%;width:16px}.tp-cbzv_b svg path{stroke:var(--bs-bg);stroke-width:2}.tp-cbzv_t{flex:1}.tp-cbzv_p{height:0;margin-top:0;opacity:0;overflow:hidden;transition:height .2s ease-in-out,opacity .2s linear,margin .2s ease-in-out}.tp-cbzv.tp-cbzv-expanded .tp-cbzv_p{margin-top:var(--bld-s);opacity:1}.tp-cbzv.tp-cbzv-cpl .tp-cbzv_p{overflow:visible}.tp-cbzv .tp-popv{left:calc(-1*var(--cnt-h-p));position:absolute;right:calc(-1*var(--cnt-h-p));top:var(--bld-us)}.tp-cbzpv_t{margin-top:var(--bld-s)}.tp-cbzgv{height:auto;overflow:hidden;position:relative}.tp-cbzgv.tp-v-disabled{opacity:.5}.tp-cbzgv_p{left:16px;position:absolute;right:16px;top:0}.tp-cbzgv_g{cursor:pointer;display:block;height:calc(var(--bld-us)*5);width:100%}.tp-cbzgv_u{opacity:.1;stroke:var(--in-fg);stroke-dasharray:1}.tp-cbzgv_l{fill:rgba(0,0,0,0);stroke:var(--in-fg)}.tp-cbzgv_v{opacity:.5;stroke:var(--in-fg);stroke-dasharray:1}.tp-cbzgv_h{border:var(--in-fg) solid 1px;border-radius:50%;box-sizing:border-box;height:4px;margin-left:-2px;margin-top:-2px;pointer-events:none;position:absolute;width:4px}.tp-cbzgv:focus .tp-cbzgv_h-sel{background-color:var(--in-fg);border-width:0}.tp-cbzprvv{cursor:pointer;height:4px;padding:4px 0;position:relative}.tp-cbzprvv_g{display:block;height:100%;overflow:visible;width:100%}.tp-cbzprvv_t{opacity:.5;stroke:var(--mo-fg)}.tp-cbzprvv_m{background-color:var(--mo-fg);border-radius:50%;height:4px;margin-left:-2px;margin-top:-2px;opacity:0;position:absolute;top:50%;transition:opacity .2s ease-out;width:4px}.tp-cbzprvv_m.tp-cbzprvv_m-a{opacity:1}.tp-fpsv{position:relative}.tp-fpsv_l{bottom:4px;color:var(--mo-fg);line-height:1;right:4px;pointer-events:none;position:absolute}.tp-fpsv_u{margin-left:.2em;opacity:.7}.tp-rslv{cursor:pointer;padding-left:8px;padding-right:8px}.tp-rslv.tp-v-disabled{opacity:.5}.tp-rslv_t{height:calc(var(--bld-us));position:relative}.tp-rslv_t::before{background-color:var(--in-bg);border-radius:1px;content:"";height:2px;margin-top:-1px;position:absolute;top:50%;left:-4px;right:-4px}.tp-rslv_b{bottom:0;top:0;position:absolute}.tp-rslv_b::before{background-color:var(--in-fg);content:"";height:2px;margin-top:-1px;position:absolute;top:50%;left:0;right:0}.tp-rslv_k{height:calc(var(--bld-us) - 8px);margin-top:calc((var(--bld-us) - 8px)/-2);position:absolute;top:50%;width:8px}.tp-rslv_k.tp-rslv_k-min{margin-left:-8px}.tp-rslv_k.tp-rslv_k-max{margin-left:0}.tp-rslv.tp-rslv-zero .tp-rslv_k.tp-rslv_k-min{border-bottom-right-radius:0;border-top-right-radius:0}.tp-rslv.tp-rslv-zero .tp-rslv_k.tp-rslv_k-max{border-bottom-left-radius:0;border-top-left-radius:0}.tp-rsltxtv{display:flex}.tp-rsltxtv_s{flex:1}.tp-rsltxtv_t{flex:1;margin-left:4px}.tp-radv_l{display:block;position:relative}.tp-radv_i{left:0;opacity:0;position:absolute;top:0}.tp-radv_b{opacity:.5}.tp-radv_i:hover+.tp-radv_b{background-color:var(--btn-bg-h)}.tp-radv_i:focus+.tp-radv_b{background-color:var(--btn-bg-f)}.tp-radv_i:active+.tp-radv_b{background-color:var(--btn-bg-a)}.tp-radv_i:checked+.tp-radv_b{opacity:1}.tp-radv_t{bottom:0;color:inherit;left:0;overflow:hidden;position:absolute;right:0;text-align:center;text-overflow:ellipsis;top:0}.tp-radv_i:disabled+.tp-radv_b>.tp-radv_t{opacity:.5}.tp-radgridv{border-radius:var(--elm-br);display:grid;overflow:hidden;gap:2px}.tp-radgridv.tp-v-disabled{opacity:.5}.tp-radgridv .tp-radv_b{border-radius:0}',
	        accept(params) {
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                value: p.required.array(p.required.number),
	                view: p.required.constant('cubicbezier'),
	                expanded: p.optional.boolean,
	                label: p.optional.string,
	                picker: p.optional.custom((v) => {
	                    return v === 'inline' || v === 'popup' ? v : undefined;
	                }),
	            });
	            return result ? { params: result } : null;
	        },
	        controller(args) {
	            var _a, _b;
	            const rv = new CubicBezier(...args.params.value);
	            const v = createValue(rv, {
	                constraint: createConstraint$1(),
	                equals: CubicBezier.equals,
	            });
	            const vc = new CubicBezierController(args.document, {
	                axis: {
	                    baseStep: 0.1,
	                    textProps: ValueMap.fromObject({
	                        draggingScale: 0.01,
	                        formatter: createNumberFormatter(2),
	                    }),
	                },
	                expanded: (_a = args.params.expanded) !== null && _a !== void 0 ? _a : false,
	                pickerLayout: (_b = args.params.picker) !== null && _b !== void 0 ? _b : 'popup',
	                value: v,
	                viewProps: args.viewProps,
	            });
	            return new LabeledValueController(args.document, {
	                blade: args.blade,
	                props: ValueMap.fromObject({
	                    label: args.params.label,
	                }),
	                valueController: vc,
	            });
	        },
	        api(args) {
	            if (!(args.controller instanceof LabeledValueController)) {
	                return null;
	            }
	            if (!(args.controller.valueController instanceof CubicBezierController)) {
	                return null;
	            }
	            return new CubicBezierApi(args.controller);
	        },
	    };

	    class FpsGraphBladeApi extends BladeApi {
	        begin() {
	            this.controller_.valueController.begin();
	        }
	        end() {
	            this.controller_.valueController.end();
	        }
	    }

	    const MAX_TIMESTAMPS = 20;
	    class Fpswatch {
	        constructor() {
	            this.start_ = null;
	            this.duration_ = 0;
	            this.fps_ = null;
	            this.frameCount_ = 0;
	            this.timestamps_ = [];
	        }
	        get duration() {
	            return this.duration_;
	        }
	        get fps() {
	            return this.fps_;
	        }
	        begin(now) {
	            this.start_ = now.getTime();
	        }
	        calculateFps_(nowTime) {
	            if (this.timestamps_.length === 0) {
	                return null;
	            }
	            const ts = this.timestamps_[0];
	            return (1000 * (this.frameCount_ - ts.frameCount)) / (nowTime - ts.time);
	        }
	        compactTimestamps_() {
	            if (this.timestamps_.length <= MAX_TIMESTAMPS) {
	                return;
	            }
	            const len = this.timestamps_.length - MAX_TIMESTAMPS;
	            this.timestamps_.splice(0, len);
	            const df = this.timestamps_[0].frameCount;
	            this.timestamps_.forEach((ts) => {
	                ts.frameCount -= df;
	            });
	            this.frameCount_ -= df;
	        }
	        end(now) {
	            if (this.start_ === null) {
	                return;
	            }
	            const t = now.getTime();
	            this.duration_ = t - this.start_;
	            this.start_ = null;
	            this.fps_ = this.calculateFps_(t);
	            this.timestamps_.push({
	                frameCount: this.frameCount_,
	                time: t,
	            });
	            ++this.frameCount_;
	            this.compactTimestamps_();
	        }
	    }

	    const className$3 = ClassName('fps');
	    class FpsView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$3());
	            config.viewProps.bindClassModifiers(this.element);
	            this.graphElement = doc.createElement('div');
	            this.graphElement.classList.add(className$3('g'));
	            this.element.appendChild(this.graphElement);
	            const labelElement = doc.createElement('div');
	            labelElement.classList.add(className$3('l'));
	            this.element.appendChild(labelElement);
	            const valueElement = doc.createElement('span');
	            valueElement.classList.add(className$3('v'));
	            valueElement.textContent = '--';
	            labelElement.appendChild(valueElement);
	            this.valueElement = valueElement;
	            const unitElement = doc.createElement('span');
	            unitElement.classList.add(className$3('u'));
	            unitElement.textContent = 'FPS';
	            labelElement.appendChild(unitElement);
	        }
	    }

	    class FpsGraphController {
	        constructor(doc, config) {
	            this.stopwatch_ = new Fpswatch();
	            this.onTick_ = this.onTick_.bind(this);
	            this.ticker_ = config.ticker;
	            this.ticker_.emitter.on('tick', this.onTick_);
	            this.value_ = config.value;
	            this.viewProps = config.viewProps;
	            this.view = new FpsView(doc, {
	                viewProps: this.viewProps,
	            });
	            this.graphC_ = new GraphLogController(doc, {
	                formatter: createNumberFormatter(0),
	                lineCount: config.lineCount,
	                props: ValueMap.fromObject({
	                    maxValue: config.maxValue,
	                    minValue: config.minValue,
	                }),
	                value: this.value_,
	                viewProps: this.viewProps,
	            });
	            this.view.graphElement.appendChild(this.graphC_.view.element);
	            this.viewProps.handleDispose(() => {
	                this.graphC_.viewProps.set('disposed', true);
	                this.ticker_.dispose();
	            });
	        }
	        begin() {
	            this.stopwatch_.begin(new Date());
	        }
	        end() {
	            this.stopwatch_.end(new Date());
	        }
	        onTick_() {
	            const fps = this.stopwatch_.fps;
	            if (fps !== null) {
	                const buffer = this.value_.rawValue;
	                this.value_.rawValue = createPushedBuffer(buffer, fps);
	                this.view.valueElement.textContent = fps.toFixed(0);
	            }
	        }
	    }

	    function createTicker(document, interval) {
	        return interval === 0
	            ? new ManualTicker()
	            : new IntervalTicker(document, interval !== null && interval !== void 0 ? interval : Constants.monitor.defaultInterval);
	    }
	    const FpsGraphBladePlugin = {
	        id: 'fpsgraph',
	        type: 'blade',
	        accept(params) {
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                view: p.required.constant('fpsgraph'),
	                interval: p.optional.number,
	                label: p.optional.string,
	                lineCount: p.optional.number,
	                max: p.optional.number,
	                min: p.optional.number,
	            });
	            return result ? { params: result } : null;
	        },
	        controller(args) {
	            var _a, _b, _c, _d;
	            const interval = (_a = args.params.interval) !== null && _a !== void 0 ? _a : 500;
	            return new LabelController(args.document, {
	                blade: args.blade,
	                props: ValueMap.fromObject({
	                    label: args.params.label,
	                }),
	                valueController: new FpsGraphController(args.document, {
	                    lineCount: (_b = args.params.lineCount) !== null && _b !== void 0 ? _b : 2,
	                    maxValue: (_c = args.params.max) !== null && _c !== void 0 ? _c : 90,
	                    minValue: (_d = args.params.min) !== null && _d !== void 0 ? _d : 0,
	                    ticker: createTicker(args.document, interval),
	                    value: initializeBuffer(80),
	                    viewProps: args.viewProps,
	                }),
	            });
	        },
	        api(args) {
	            if (!(args.controller instanceof LabelController)) {
	                return null;
	            }
	            if (!(args.controller.valueController instanceof FpsGraphController)) {
	                return null;
	            }
	            return new FpsGraphBladeApi(args.controller);
	        },
	    };

	    class Interval {
	        constructor(min, max) {
	            this.min = min;
	            this.max = max;
	        }
	        static isObject(obj) {
	            if (typeof obj !== 'object' || obj === null) {
	                return false;
	            }
	            const min = obj.min;
	            const max = obj.max;
	            if (typeof min !== 'number' || typeof max !== 'number') {
	                return false;
	            }
	            return true;
	        }
	        static equals(v1, v2) {
	            return v1.min === v2.min && v1.max === v2.max;
	        }
	        get length() {
	            return this.max - this.min;
	        }
	        toObject() {
	            return {
	                min: this.min,
	                max: this.max,
	            };
	        }
	    }
	    const IntervalAssembly = {
	        fromComponents: (comps) => new Interval(comps[0], comps[1]),
	        toComponents: (p) => [p.min, p.max],
	    };

	    class IntervalConstraint {
	        constructor(edge) {
	            this.edge = edge;
	        }
	        constrain(value) {
	            var _a, _b, _c, _d, _e, _f, _g, _h;
	            if (value.min <= value.max) {
	                return new Interval((_b = (_a = this.edge) === null || _a === void 0 ? void 0 : _a.constrain(value.min)) !== null && _b !== void 0 ? _b : value.min, (_d = (_c = this.edge) === null || _c === void 0 ? void 0 : _c.constrain(value.max)) !== null && _d !== void 0 ? _d : value.max);
	            }
	            const c = (value.min + value.max) / 2;
	            return new Interval((_f = (_e = this.edge) === null || _e === void 0 ? void 0 : _e.constrain(c)) !== null && _f !== void 0 ? _f : c, (_h = (_g = this.edge) === null || _g === void 0 ? void 0 : _g.constrain(c)) !== null && _h !== void 0 ? _h : c);
	        }
	    }

	    const className$2 = ClassName('rsltxt');
	    class RangeSliderTextView {
	        constructor(doc, config) {
	            this.sliderView_ = config.sliderView;
	            this.textView_ = config.textView;
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$2());
	            const sliderElem = doc.createElement('div');
	            sliderElem.classList.add(className$2('s'));
	            sliderElem.appendChild(this.sliderView_.element);
	            this.element.appendChild(sliderElem);
	            const textElem = doc.createElement('div');
	            textElem.classList.add(className$2('t'));
	            textElem.appendChild(this.textView_.element);
	            this.element.appendChild(textElem);
	        }
	    }

	    const className$1 = ClassName('rsl');
	    class RangeSliderView {
	        constructor(doc, config) {
	            this.onSliderPropsChange_ = this.onSliderPropsChange_.bind(this);
	            this.onValueChange_ = this.onValueChange_.bind(this);
	            this.sliderProps_ = config.sliderProps;
	            this.sliderProps_.emitter.on('change', this.onSliderPropsChange_);
	            this.element = doc.createElement('div');
	            this.element.classList.add(className$1());
	            config.viewProps.bindClassModifiers(this.element);
	            this.value_ = config.value;
	            this.value_.emitter.on('change', this.onValueChange_);
	            const trackElem = doc.createElement('div');
	            trackElem.classList.add(className$1('t'));
	            this.element.appendChild(trackElem);
	            this.trackElement = trackElem;
	            const barElem = doc.createElement('div');
	            barElem.classList.add(className$1('b'));
	            trackElem.appendChild(barElem);
	            this.barElement = barElem;
	            const knobElems = ['min', 'max'].map((modifier) => {
	                const elem = doc.createElement('div');
	                elem.classList.add(className$1('k'), className$1('k', modifier));
	                trackElem.appendChild(elem);
	                return elem;
	            });
	            this.knobElements = [knobElems[0], knobElems[1]];
	            this.update_();
	        }
	        valueToX_(value) {
	            const min = this.sliderProps_.get('minValue');
	            const max = this.sliderProps_.get('maxValue');
	            return constrainRange(mapRange(value, min, max, 0, 1), 0, 1) * 100;
	        }
	        update_() {
	            const v = this.value_.rawValue;
	            if (v.length === 0) {
	                this.element.classList.add(className$1(undefined, 'zero'));
	            }
	            else {
	                this.element.classList.remove(className$1(undefined, 'zero'));
	            }
	            const xs = [this.valueToX_(v.min), this.valueToX_(v.max)];
	            this.barElement.style.left = `${xs[0]}%`;
	            this.barElement.style.right = `${100 - xs[1]}%`;
	            this.knobElements.forEach((elem, index) => {
	                elem.style.left = `${xs[index]}%`;
	            });
	        }
	        onSliderPropsChange_() {
	            this.update_();
	        }
	        onValueChange_() {
	            this.update_();
	        }
	    }

	    class RangeSliderController {
	        constructor(doc, config) {
	            this.grabbing_ = null;
	            this.grabOffset_ = 0;
	            this.onPointerDown_ = this.onPointerDown_.bind(this);
	            this.onPointerMove_ = this.onPointerMove_.bind(this);
	            this.onPointerUp_ = this.onPointerUp_.bind(this);
	            this.sliderProps = config.sliderProps;
	            this.viewProps = config.viewProps;
	            this.value = config.value;
	            this.view = new RangeSliderView(doc, {
	                sliderProps: this.sliderProps,
	                value: this.value,
	                viewProps: config.viewProps,
	            });
	            const ptHandler = new PointerHandler(this.view.trackElement);
	            ptHandler.emitter.on('down', this.onPointerDown_);
	            ptHandler.emitter.on('move', this.onPointerMove_);
	            ptHandler.emitter.on('up', this.onPointerUp_);
	        }
	        ofs_() {
	            if (this.grabbing_ === 'min') {
	                return this.view.knobElements[0].getBoundingClientRect().width / 2;
	            }
	            if (this.grabbing_ === 'max') {
	                return -this.view.knobElements[1].getBoundingClientRect().width / 2;
	            }
	            return 0;
	        }
	        valueFromData_(data) {
	            if (!data.point) {
	                return null;
	            }
	            const p = (data.point.x + this.ofs_()) / data.bounds.width;
	            const min = this.sliderProps.get('minValue');
	            const max = this.sliderProps.get('maxValue');
	            return mapRange(p, 0, 1, min, max);
	        }
	        onPointerDown_(ev) {
	            if (!ev.data.point) {
	                return;
	            }
	            const p = ev.data.point.x / ev.data.bounds.width;
	            const v = this.value.rawValue;
	            const min = this.sliderProps.get('minValue');
	            const max = this.sliderProps.get('maxValue');
	            const pmin = mapRange(v.min, min, max, 0, 1);
	            const pmax = mapRange(v.max, min, max, 0, 1);
	            if (Math.abs(pmax - p) <= 0.025) {
	                this.grabbing_ = 'max';
	            }
	            else if (Math.abs(pmin - p) <= 0.025) {
	                this.grabbing_ = 'min';
	            }
	            else if (p >= pmin && p <= pmax) {
	                this.grabbing_ = 'length';
	                this.grabOffset_ = mapRange(p - pmin, 0, 1, 0, max - min);
	            }
	            else if (p < pmin) {
	                this.grabbing_ = 'min';
	                this.onPointerMove_(ev);
	            }
	            else if (p > pmax) {
	                this.grabbing_ = 'max';
	                this.onPointerMove_(ev);
	            }
	        }
	        applyPointToValue_(data, opts) {
	            const v = this.valueFromData_(data);
	            if (v === null) {
	                return;
	            }
	            const rmin = this.sliderProps.get('minValue');
	            const rmax = this.sliderProps.get('maxValue');
	            if (this.grabbing_ === 'min') {
	                this.value.setRawValue(new Interval(v, this.value.rawValue.max), opts);
	            }
	            else if (this.grabbing_ === 'max') {
	                this.value.setRawValue(new Interval(this.value.rawValue.min, v), opts);
	            }
	            else if (this.grabbing_ === 'length') {
	                const len = this.value.rawValue.length;
	                let min = v - this.grabOffset_;
	                let max = min + len;
	                if (min < rmin) {
	                    min = rmin;
	                    max = rmin + len;
	                }
	                else if (max > rmax) {
	                    min = rmax - len;
	                    max = rmax;
	                }
	                this.value.setRawValue(new Interval(min, max), opts);
	            }
	        }
	        onPointerMove_(ev) {
	            this.applyPointToValue_(ev.data, {
	                forceEmit: false,
	                last: false,
	            });
	        }
	        onPointerUp_(ev) {
	            this.applyPointToValue_(ev.data, {
	                forceEmit: true,
	                last: true,
	            });
	            this.grabbing_ = null;
	        }
	    }

	    class RangeSliderTextController {
	        constructor(doc, config) {
	            this.value = config.value;
	            this.viewProps = config.viewProps;
	            this.sc_ = new RangeSliderController(doc, config);
	            const axis = {
	                baseStep: config.baseStep,
	                constraint: config.constraint,
	                textProps: ValueMap.fromObject({
	                    draggingScale: config.draggingScale,
	                    formatter: config.formatter,
	                }),
	            };
	            this.tc_ = new PointNdTextController(doc, {
	                assembly: IntervalAssembly,
	                axes: [axis, axis],
	                parser: config.parser,
	                value: this.value,
	                viewProps: config.viewProps,
	            });
	            this.view = new RangeSliderTextView(doc, {
	                sliderView: this.sc_.view,
	                textView: this.tc_.view,
	            });
	        }
	        get textController() {
	            return this.tc_;
	        }
	    }

	    function intervalFromUnknown(value) {
	        return Interval.isObject(value)
	            ? new Interval(value.min, value.max)
	            : new Interval(0, 0);
	    }
	    function writeInterval(target, value) {
	        target.writeProperty('max', value.max);
	        target.writeProperty('min', value.min);
	    }

	    function createConstraint(params) {
	        const constraints = [];
	        const rc = createRangeConstraint(params);
	        if (rc) {
	            constraints.push(rc);
	        }
	        const sc = createStepConstraint(params);
	        if (sc) {
	            constraints.push(sc);
	        }
	        return new IntervalConstraint(new CompositeConstraint(constraints));
	    }
	    const IntervalInputPlugin = {
	        id: 'input-interval',
	        type: 'input',
	        css: '.tp-cbzgv,.tp-radv_b,.tp-rslv_k,.tp-cbzv_b{-webkit-appearance:none;-moz-appearance:none;appearance:none;background-color:rgba(0,0,0,0);border-width:0;font-family:inherit;font-size:inherit;font-weight:inherit;margin:0;outline:none;padding:0}.tp-radv_b,.tp-rslv_k,.tp-cbzv_b{background-color:var(--btn-bg);border-radius:var(--elm-br);color:var(--btn-fg);cursor:pointer;display:block;font-weight:bold;height:var(--bld-us);line-height:var(--bld-us);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tp-radv_b:hover,.tp-rslv_k:hover,.tp-cbzv_b:hover{background-color:var(--btn-bg-h)}.tp-radv_b:focus,.tp-rslv_k:focus,.tp-cbzv_b:focus{background-color:var(--btn-bg-f)}.tp-radv_b:active,.tp-rslv_k:active,.tp-cbzv_b:active{background-color:var(--btn-bg-a)}.tp-radv_b:disabled,.tp-rslv_k:disabled,.tp-cbzv_b:disabled{opacity:.5}.tp-cbzgv{background-color:var(--in-bg);border-radius:var(--elm-br);box-sizing:border-box;color:var(--in-fg);font-family:inherit;height:var(--bld-us);line-height:var(--bld-us);min-width:0;width:100%}.tp-cbzgv:hover{background-color:var(--in-bg-h)}.tp-cbzgv:focus{background-color:var(--in-bg-f)}.tp-cbzgv:active{background-color:var(--in-bg-a)}.tp-cbzgv:disabled{opacity:.5}.tp-btngridv{border-radius:var(--elm-br);display:grid;overflow:hidden;gap:2px}.tp-btngridv.tp-v-disabled{opacity:.5}.tp-btngridv .tp-btnv_b:disabled{opacity:1}.tp-btngridv .tp-btnv_b:disabled .tp-btnv_t{opacity:.5}.tp-btngridv .tp-btnv_b{border-radius:0}.tp-cbzv{position:relative}.tp-cbzv_h{display:flex}.tp-cbzv_b{margin-right:4px;position:relative;width:var(--bld-us)}.tp-cbzv_b svg{display:block;height:16px;left:50%;margin-left:-8px;margin-top:-8px;position:absolute;top:50%;width:16px}.tp-cbzv_b svg path{stroke:var(--bs-bg);stroke-width:2}.tp-cbzv_t{flex:1}.tp-cbzv_p{height:0;margin-top:0;opacity:0;overflow:hidden;transition:height .2s ease-in-out,opacity .2s linear,margin .2s ease-in-out}.tp-cbzv.tp-cbzv-expanded .tp-cbzv_p{margin-top:var(--bld-s);opacity:1}.tp-cbzv.tp-cbzv-cpl .tp-cbzv_p{overflow:visible}.tp-cbzv .tp-popv{left:calc(-1*var(--cnt-h-p));position:absolute;right:calc(-1*var(--cnt-h-p));top:var(--bld-us)}.tp-cbzpv_t{margin-top:var(--bld-s)}.tp-cbzgv{height:auto;overflow:hidden;position:relative}.tp-cbzgv.tp-v-disabled{opacity:.5}.tp-cbzgv_p{left:16px;position:absolute;right:16px;top:0}.tp-cbzgv_g{cursor:pointer;display:block;height:calc(var(--bld-us)*5);width:100%}.tp-cbzgv_u{opacity:.1;stroke:var(--in-fg);stroke-dasharray:1}.tp-cbzgv_l{fill:rgba(0,0,0,0);stroke:var(--in-fg)}.tp-cbzgv_v{opacity:.5;stroke:var(--in-fg);stroke-dasharray:1}.tp-cbzgv_h{border:var(--in-fg) solid 1px;border-radius:50%;box-sizing:border-box;height:4px;margin-left:-2px;margin-top:-2px;pointer-events:none;position:absolute;width:4px}.tp-cbzgv:focus .tp-cbzgv_h-sel{background-color:var(--in-fg);border-width:0}.tp-cbzprvv{cursor:pointer;height:4px;padding:4px 0;position:relative}.tp-cbzprvv_g{display:block;height:100%;overflow:visible;width:100%}.tp-cbzprvv_t{opacity:.5;stroke:var(--mo-fg)}.tp-cbzprvv_m{background-color:var(--mo-fg);border-radius:50%;height:4px;margin-left:-2px;margin-top:-2px;opacity:0;position:absolute;top:50%;transition:opacity .2s ease-out;width:4px}.tp-cbzprvv_m.tp-cbzprvv_m-a{opacity:1}.tp-fpsv{position:relative}.tp-fpsv_l{bottom:4px;color:var(--mo-fg);line-height:1;right:4px;pointer-events:none;position:absolute}.tp-fpsv_u{margin-left:.2em;opacity:.7}.tp-rslv{cursor:pointer;padding-left:8px;padding-right:8px}.tp-rslv.tp-v-disabled{opacity:.5}.tp-rslv_t{height:calc(var(--bld-us));position:relative}.tp-rslv_t::before{background-color:var(--in-bg);border-radius:1px;content:"";height:2px;margin-top:-1px;position:absolute;top:50%;left:-4px;right:-4px}.tp-rslv_b{bottom:0;top:0;position:absolute}.tp-rslv_b::before{background-color:var(--in-fg);content:"";height:2px;margin-top:-1px;position:absolute;top:50%;left:0;right:0}.tp-rslv_k{height:calc(var(--bld-us) - 8px);margin-top:calc((var(--bld-us) - 8px)/-2);position:absolute;top:50%;width:8px}.tp-rslv_k.tp-rslv_k-min{margin-left:-8px}.tp-rslv_k.tp-rslv_k-max{margin-left:0}.tp-rslv.tp-rslv-zero .tp-rslv_k.tp-rslv_k-min{border-bottom-right-radius:0;border-top-right-radius:0}.tp-rslv.tp-rslv-zero .tp-rslv_k.tp-rslv_k-max{border-bottom-left-radius:0;border-top-left-radius:0}.tp-rsltxtv{display:flex}.tp-rsltxtv_s{flex:1}.tp-rsltxtv_t{flex:1;margin-left:4px}.tp-radv_l{display:block;position:relative}.tp-radv_i{left:0;opacity:0;position:absolute;top:0}.tp-radv_b{opacity:.5}.tp-radv_i:hover+.tp-radv_b{background-color:var(--btn-bg-h)}.tp-radv_i:focus+.tp-radv_b{background-color:var(--btn-bg-f)}.tp-radv_i:active+.tp-radv_b{background-color:var(--btn-bg-a)}.tp-radv_i:checked+.tp-radv_b{opacity:1}.tp-radv_t{bottom:0;color:inherit;left:0;overflow:hidden;position:absolute;right:0;text-align:center;text-overflow:ellipsis;top:0}.tp-radv_i:disabled+.tp-radv_b>.tp-radv_t{opacity:.5}.tp-radgridv{border-radius:var(--elm-br);display:grid;overflow:hidden;gap:2px}.tp-radgridv.tp-v-disabled{opacity:.5}.tp-radgridv .tp-radv_b{border-radius:0}',
	        accept: (exValue, params) => {
	            if (!Interval.isObject(exValue)) {
	                return null;
	            }
	            const p = ParamsParsers;
	            const result = parseParams(params, {
	                format: p.optional.function,
	                max: p.optional.number,
	                min: p.optional.number,
	                step: p.optional.number,
	            });
	            return result
	                ? {
	                    initialValue: new Interval(exValue.min, exValue.max),
	                    params: result,
	                }
	                : null;
	        },
	        binding: {
	            reader: (_args) => intervalFromUnknown,
	            constraint: (args) => createConstraint(args.params),
	            equals: Interval.equals,
	            writer: (_args) => writeInterval,
	        },
	        controller(args) {
	            var _a;
	            const v = args.value;
	            const c = args.constraint;
	            if (!(c instanceof IntervalConstraint)) {
	                throw TpError.shouldNeverHappen();
	            }
	            const midValue = (v.rawValue.min + v.rawValue.max) / 2;
	            const formatter = (_a = args.params.format) !== null && _a !== void 0 ? _a : createNumberFormatter(getSuitableDecimalDigits(c.edge, midValue));
	            const drc = c.edge && findConstraint(c.edge, DefiniteRangeConstraint);
	            if (drc) {
	                return new RangeSliderTextController(args.document, {
	                    baseStep: getBaseStep(c.edge),
	                    constraint: c.edge,
	                    draggingScale: getSuitableDraggingScale(c.edge, midValue),
	                    formatter: formatter,
	                    parser: parseNumber,
	                    sliderProps: new ValueMap({
	                        maxValue: drc.values.value('max'),
	                        minValue: drc.values.value('min'),
	                    }),
	                    value: v,
	                    viewProps: args.viewProps,
	                });
	            }
	            const axis = {
	                baseStep: getBaseStep(c.edge),
	                constraint: c.edge,
	                textProps: ValueMap.fromObject({
	                    draggingScale: midValue,
	                    formatter: formatter,
	                }),
	            };
	            return new PointNdTextController(args.document, {
	                assembly: IntervalAssembly,
	                axes: [axis, axis],
	                parser: parseNumber,
	                value: v,
	                viewProps: args.viewProps,
	            });
	        },
	    };

	    class RadioCellApi {
	        constructor(controller) {
	            this.controller_ = controller;
	        }
	        get disabled() {
	            return this.controller_.viewProps.get('disabled');
	        }
	        set disabled(disabled) {
	            this.controller_.viewProps.set('disabled', disabled);
	        }
	        get title() {
	            var _a;
	            return (_a = this.controller_.props.get('title')) !== null && _a !== void 0 ? _a : '';
	        }
	        set title(title) {
	            this.controller_.props.set('title', title);
	        }
	    }

	    class TpRadioGridChangeEvent extends TpChangeEvent {
	        constructor(target, cell, index, value, presetKey) {
	            super(target, value, presetKey);
	            this.cell = cell;
	            this.index = index;
	        }
	    }

	    class RadioGridApi extends BladeApi {
	        constructor(controller) {
	            super(controller);
	            this.cellToApiMap_ = new Map();
	            const gc = this.controller_.valueController;
	            gc.cellControllers.forEach((cc) => {
	                const api = new RadioCellApi(cc);
	                this.cellToApiMap_.set(cc, api);
	            });
	        }
	        get value() {
	            return this.controller_.value;
	        }
	        cell(x, y) {
	            const gc = this.controller_.valueController;
	            const cc = gc.cellControllers[y * gc.size[0] + x];
	            return this.cellToApiMap_.get(cc);
	        }
	        on(eventName, handler) {
	            const bh = handler.bind(this);
	            this.controller_.value.emitter.on(eventName, (ev) => {
	                const gc = this.controller_.valueController;
	                const cc = gc.findCellByValue(ev.rawValue);
	                if (!cc) {
	                    return;
	                }
	                const capi = this.cellToApiMap_.get(cc);
	                if (!capi) {
	                    return;
	                }
	                const i = gc.cellControllers.indexOf(cc);
	                bh(new TpRadioGridChangeEvent(this, capi, [i % gc.size[0], Math.floor(i / gc.size[0])], ev.rawValue, undefined));
	            });
	        }
	    }

	    const className = ClassName('rad');
	    class RadioView {
	        constructor(doc, config) {
	            this.element = doc.createElement('div');
	            this.element.classList.add(className());
	            config.viewProps.bindClassModifiers(this.element);
	            const labelElem = doc.createElement('label');
	            labelElem.classList.add(className('l'));
	            this.element.appendChild(labelElem);
	            const inputElem = doc.createElement('input');
	            inputElem.classList.add(className('i'));
	            inputElem.name = config.name;
	            inputElem.type = 'radio';
	            config.viewProps.bindDisabled(inputElem);
	            labelElem.appendChild(inputElem);
	            this.inputElement = inputElem;
	            const bodyElem = doc.createElement('div');
	            bodyElem.classList.add(className('b'));
	            labelElem.appendChild(bodyElem);
	            const titleElem = doc.createElement('div');
	            titleElem.classList.add(className('t'));
	            bodyElem.appendChild(titleElem);
	            bindValueMap(config.props, 'title', (title) => {
	                titleElem.textContent = title;
	            });
	        }
	    }

	    class RadioController {
	        constructor(doc, config) {
	            this.props = config.props;
	            this.viewProps = config.viewProps;
	            this.view = new RadioView(doc, {
	                name: config.name,
	                props: this.props,
	                viewProps: this.viewProps,
	            });
	        }
	    }

	    class RadioGridController {
	        constructor(doc, config) {
	            this.cellCs_ = [];
	            this.cellValues_ = [];
	            this.onCellInputChange_ = this.onCellInputChange_.bind(this);
	            this.size = config.size;
	            const [w, h] = this.size;
	            for (let y = 0; y < h; y++) {
	                for (let x = 0; x < w; x++) {
	                    const bc = new RadioController(doc, {
	                        name: config.groupName,
	                        props: ValueMap.fromObject(Object.assign({}, config.cellConfig(x, y))),
	                        viewProps: ViewProps.create(),
	                    });
	                    this.cellCs_.push(bc);
	                    this.cellValues_.push(config.cellConfig(x, y).value);
	                }
	            }
	            this.value = config.value;
	            bindValue(this.value, (value) => {
	                const cc = this.findCellByValue(value);
	                if (!cc) {
	                    return;
	                }
	                cc.view.inputElement.checked = true;
	            });
	            this.viewProps = ViewProps.create();
	            this.view = new PlainView(doc, {
	                viewProps: this.viewProps,
	                viewName: 'radgrid',
	            });
	            this.view.element.style.gridTemplateColumns = `repeat(${w}, 1fr)`;
	            this.cellCs_.forEach((bc) => {
	                bc.view.inputElement.addEventListener('change', this.onCellInputChange_);
	                this.view.element.appendChild(bc.view.element);
	            });
	        }
	        get cellControllers() {
	            return this.cellCs_;
	        }
	        findCellByValue(value) {
	            const index = this.cellValues_.findIndex((v) => v === value);
	            if (index < 0) {
	                return null;
	            }
	            return this.cellCs_[index];
	        }
	        onCellInputChange_(ev) {
	            const inputElem = ev.currentTarget;
	            const index = this.cellCs_.findIndex((c) => c.view.inputElement === inputElem);
	            if (index < 0) {
	                return;
	            }
	            this.value.rawValue = this.cellValues_[index];
	        }
	    }

	    const RadioGridBladePlugin = (function () {
	        return {
	            id: 'radiogrid',
	            type: 'blade',
	            accept(params) {
	                const p = ParamsParsers;
	                const result = parseParams(params, {
	                    cells: p.required.function,
	                    groupName: p.required.string,
	                    size: p.required.array(p.required.number),
	                    value: p.required.raw,
	                    view: p.required.constant('radiogrid'),
	                    label: p.optional.string,
	                });
	                return result ? { params: result } : null;
	            },
	            controller(args) {
	                return new LabeledValueController(args.document, {
	                    blade: args.blade,
	                    props: ValueMap.fromObject({
	                        label: args.params.label,
	                    }),
	                    valueController: new RadioGridController(args.document, {
	                        groupName: args.params.groupName,
	                        cellConfig: args.params.cells,
	                        size: args.params.size,
	                        value: createValue(args.params.value),
	                    }),
	                });
	            },
	            api(args) {
	                if (!(args.controller instanceof LabeledValueController)) {
	                    return null;
	                }
	                if (!(args.controller.valueController instanceof RadioGridController)) {
	                    return null;
	                }
	                return new RadioGridApi(args.controller);
	            },
	        };
	    })();

	    function createRadioGridInputPlugin(config) {
	        return {
	            id: 'input-radiogrid',
	            type: 'input',
	            accept(value, params) {
	                if (!config.isType(value)) {
	                    return null;
	                }
	                const p = ParamsParsers;
	                const result = parseParams(params, {
	                    cells: p.required.function,
	                    groupName: p.required.string,
	                    size: p.required.array(p.required.number),
	                    view: p.required.constant('radiogrid'),
	                });
	                return result
	                    ? {
	                        initialValue: value,
	                        params: result,
	                    }
	                    : null;
	            },
	            binding: config.binding,
	            controller: (args) => {
	                return new RadioGridController(args.document, {
	                    cellConfig: args.params.cells,
	                    groupName: args.params.groupName,
	                    size: args.params.size,
	                    value: args.value,
	                });
	            },
	        };
	    }
	    const RadioGruidNumberInputPlugin = createRadioGridInputPlugin({
	        isType: (value) => {
	            return typeof value === 'number';
	        },
	        binding: {
	            reader: (_args) => numberFromUnknown,
	            writer: (_args) => writePrimitive,
	        },
	    });
	    const RadioGruidStringInputPlugin = createRadioGridInputPlugin({
	        isType: (value) => {
	            return typeof value === 'string';
	        },
	        binding: {
	            reader: (_args) => stringFromUnknown,
	            writer: (_args) => writePrimitive,
	        },
	    });
	    const RadioGruidBooleanInputPlugin = createRadioGridInputPlugin({
	        isType: (value) => {
	            return typeof value === 'boolean';
	        },
	        binding: {
	            reader: (_args) => boolFromUnknown,
	            writer: (_args) => writePrimitive,
	        },
	    });

	    const plugins = [
	        ButtonGridBladePlugin,
	        CubicBezierBladePlugin,
	        FpsGraphBladePlugin,
	        IntervalInputPlugin,
	        RadioGridBladePlugin,
	        RadioGruidBooleanInputPlugin,
	        RadioGruidNumberInputPlugin,
	        RadioGruidStringInputPlugin,
	    ];

	    exports.ButtonCellApi = ButtonCellApi;
	    exports.ButtonGridApi = ButtonGridApi;
	    exports.ButtonGridController = ButtonGridController;
	    exports.CubicBezier = CubicBezier;
	    exports.CubicBezierApi = CubicBezierApi;
	    exports.CubicBezierAssembly = CubicBezierAssembly;
	    exports.CubicBezierController = CubicBezierController;
	    exports.CubicBezierGraphController = CubicBezierGraphController;
	    exports.CubicBezierGraphView = CubicBezierGraphView;
	    exports.CubicBezierPickerController = CubicBezierPickerController;
	    exports.CubicBezierPickerView = CubicBezierPickerView;
	    exports.CubicBezierPreviewView = CubicBezierPreviewView;
	    exports.CubicBezierView = CubicBezierView;
	    exports.FpsGraphBladeApi = FpsGraphBladeApi;
	    exports.FpsGraphController = FpsGraphController;
	    exports.FpsView = FpsView;
	    exports.Fpswatch = Fpswatch;
	    exports.Interval = Interval;
	    exports.IntervalAssembly = IntervalAssembly;
	    exports.IntervalConstraint = IntervalConstraint;
	    exports.RadioCellApi = RadioCellApi;
	    exports.RadioController = RadioController;
	    exports.RadioGridApi = RadioGridApi;
	    exports.RadioGridController = RadioGridController;
	    exports.RadioView = RadioView;
	    exports.RangeSliderController = RangeSliderController;
	    exports.RangeSliderTextController = RangeSliderTextController;
	    exports.RangeSliderTextView = RangeSliderTextView;
	    exports.RangeSliderView = RangeSliderView;
	    exports.TpRadioGridChangeEvent = TpRadioGridChangeEvent;
	    exports.plugins = plugins;

	    Object.defineProperty(exports, '__esModule', { value: true });

	}));
} (tweakpanePluginEssentials$1, tweakpanePluginEssentialsExports));

var tweakpanePluginEssentials = /*@__PURE__*/getDefaultExportFromCjs(tweakpanePluginEssentialsExports);

var EssentialsPlugin = /*#__PURE__*/_mergeNamespaces({
  __proto__: null,
  default: tweakpanePluginEssentials
}, [tweakpanePluginEssentialsExports]);

function assert(condition, message) {
  if (!condition) {
    throw new Error("math.gl assertion ".concat(message));
  }
}

const config = {
  EPSILON: 1e-12,
  debug: false,
  precision: 4,
  printTypes: false,
  printDegrees: false,
  printRowMajor: true
};
function formatValue(value, {
  precision = config.precision
} = {}) {
  value = round(value);
  return "".concat(parseFloat(value.toPrecision(precision)));
}
function isArray(value) {
  return Array.isArray(value) || ArrayBuffer.isView(value) && !(value instanceof DataView);
}
function equals(a, b, epsilon) {
  const oldEpsilon = config.EPSILON;

  if (epsilon) {
    config.EPSILON = epsilon;
  }

  try {
    if (a === b) {
      return true;
    }

    if (isArray(a) && isArray(b)) {
      if (a.length !== b.length) {
        return false;
      }

      for (let i = 0; i < a.length; ++i) {
        if (!equals(a[i], b[i])) {
          return false;
        }
      }

      return true;
    }

    if (a && a.equals) {
      return a.equals(b);
    }

    if (b && b.equals) {
      return b.equals(a);
    }

    if (typeof a === 'number' && typeof b === 'number') {
      return Math.abs(a - b) <= config.EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
    }

    return false;
  } finally {
    config.EPSILON = oldEpsilon;
  }
}

function round(value) {
  return Math.round(value / config.EPSILON) * config.EPSILON;
}

function _extendableBuiltin(cls) {
  function ExtendableBuiltin() {
    var instance = Reflect.construct(cls, Array.from(arguments));
    Object.setPrototypeOf(instance, Object.getPrototypeOf(this));
    return instance;
  }

  ExtendableBuiltin.prototype = Object.create(cls.prototype, {
    constructor: {
      value: cls,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });

  if (Object.setPrototypeOf) {
    Object.setPrototypeOf(ExtendableBuiltin, cls);
  } else {
    ExtendableBuiltin.__proto__ = cls;
  }

  return ExtendableBuiltin;
}
class MathArray extends _extendableBuiltin(Array) {
  clone() {
    return new this.constructor().copy(this);
  }

  fromArray(array, offset = 0) {
    for (let i = 0; i < this.ELEMENTS; ++i) {
      this[i] = array[i + offset];
    }

    return this.check();
  }

  toArray(targetArray = [], offset = 0) {
    for (let i = 0; i < this.ELEMENTS; ++i) {
      targetArray[offset + i] = this[i];
    }

    return targetArray;
  }

  from(arrayOrObject) {
    return Array.isArray(arrayOrObject) ? this.copy(arrayOrObject) : this.fromObject(arrayOrObject);
  }

  to(arrayOrObject) {
    if (arrayOrObject === this) {
      return this;
    }

    return isArray(arrayOrObject) ? this.toArray(arrayOrObject) : this.toObject(arrayOrObject);
  }

  toTarget(target) {
    return target ? this.to(target) : this;
  }

  toFloat32Array() {
    return new Float32Array(this);
  }

  toString() {
    return this.formatString(config);
  }

  formatString(opts) {
    let string = '';

    for (let i = 0; i < this.ELEMENTS; ++i) {
      string += (i > 0 ? ', ' : '') + formatValue(this[i], opts);
    }

    return "".concat(opts.printTypes ? this.constructor.name : '', "[").concat(string, "]");
  }

  equals(array) {
    if (!array || this.length !== array.length) {
      return false;
    }

    for (let i = 0; i < this.ELEMENTS; ++i) {
      if (!equals(this[i], array[i])) {
        return false;
      }
    }

    return true;
  }

  exactEquals(array) {
    if (!array || this.length !== array.length) {
      return false;
    }

    for (let i = 0; i < this.ELEMENTS; ++i) {
      if (this[i] !== array[i]) {
        return false;
      }
    }

    return true;
  }

  negate() {
    for (let i = 0; i < this.ELEMENTS; ++i) {
      this[i] = -this[i];
    }

    return this.check();
  }

  lerp(a, b, t) {
    if (t === undefined) {
      return this.lerp(this, a, b);
    }

    for (let i = 0; i < this.ELEMENTS; ++i) {
      const ai = a[i];
      this[i] = ai + t * (b[i] - ai);
    }

    return this.check();
  }

  min(vector) {
    for (let i = 0; i < this.ELEMENTS; ++i) {
      this[i] = Math.min(vector[i], this[i]);
    }

    return this.check();
  }

  max(vector) {
    for (let i = 0; i < this.ELEMENTS; ++i) {
      this[i] = Math.max(vector[i], this[i]);
    }

    return this.check();
  }

  clamp(minVector, maxVector) {
    for (let i = 0; i < this.ELEMENTS; ++i) {
      this[i] = Math.min(Math.max(this[i], minVector[i]), maxVector[i]);
    }

    return this.check();
  }

  add(...vectors) {
    for (const vector of vectors) {
      for (let i = 0; i < this.ELEMENTS; ++i) {
        this[i] += vector[i];
      }
    }

    return this.check();
  }

  subtract(...vectors) {
    for (const vector of vectors) {
      for (let i = 0; i < this.ELEMENTS; ++i) {
        this[i] -= vector[i];
      }
    }

    return this.check();
  }

  scale(scale) {
    if (typeof scale === 'number') {
      for (let i = 0; i < this.ELEMENTS; ++i) {
        this[i] *= scale;
      }
    } else {
      for (let i = 0; i < this.ELEMENTS && i < scale.length; ++i) {
        this[i] *= scale[i];
      }
    }

    return this.check();
  }

  multiplyByScalar(scalar) {
    for (let i = 0; i < this.ELEMENTS; ++i) {
      this[i] *= scalar;
    }

    return this.check();
  }

  check() {
    if (config.debug && !this.validate()) {
      throw new Error("math.gl: ".concat(this.constructor.name, " some fields set to invalid numbers'"));
    }

    return this;
  }

  validate() {
    let valid = this.length === this.ELEMENTS;

    for (let i = 0; i < this.ELEMENTS; ++i) {
      valid = valid && Number.isFinite(this[i]);
    }

    return valid;
  }

  sub(a) {
    return this.subtract(a);
  }

  setScalar(a) {
    for (let i = 0; i < this.ELEMENTS; ++i) {
      this[i] = a;
    }

    return this.check();
  }

  addScalar(a) {
    for (let i = 0; i < this.ELEMENTS; ++i) {
      this[i] += a;
    }

    return this.check();
  }

  subScalar(a) {
    return this.addScalar(-a);
  }

  multiplyScalar(scalar) {
    for (let i = 0; i < this.ELEMENTS; ++i) {
      this[i] *= scalar;
    }

    return this.check();
  }

  divideScalar(a) {
    return this.multiplyByScalar(1 / a);
  }

  clampScalar(min, max) {
    for (let i = 0; i < this.ELEMENTS; ++i) {
      this[i] = Math.min(Math.max(this[i], min), max);
    }

    return this.check();
  }

  get elements() {
    return this;
  }

}

function checkNumber(value) {
  if (!Number.isFinite(value)) {
    throw new Error("Invalid number ".concat(value));
  }

  return value;
}

class Vector extends MathArray {
  get x() {
    return this[0];
  }

  set x(value) {
    this[0] = checkNumber(value);
  }

  get y() {
    return this[1];
  }

  set y(value) {
    this[1] = checkNumber(value);
  }

  len() {
    return Math.sqrt(this.lengthSquared());
  }

  magnitude() {
    return this.len();
  }

  lengthSquared() {
    let length = 0;

    for (let i = 0; i < this.ELEMENTS; ++i) {
      length += this[i] * this[i];
    }

    return length;
  }

  magnitudeSquared() {
    return this.lengthSquared();
  }

  distance(mathArray) {
    return Math.sqrt(this.distanceSquared(mathArray));
  }

  distanceSquared(mathArray) {
    let length = 0;

    for (let i = 0; i < this.ELEMENTS; ++i) {
      const dist = this[i] - mathArray[i];
      length += dist * dist;
    }

    return checkNumber(length);
  }

  dot(mathArray) {
    let product = 0;

    for (let i = 0; i < this.ELEMENTS; ++i) {
      product += this[i] * mathArray[i];
    }

    return checkNumber(product);
  }

  normalize() {
    const length = this.magnitude();

    if (length !== 0) {
      for (let i = 0; i < this.ELEMENTS; ++i) {
        this[i] /= length;
      }
    }

    return this.check();
  }

  multiply(...vectors) {
    for (const vector of vectors) {
      for (let i = 0; i < this.ELEMENTS; ++i) {
        this[i] *= vector[i];
      }
    }

    return this.check();
  }

  divide(...vectors) {
    for (const vector of vectors) {
      for (let i = 0; i < this.ELEMENTS; ++i) {
        this[i] /= vector[i];
      }
    }

    return this.check();
  }

  lengthSq() {
    return this.lengthSquared();
  }

  distanceTo(vector) {
    return this.distance(vector);
  }

  distanceToSquared(vector) {
    return this.distanceSquared(vector);
  }

  getComponent(i) {
    assert(i >= 0 && i < this.ELEMENTS, 'index is out of range');
    return checkNumber(this[i]);
  }

  setComponent(i, value) {
    assert(i >= 0 && i < this.ELEMENTS, 'index is out of range');
    this[i] = value;
    return this.check();
  }

  addVectors(a, b) {
    return this.copy(a).add(b);
  }

  subVectors(a, b) {
    return this.copy(a).subtract(b);
  }

  multiplyVectors(a, b) {
    return this.copy(a).multiply(b);
  }

  addScaledVector(a, b) {
    return this.add(new this.constructor(a).multiplyScalar(b));
  }

}

/**
 * Common utilities
 * @module glMatrix
 */
var ARRAY_TYPE = typeof Float32Array !== 'undefined' ? Float32Array : Array;
if (!Math.hypot) Math.hypot = function () {
  var y = 0,
      i = arguments.length;

  while (i--) {
    y += arguments[i] * arguments[i];
  }

  return Math.sqrt(y);
};

/**
 * 2 Dimensional Vector
 * @module vec2
 */

/**
 * Creates a new, empty vec2
 *
 * @returns {vec2} a new 2D vector
 */

function create$1() {
  var out = new ARRAY_TYPE(2);

  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
  }

  return out;
}
/**
 * Transforms the vec2 with a mat2
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the vector to transform
 * @param {ReadonlyMat2} m matrix to transform with
 * @returns {vec2} out
 */

function transformMat2(out, a, m) {
  var x = a[0],
      y = a[1];
  out[0] = m[0] * x + m[2] * y;
  out[1] = m[1] * x + m[3] * y;
  return out;
}
/**
 * Transforms the vec2 with a mat2d
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the vector to transform
 * @param {ReadonlyMat2d} m matrix to transform with
 * @returns {vec2} out
 */

function transformMat2d(out, a, m) {
  var x = a[0],
      y = a[1];
  out[0] = m[0] * x + m[2] * y + m[4];
  out[1] = m[1] * x + m[3] * y + m[5];
  return out;
}
/**
 * Transforms the vec2 with a mat3
 * 3rd vector component is implicitly '1'
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the vector to transform
 * @param {ReadonlyMat3} m matrix to transform with
 * @returns {vec2} out
 */

function transformMat3$1(out, a, m) {
  var x = a[0],
      y = a[1];
  out[0] = m[0] * x + m[3] * y + m[6];
  out[1] = m[1] * x + m[4] * y + m[7];
  return out;
}
/**
 * Transforms the vec2 with a mat4
 * 3rd vector component is implicitly '0'
 * 4th vector component is implicitly '1'
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the vector to transform
 * @param {ReadonlyMat4} m matrix to transform with
 * @returns {vec2} out
 */

function transformMat4$1(out, a, m) {
  var x = a[0];
  var y = a[1];
  out[0] = m[0] * x + m[4] * y + m[12];
  out[1] = m[1] * x + m[5] * y + m[13];
  return out;
}
/**
 * Perform some operation over an array of vec2s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec2. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */

(function () {
  var vec = create$1();
  return function (a, stride, offset, count, fn, arg) {
    var i, l;

    if (!stride) {
      stride = 2;
    }

    if (!offset) {
      offset = 0;
    }

    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }

    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
    }

    return a;
  };
})();

function vec2_transformMat4AsVector(out, a, m) {
  const x = a[0];
  const y = a[1];
  const w = m[3] * x + m[7] * y || 1.0;
  out[0] = (m[0] * x + m[4] * y) / w;
  out[1] = (m[1] * x + m[5] * y) / w;
  return out;
}
function vec3_transformMat4AsVector(out, a, m) {
  const x = a[0];
  const y = a[1];
  const z = a[2];
  const w = m[3] * x + m[7] * y + m[11] * z || 1.0;
  out[0] = (m[0] * x + m[4] * y + m[8] * z) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z) / w;
  return out;
}
function vec3_transformMat2(out, a, m) {
  const x = a[0];
  const y = a[1];
  out[0] = m[0] * x + m[2] * y;
  out[1] = m[1] * x + m[3] * y;
  out[2] = a[2];
  return out;
}

class Vector2 extends Vector {
  constructor(x = 0, y = 0) {
    super(2);

    if (isArray(x) && arguments.length === 1) {
      this.copy(x);
    } else {
      if (config.debug) {
        checkNumber(x);
        checkNumber(y);
      }

      this[0] = x;
      this[1] = y;
    }
  }

  set(x, y) {
    this[0] = x;
    this[1] = y;
    return this.check();
  }

  copy(array) {
    this[0] = array[0];
    this[1] = array[1];
    return this.check();
  }

  fromObject(object) {
    if (config.debug) {
      checkNumber(object.x);
      checkNumber(object.y);
    }

    this[0] = object.x;
    this[1] = object.y;
    return this.check();
  }

  toObject(object) {
    object.x = this[0];
    object.y = this[1];
    return object;
  }

  get ELEMENTS() {
    return 2;
  }

  horizontalAngle() {
    return Math.atan2(this.y, this.x);
  }

  verticalAngle() {
    return Math.atan2(this.x, this.y);
  }

  transform(matrix4) {
    return this.transformAsPoint(matrix4);
  }

  transformAsPoint(matrix4) {
    transformMat4$1(this, this, matrix4);
    return this.check();
  }

  transformAsVector(matrix4) {
    vec2_transformMat4AsVector(this, this, matrix4);
    return this.check();
  }

  transformByMatrix3(matrix3) {
    transformMat3$1(this, this, matrix3);
    return this.check();
  }

  transformByMatrix2x3(matrix2x3) {
    transformMat2d(this, this, matrix2x3);
    return this.check();
  }

  transformByMatrix2(matrix2) {
    transformMat2(this, this, matrix2);
    return this.check();
  }

}

/**
 * 3 Dimensional Vector
 * @module vec3
 */

/**
 * Creates a new, empty vec3
 *
 * @returns {vec3} a new 3D vector
 */

function create() {
  var out = new ARRAY_TYPE(3);

  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }

  return out;
}
/**
 * Calculates the dot product of two vec3's
 *
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {Number} dot product of a and b
 */

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
/**
 * Computes the cross product of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */

function cross(out, a, b) {
  var ax = a[0],
      ay = a[1],
      az = a[2];
  var bx = b[0],
      by = b[1],
      bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}
/**
 * Transforms the vec3 with a mat4.
 * 4th vector component is implicitly '1'
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyMat4} m matrix to transform with
 * @returns {vec3} out
 */

function transformMat4(out, a, m) {
  var x = a[0],
      y = a[1],
      z = a[2];
  var w = m[3] * x + m[7] * y + m[11] * z + m[15];
  w = w || 1.0;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return out;
}
/**
 * Transforms the vec3 with a mat3.
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyMat3} m the 3x3 matrix to transform with
 * @returns {vec3} out
 */

function transformMat3(out, a, m) {
  var x = a[0],
      y = a[1],
      z = a[2];
  out[0] = x * m[0] + y * m[3] + z * m[6];
  out[1] = x * m[1] + y * m[4] + z * m[7];
  out[2] = x * m[2] + y * m[5] + z * m[8];
  return out;
}
/**
 * Transforms the vec3 with a quat
 * Can also be used for dual quaternions. (Multiply it with the real part)
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyQuat} q quaternion to transform with
 * @returns {vec3} out
 */

function transformQuat(out, a, q) {
  // benchmarks: https://jsperf.com/quaternion-transform-vec3-implementations-fixed
  var qx = q[0],
      qy = q[1],
      qz = q[2],
      qw = q[3];
  var x = a[0],
      y = a[1],
      z = a[2]; // var qvec = [qx, qy, qz];
  // var uv = vec3.cross([], qvec, a);

  var uvx = qy * z - qz * y,
      uvy = qz * x - qx * z,
      uvz = qx * y - qy * x; // var uuv = vec3.cross([], qvec, uv);

  var uuvx = qy * uvz - qz * uvy,
      uuvy = qz * uvx - qx * uvz,
      uuvz = qx * uvy - qy * uvx; // vec3.scale(uv, uv, 2 * w);

  var w2 = qw * 2;
  uvx *= w2;
  uvy *= w2;
  uvz *= w2; // vec3.scale(uuv, uuv, 2);

  uuvx *= 2;
  uuvy *= 2;
  uuvz *= 2; // return vec3.add(out, a, vec3.add(out, uv, uuv));

  out[0] = x + uvx + uuvx;
  out[1] = y + uvy + uuvy;
  out[2] = z + uvz + uuvz;
  return out;
}
/**
 * Rotate a 3D vector around the x-axis
 * @param {vec3} out The receiving vec3
 * @param {ReadonlyVec3} a The vec3 point to rotate
 * @param {ReadonlyVec3} b The origin of the rotation
 * @param {Number} rad The angle of rotation in radians
 * @returns {vec3} out
 */

function rotateX(out, a, b, rad) {
  var p = [],
      r = []; //Translate point to the origin

  p[0] = a[0] - b[0];
  p[1] = a[1] - b[1];
  p[2] = a[2] - b[2]; //perform rotation

  r[0] = p[0];
  r[1] = p[1] * Math.cos(rad) - p[2] * Math.sin(rad);
  r[2] = p[1] * Math.sin(rad) + p[2] * Math.cos(rad); //translate to correct position

  out[0] = r[0] + b[0];
  out[1] = r[1] + b[1];
  out[2] = r[2] + b[2];
  return out;
}
/**
 * Rotate a 3D vector around the y-axis
 * @param {vec3} out The receiving vec3
 * @param {ReadonlyVec3} a The vec3 point to rotate
 * @param {ReadonlyVec3} b The origin of the rotation
 * @param {Number} rad The angle of rotation in radians
 * @returns {vec3} out
 */

function rotateY(out, a, b, rad) {
  var p = [],
      r = []; //Translate point to the origin

  p[0] = a[0] - b[0];
  p[1] = a[1] - b[1];
  p[2] = a[2] - b[2]; //perform rotation

  r[0] = p[2] * Math.sin(rad) + p[0] * Math.cos(rad);
  r[1] = p[1];
  r[2] = p[2] * Math.cos(rad) - p[0] * Math.sin(rad); //translate to correct position

  out[0] = r[0] + b[0];
  out[1] = r[1] + b[1];
  out[2] = r[2] + b[2];
  return out;
}
/**
 * Rotate a 3D vector around the z-axis
 * @param {vec3} out The receiving vec3
 * @param {ReadonlyVec3} a The vec3 point to rotate
 * @param {ReadonlyVec3} b The origin of the rotation
 * @param {Number} rad The angle of rotation in radians
 * @returns {vec3} out
 */

function rotateZ(out, a, b, rad) {
  var p = [],
      r = []; //Translate point to the origin

  p[0] = a[0] - b[0];
  p[1] = a[1] - b[1];
  p[2] = a[2] - b[2]; //perform rotation

  r[0] = p[0] * Math.cos(rad) - p[1] * Math.sin(rad);
  r[1] = p[0] * Math.sin(rad) + p[1] * Math.cos(rad);
  r[2] = p[2]; //translate to correct position

  out[0] = r[0] + b[0];
  out[1] = r[1] + b[1];
  out[2] = r[2] + b[2];
  return out;
}
/**
 * Get the angle between two 3D vectors
 * @param {ReadonlyVec3} a The first operand
 * @param {ReadonlyVec3} b The second operand
 * @returns {Number} The angle in radians
 */

function angle(a, b) {
  var ax = a[0],
      ay = a[1],
      az = a[2],
      bx = b[0],
      by = b[1],
      bz = b[2],
      mag1 = Math.sqrt(ax * ax + ay * ay + az * az),
      mag2 = Math.sqrt(bx * bx + by * by + bz * bz),
      mag = mag1 * mag2,
      cosine = mag && dot(a, b) / mag;
  return Math.acos(Math.min(Math.max(cosine, -1), 1));
}
/**
 * Perform some operation over an array of vec3s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */

(function () {
  var vec = create();
  return function (a, stride, offset, count, fn, arg) {
    var i, l;

    if (!stride) {
      stride = 3;
    }

    if (!offset) {
      offset = 0;
    }

    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }

    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
    }

    return a;
  };
})();

const ORIGIN = [0, 0, 0];
let ZERO;
class Vector3 extends Vector {
  static get ZERO() {
    if (!ZERO) {
      ZERO = new Vector3(0, 0, 0);
      Object.freeze(ZERO);
    }

    return ZERO;
  }

  constructor(x = 0, y = 0, z = 0) {
    super(-0, -0, -0);

    if (arguments.length === 1 && isArray(x)) {
      this.copy(x);
    } else {
      if (config.debug) {
        checkNumber(x);
        checkNumber(y);
        checkNumber(z);
      }

      this[0] = x;
      this[1] = y;
      this[2] = z;
    }
  }

  set(x, y, z) {
    this[0] = x;
    this[1] = y;
    this[2] = z;
    return this.check();
  }

  copy(array) {
    this[0] = array[0];
    this[1] = array[1];
    this[2] = array[2];
    return this.check();
  }

  fromObject(object) {
    if (config.debug) {
      checkNumber(object.x);
      checkNumber(object.y);
      checkNumber(object.z);
    }

    this[0] = object.x;
    this[1] = object.y;
    this[2] = object.z;
    return this.check();
  }

  toObject(object) {
    object.x = this[0];
    object.y = this[1];
    object.z = this[2];
    return object;
  }

  get ELEMENTS() {
    return 3;
  }

  get z() {
    return this[2];
  }

  set z(value) {
    this[2] = checkNumber(value);
  }

  angle(vector) {
    return angle(this, vector);
  }

  cross(vector) {
    cross(this, this, vector);
    return this.check();
  }

  rotateX({
    radians,
    origin = ORIGIN
  }) {
    rotateX(this, this, origin, radians);
    return this.check();
  }

  rotateY({
    radians,
    origin = ORIGIN
  }) {
    rotateY(this, this, origin, radians);
    return this.check();
  }

  rotateZ({
    radians,
    origin = ORIGIN
  }) {
    rotateZ(this, this, origin, radians);
    return this.check();
  }

  transform(matrix4) {
    return this.transformAsPoint(matrix4);
  }

  transformAsPoint(matrix4) {
    transformMat4(this, this, matrix4);
    return this.check();
  }

  transformAsVector(matrix4) {
    vec3_transformMat4AsVector(this, this, matrix4);
    return this.check();
  }

  transformByMatrix3(matrix3) {
    transformMat3(this, this, matrix3);
    return this.check();
  }

  transformByMatrix2(matrix2) {
    vec3_transformMat2(this, this, matrix2);
    return this.check();
  }

  transformByQuaternion(quaternion) {
    transformQuat(this, this, quaternion);
    return this.check();
  }

}

class Mouse {
    pInst;
    defaultAccumulator = new Vector2();
    accumulator = new Vector2();
    position = new Vector2();
    previous = new Vector2();
    delta = new Vector2();
    dragCoefficent = 0.5;
    constructor(p5Instance, externalDragVec) {
        this.pInst = p5Instance;
        if (externalDragVec)
            this.accumulator = externalDragVec;
    }
    set dragPosition(v) { this.accumulator.copy(v); }
    get x() { return this.pInst.mouseX; }
    get y() { return this.pInst.mouseY; }
    get dragPositionY() { return this.accumulator.y; }
    get dragPositionX() { return this.accumulator.x; }
    get dragPosition() { return this.accumulator; }
    drag() {
        this.position.set(this.pInst.mouseX, this.pInst.mouseY);
        this.previous.set(this.pInst.pmouseX, this.pInst.pmouseY);
        this.delta.subVectors(this.position, this.previous);
        this.delta.multiplyByScalar(this.dragCoefficent);
        this.accumulator.add(this.delta);
    }
    reset() { this.accumulator.copy(this.defaultAccumulator); }
}

const typecheckSVGCanvasElement = (svgGraphics) => {
    let elt = svgGraphics.elt; //actually a SVGCanvasElement
    if (!elt || !elt.svg || elt.svg.localName != 'svg')
        throw new TypeError('What did you feed me??');
    return elt;
};
const removeBackgroundSVG = (pInst, c) => {
    const elt = typecheckSVGCanvasElement(c);
    const svg = elt.svg;
    const query = svg.querySelector(':scope > g > rect:first-child');
    if (!query) {
        console.log("No background rect found to remove!");
        return;
    }
    const bg = query;
    if (Number.parseInt(bg.getAttribute('width') || "") == c.width &&
        Number.parseInt(bg.getAttribute('height') || "") == c.height) {
        bg.remove();
        console.log("Background rect removed from SVG element...");
    }
};
const typecheckPathElement = (el) => {
    // if (el instanceof p5.Element) el = el.elt;
    if (!(el instanceof SVGPathElement && el.localName == 'path'))
        throw new TypeError('What did you feed me??');
    return el;
};
const getLinePathXY = (pathElt) => {
    pathElt = typecheckPathElement(pathElt);
    const pathData = pathElt.getAttribute('d');
    if (!pathData)
        return [];
    let commTokens = pathData.split(/(?=[mlhvcsqtaz])/i).map(s => s.trim()).filter(Boolean);
    const re = new RegExp(/(?<command>[A-Z]) *(?<x>[-+]?\d*\.?\d+(?:E[-+]?\d+)?)[ ,]+(?<y>[-+]?\d*\.?\d+(?:E[-+]?\d+)?)/i);
    let commands = [];
    commTokens.forEach(s => {
        let g = re.exec(s)?.groups;
        if (!g)
            return;
        else
            commands.push({
                command: g.command,
                x: parseFloat(g.x),
                y: parseFloat(g.y)
            });
    });
    //Throw if unsupported commands are found!
    let allCommandChars = commands.map(c => c.command);
    if (allCommandChars.some(c => "MLHV".indexOf(c) == -1)) {
        throw new Error(`I am not samrt enough to understand some of these codes: "${allCommandChars.join(',')}"`);
    }
    //Get some vectors for our trouble
    let points = commands.map(c => {
        switch (c.command) {
            case 'M':
                return [c.x, c.y];
            case 'L':
                return [c.x, c.y];
            case 'H':
                return [c.x, 0];
            case 'V':
                return [0, c.x];
            default:
                console.warn('I found something worrying:', c);
                return [0, 0];
        }
    });
    return points;
};
const setLinePathXY = (pathElt, vertices, closed = false) => {
    pathElt = typecheckPathElement(pathElt);
    let encodedTokens = vertices.map((v, i) => {
        return ` ${i == 0 ? 'M' : 'L'} ${v[0].toFixed(3)} ${v[1].toFixed(3)}`;
    });
    let dString = encodedTokens.join('');
    dString = closed ? dString + ' Z' : dString;
    pathElt.setAttribute('d', dString);
    return dString;
};
const cropPath = (pathElt, canvasBounds) => {
    pathElt = typecheckPathElement(pathElt);
    let linePoints = getLinePathXY(pathElt);
    // TODO make this amenable to multi-vertex paths!
    let linePointsCrop = cyrusBeck([linePoints[0], linePoints[1]], canvasBounds); //defaults to canvas size
    // if (linePointsCrop != null) {
    //     console.log(`old: (${linePoints[0].x}, ${linePoints[0].y}) (${linePoints[1].x}, ${linePoints[1].y})`);
    //     console.log(`new: (${linePointsCrop[0].x}, ${linePointsCrop[0].y}) (${linePointsCrop[1].x}, ${linePointsCrop[1].y})`);}
    if (linePointsCrop == null) { //if outside of the canvas or if cropped to a single point on the edge
        pathElt.remove();
        return -1;
    }
    else {
        setLinePathXY(pathElt, linePointsCrop);
        if (isEqual(linePoints[0], linePointsCrop[0]) &&
            isEqual(linePoints[1], linePointsCrop[1]))
            return 0;
        return 1;
    }
};
const cropAllPaths = (pInst, c) => {
    const elt = typecheckSVGCanvasElement(c);
    const svg = elt.svg;
    const canvasBounds = bboxVertices(0, 0, c.width, c.height);
    let paths = svg.querySelectorAll('path');
    let originalTotal = paths.length;
    let deleted = 0;
    let altered = 0;
    paths.forEach((path, i) => {
        let result = cropPath(path, canvasBounds);
        if (result == -1)
            deleted++;
        if (result == 1)
            altered++;
    });
    console.log(`Paths cropped to canvas: 
    ${originalTotal} to process... 
    ${deleted} discarded...
    ${altered} cropped...
    ${originalTotal - deleted} exported...`);
};
const processSVG = (pInst, c) => {
    removeBackgroundSVG(pInst, c);
    cropAllPaths(pInst, c);
};
// =================================================================
const drawCropLine = (canvas, x1, y1, x2, y2, bounds = bboxCorners(0, 0, canvas.width, canvas.height)) => {
    const cutline = liangBarsky([[x1, y1], [x2, y2]], bounds);
    if (cutline !== null) {
        canvas.line(cutline[0][0], cutline[0][1], cutline[1][0], cutline[1][1]);
        return true;
    }
    return false;
};

function removeProps(obj = {}, keys = []) {
    if (!Array.isArray(keys) && isString(keys))
        keys = [keys];
    if (!Array.isArray(keys))
        throw TypeError("I need an array of key strings here!");
    if (Array.isArray(obj)) {
        obj.forEach(function (item) {
            removeProps(item, keys);
        });
    }
    else if (isObjectLike(obj)) {
        Object.getOwnPropertyNames(obj).forEach(function (key) {
            if (keys.indexOf(key) !== -1)
                delete obj[key];
            else
                removeProps(obj[key], keys);
        });
    }
}
/**
 * For use in JSON.stringify to conserve complicated Vector objects
 * @param _k key of nested property, unused
 * @param v some nested property value from object
 * @returns
 */
function vectorReplacer(_k, v) {
    if (v.x === undefined)
        return v;
    return ['x', 'y', 'z', 'w'].reduce((pv, key) => ({
        ...pv,
        ...(v[key] !== undefined && { [key]: v[key] })
    }), {});
    // return {
    //   ...(v.x !== undefined && { x: v.x }),
    //   ...(v.y !== undefined && { y: v.y }),
    //   ...(v.z !== undefined && { z: v.z }),
    //   ...(v.w !== undefined && { w: v.w })
    // }
}

exports.DrawStages = void 0;
(function (DrawStages) {
    DrawStages[DrawStages["manager_predraw"] = 0] = "manager_predraw";
    DrawStages[DrawStages["predraw"] = 1] = "predraw";
    DrawStages[DrawStages["draw"] = 2] = "draw";
    DrawStages[DrawStages["postdraw"] = 3] = "postdraw";
    DrawStages[DrawStages["manager_postdraw"] = 4] = "manager_postdraw";
})(exports.DrawStages || (exports.DrawStages = {}));
class p5Manager {
    pInst;
    wallpaperMode;
    #graphics = {};
    canvas;
    P2DhiScale = 1.0;
    mouse;
    constructor(p5Instance, wallpaperMode = false, width = 100, height = 100, svgMode = false) {
        const p = this.pInst = p5Instance;
        this.wallpaperMode = wallpaperMode;
        let w = wallpaperMode ? window.innerWidth : width, h = wallpaperMode ? window.innerHeight : height;
        this.canvas = p.createCanvas(w, h, p.P2D);
        this.#graphics.P2D = p; // white lie
        const createP2DhiCanvas = (width = 100, height = 100, target = 4000) => {
            this.#graphics.P2Dhi?.remove();
            const scale = Math.ceil(target / Math.max(width, height)); //target 4K resolution
            this.P2DhiScale = scale;
            this.#graphics.P2Dhi = p.createGraphics(width * scale, height * scale, p.P2D);
        };
        createP2DhiCanvas(w, h);
        const createSVGCanvas = (width = 100, height = 100) => {
            this.#graphics.SVG?.remove();
            this.#graphics.SVG = p.createGraphics(width, height, p.SVG);
        };
        if (svgMode)
            createSVGCanvas(w, h);
        // Fullpage ////////////////////////////////////////////////////////
        if (this.wallpaperMode) {
            this.canvas.attribute("wallpaper", "true");
            p.windowResized = ev => {
                this.pInst.resizeCanvas(window.innerWidth, window.innerHeight);
                if (this.#graphics.P2Dhi) {
                    createP2DhiCanvas(window.innerWidth, window.innerHeight);
                }
                if (this.#graphics.SVG) {
                    createSVGCanvas(window.innerWidth, window.innerHeight);
                }
            };
        }
        // Convenience /////////////////////////////////////////////////////
        this.mouse = new Mouse(p);
        this.initializeGUI();
        // Image Capture
        this.onDraw(() => this.#recordImage(), exports.DrawStages.manager_postdraw);
        this.onDraw(() => this.#recordSVG(), exports.DrawStages.manager_postdraw);
        // Settings IO
        this.canvas.drop(this.receiveGUIPresetFromFile.bind(this));
        // Commandeer the automatic p5 draw loop
        this.pInst.draw = this.drawAll;
        return this;
    }
    get canvases() { return { ...this.#graphics }; }
    applyToCanvases(callback) {
        for (const [canvasName, canvas] of Object.entries(this.canvases)) {
            callback(canvas, canvasName);
        }
    }
    debugViewCanvases() {
        // this.canvas.hide()
        this.#graphics.SVG?.show();
        this.#graphics.P2Dhi?.show();
    }
    //====================================================
    #allStages = Object.values(exports.DrawStages).filter(v => typeof v === "number");
    #userStages = [exports.DrawStages.predraw, exports.DrawStages.draw, exports.DrawStages.postdraw];
    #userDrawCalls = new Map(this.#allStages.map(stage => [
        stage,
        []
    ]));
    registerDrawCall(func, stage = exports.DrawStages.draw, top = false) {
        if (!isFunction(func))
            throw 'User-defined draw() is not a function!';
        const stageCalls = this.#userDrawCalls.get(stage);
        if (!stageCalls)
            throw `No initialized function array for stage ${stage}!`;
        if (top)
            stageCalls.unshift(func);
        else
            stageCalls.push(func);
    }
    drawThis = this.registerDrawCall;
    onDraw = this.registerDrawCall;
    onLoop = this.registerDrawCall;
    animate = this.registerDrawCall;
    clearDrawCalls(stage = exports.DrawStages.draw) {
        const stageCalls = this.#userDrawCalls.get(stage);
        if (stageCalls)
            stageCalls.length = 0;
    }
    getDrawCallMap = () => this.#userDrawCalls;
    getDrawCalls = (stages = this.#allStages) => stages.flatMap(stage => this.#userDrawCalls.get(stage));
    //====================================================
    runDrawStages = (stages = this.#allStages, graphics = this.#graphics.P2D) => {
        for (const stage of stages) {
            const drawCalls = this.#userDrawCalls.get(stage);
            if (stage === exports.DrawStages.draw && !drawCalls?.length)
                console.warn("No user-defined draw() functions registered!");
            if (drawCalls)
                for (const drawCall of drawCalls) {
                    drawCall(graphics);
                }
        }
    };
    drawAll = this.runDrawStages;
    runPreDraw() {
        this.runDrawStages([exports.DrawStages.manager_predraw]);
    }
    runUserDraw(graphics = this.#graphics.P2D) {
        this.runDrawStages([exports.DrawStages.predraw, exports.DrawStages.draw, exports.DrawStages.postdraw], graphics);
    }
    runPostDraw() {
        this.runDrawStages([exports.DrawStages.manager_postdraw]);
    }
    //=====================================================
    #frameRateHistoryLength = 5;
    #frameRates = new RecentAverage(this.#frameRateHistoryLength * 60, 60);
    #writeFPStoTitle() {
        let frameRate = this.pInst.frameRate();
        let avg = this.#frameRates.tick(frameRate, frameRate * this.#frameRateHistoryLength);
        document.title = `${Math.round(frameRate)}/${Math.round(avg)} fps, Frame ${this.pInst.frameCount}`;
    }
    writeFPStoTitleOnDraw() {
        this.onDraw(() => this.#writeFPStoTitle(), exports.DrawStages.manager_predraw);
    }
    //=====================================================
    #svgRequested = false;
    requestSVG = () => { this.#svgRequested = true; };
    #recordSVG = () => {
        if (!this.#svgRequested)
            return;
        this.#svgRequested = false;
        try {
            if (!this.#graphics.SVG)
                throw "Can't record an SVG!";
            if (!this.getDrawCalls(this.#userStages).length)
                throw "Can't record an SVG! No user-defined draw() functions registered;";
            const ts = getTimeStamp();
            const svgc = this.#graphics.SVG;
            svgc.clear(0, 0, 0, 0);
            svgc.push();
            this.runUserDraw(svgc);
            processSVG(this.pInst, svgc);
            svgc.save(ts);
            svgc.pop();
        }
        catch (err) {
            console.error(err);
        }
    };
    #imageRequested = false;
    requestImage = () => { this.#imageRequested = true; };
    #recordImage = () => {
        if (!this.#imageRequested)
            return;
        this.#imageRequested = false;
        try {
            if (!this.getDrawCalls(this.#userStages).length)
                throw "No user-defined draw() functions registered;";
            const ts = getTimeStamp();
            if (this.#graphics.P2D) {
                const p2dc = this.#graphics.P2D;
                p2dc.clear(0, 0, 0, 0);
                p2dc.push();
                this.runUserDraw(p2dc);
                p2dc.save(ts);
                p2dc.pop();
            }
            if (this.#graphics.P2Dhi) {
                const p2dhic = this.#graphics.P2Dhi;
                p2dhic.clear(0, 0, 0, 0);
                p2dhic.push();
                p2dhic.scale(this.P2DhiScale);
                this.runUserDraw(p2dhic);
                p2dhic.save(ts + '_hi');
                p2dhic.pop();
            }
        }
        catch (err) {
            console.error(err);
        }
    };
    //=====================================================
    gui;
    guiCheck = () => { if (!this.gui)
        throw "GUI is not initialized!"; };
    initializeGUI() {
        if (this.gui)
            return;
        const pane = new tweakpaneExports.Pane({ title: "Parameters" });
        pane.registerPlugin(EssentialsPlugin);
        // FPS Graph
        let fpsgraph = pane.addBlade({
            view: "fpsgraph",
            label: "FPS",
            lineCount: 3
        });
        this.onDraw(() => fpsgraph.begin(), exports.DrawStages.manager_predraw);
        this.onDraw(() => fpsgraph.end(), exports.DrawStages.manager_postdraw);
        // Preset Save
        const presetButtons = new Map([
            ["Import", this.openFileDialogForGUIPreset.bind(this)],
            ["Export", this.saveGUIPresetToFile.bind(this)],
        ]);
        pane.addBlade({
            view: "buttongrid",
            size: [2, 1],
            cells: (x, y) => ({
                title: Array.from(presetButtons.keys())[x + y * 2]
            }),
            label: "Preset"
        }).on("click", ev => {
            const func = presetButtons.get(ev.cell.title);
            if (func)
                func();
        });
        // Image Save
        const saveButtons = new Map([
            ["PNG", this.requestImage],
            ["SVG", this.requestSVG],
            ["ALL", () => { this.requestImage(); this.requestSVG(); }],
            // ["Preset", null] // TODO
        ]);
        pane.addBlade({
            view: "buttongrid",
            size: [3, 1],
            cells: (x, y) => ({
                title: Array.from(saveButtons.keys())[x + y * 3]
            }),
            label: "Save"
        }).on("click", ev => {
            const func = saveButtons.get(ev.cell.title);
            if (func)
                func();
        });
        // Keep GUI updated with bound values
        this.onDraw(() => pane.refresh(), exports.DrawStages.manager_postdraw);
        // Begin auto-saving to local storage
        this.registerAutoSaveInterval();
        this.gui = pane;
    }
    registerGUIAdditions(callback) {
        if (!this.gui)
            this.initializeGUI();
        if (this.gui)
            callback(this.gui);
    }
    //=====================================================
    #localStoragePresetKey = "p5ManagerPresetData";
    #localStorageSaveTimeKey = "p5ManagerPresetTime";
    saveGUIPresetToLocalStorage() {
        try {
            this.guiCheck();
            const preset = JSON.stringify(this.gui?.exportPreset(), vectorReplacer);
            this.pInst.storeItem(this.#localStoragePresetKey, preset);
            this.pInst.storeItem(this.#localStorageSaveTimeKey, Date.now());
        }
        catch (error) {
            return console.error(error);
        }
    }
    #autoSaveTimer;
    registerAutoSaveInterval(ms = 5000) {
        if (this.#autoSaveTimer != null) {
            clearInterval(this.#autoSaveTimer);
            this.#autoSaveTimer = null;
        }
        this.#autoSaveTimer = setInterval(this.saveGUIPresetToLocalStorage.bind(this), ms);
    }
    // TODO unregister function, if necessary
    getGUIPresetFromLocalStorage() {
        try {
            this.guiCheck();
            const presetString = this.pInst.getItem(this.#localStoragePresetKey);
            if (!presetString || !isString(presetString))
                throw "No stored preset available...";
            const preset = JSON.parse(presetString);
            this.gui?.importPreset(preset); //load
            const presetSaveTime = this.pInst.getItem(this.#localStorageSaveTimeKey);
            if (!presetSaveTime || !isNumber(presetSaveTime))
                throw "Stored preset save time is invalid!";
            const savetime = new Date(presetSaveTime).toString();
            console.log(`Loaded GUI preset from local storage @ ${savetime}`);
        }
        catch (error) {
            return console.error(error);
        }
    }
    #presetExtension = 'preset.json';
    saveGUIPresetToFile(timestamp = getTimeStamp()) {
        try {
            this.guiCheck();
            const preset = this.gui?.exportPreset();
            console.debug("Preset to prepare:", preset);
            const string = JSON.stringify(preset, vectorReplacer);
            console.debug("Preset output:", string);
            this.pInst.saveStrings(string.split('\n'), timestamp, this.#presetExtension);
        }
        catch (error) {
            return console.error(error);
        }
    }
    receiveGUIPresetFromFile(file) {
        try {
            this.guiCheck();
            if (!file)
                throw ("No file received...");
            if (!file.size)
                throw ("File received is empty...");
            if (file.subtype !== "json" ||
                !file.name?.toLowerCase().endsWith(this.#presetExtension))
                throw ("Not a preset file...");
            console.debug("Received preset file data:", file.data);
            this.gui?.importPreset(file.data);
            console.log(`Loaded GUI preset from ${file.name}`);
        }
        catch (error) {
            return console.error(error);
        }
    }
    openFileDialogForGUIPreset() {
        const input = this.pInst.createFileInput((file) => {
            console.log(...arguments);
            this.receiveGUIPresetFromFile(file);
            input.remove();
        }, false);
        input.hide();
        setTimeout(() => {
            input.elt.click();
        }, 250);
    }
    loadGUIPreset(preset) {
        this.guiCheck();
        this.gui?.importPreset(preset);
    }
}

class p5NoiseField {
    pInst;
    seed = 0;
    amplitude = 1;
    scale = 1; //0.2
    lod = 4;
    falloff = 0.5;
    speed = new Vector3();
    position = new Vector3();
    delta = new Vector3();
    mono = false;
    constructor(p5Instance, options = {}) {
        this.pInst = p5Instance;
        this.amplitude = options.amplitude ?? 1;
        this.scale = options.scale ?? 1;
        this.setDetail(options.lod ?? 4);
        this.setFalloff(options.falloff ?? 0.5);
        this.setSeed(options.seed ?? p5NoiseField.randomSeed());
        if (options.speed)
            this.setSpeed(options.speed);
        this.mono = options.mono ?? false;
    }
    static randomSeed = () => Math.round(Math.random() * 10000000);
    setSeed(seed) {
        this.seed = seed;
        this.pInst.noiseSeed(seed);
    }
    setDetail(lod) {
        this.lod = lod;
        this.pInst.noiseDetail(lod, this.falloff);
    }
    setFalloff(falloff) {
        this.falloff = falloff;
        this.pInst.noiseDetail(this.lod, falloff);
    }
    setSpeed(v) {
        this.speed.copy(v);
    }
    tick(delta = (this.pInst.deltaTime / 1000)) {
        this.position.addScaledVector(this.speed, this.scale * delta);
        return this.position;
    }
    get([x, y], centered = false) {
        const scale = (1 / this.scale) - 0.9; //TODO needs refinement
        const offset = centered ? -0.5 : 0;
        return (this.pInst.noise((x + this.position.x) * scale, (y + this.position.y) * scale, (this.position.z || 0) * scale) + offset) * this.amplitude;
    }
    getVec2([x, y], centered = false, mono = this.mono) {
        let nx = this.get([x, y], centered);
        return [
            nx,
            mono ? nx : this.get([x + 1000, y + 1000], centered)
        ];
    }
}

exports.Clock = Clock;
exports.Easing = Easing;
exports.ExpiringData = ExpiringData;
exports.Mouse = Mouse;
exports.Queue = Queue;
exports.RecentAverage = RecentAverage;
exports.UIZoom = UIZoom;
exports.averageArray = averageArray;
exports.bboxCorners = bboxCorners;
exports.bboxVertices = bboxVertices;
exports.calcFillScale = calcFillScale;
exports.calcScale = calcScale;
exports.ceilStep = ceilStep;
exports.clearTimers = clearTimers;
exports.coin = coin;
exports.coinInt = coinInt;
exports.constrain = constrain;
exports.cropAllPaths = cropAllPaths;
exports.cropPath = cropPath;
exports.cyrusBeck = cyrusBeck;
exports.degrees = degrees;
exports.dist = dist;
exports.drawCropLine = drawCropLine;
exports.error = error;
exports.flipAdd = flipAdd;
exports.floorStep = floorStep;
exports.generateRandomIndex = generateRandomIndex;
exports.getLinePathXY = getLinePathXY;
exports.getTimeStamp = getTimeStamp;
exports.lerp = lerp;
exports.liangBarsky = liangBarsky;
exports.map = map;
exports.millis = millis;
exports.mod = mod;
exports.newTimer = newTimer;
exports.newl = newl;
exports.newline = newline;
exports.norm = norm;
exports.normalize = normalize;
exports.p5FrameData = p5FrameData;
exports.p5Manager = p5Manager;
exports.p5NoiseField = p5NoiseField;
exports.print = print;
exports.processSVG = processSVG;
exports.radians = radians;
exports.random = random;
exports.randomInt = randomInt;
exports.randomWeighted = randomWeighted;
exports.removeBackgroundSVG = removeBackgroundSVG;
exports.removeProps = removeProps;
exports.roundStep = roundStep;
exports.setLinePathXY = setLinePathXY;
exports.setRandomFunction = setRandomFunction;
exports.setVerbose = setVerbose;
exports.shuffleArray = shuffleArray;
exports.toDegrees = toDegrees;
exports.toRadians = toRadians;
exports.tokenize = tokenize;
exports.vectorReplacer = vectorReplacer;
exports.warn = warn;
//# sourceMappingURL=cem.js.map
