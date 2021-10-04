// CEM LIBRARY //////////////////////////////////////////////////////////

/*
  Instructions:
  Declare CEM object at top of code.
  Include key:value pairs for settings.
  Include this injector library before anything.

  Available settings in init declaration:
  boolean verbose || true
    enables debug printing to console
*/

var CEM = CEM || {};

(function () {

  var lib = this;


  // P5.js Supplemental //////////////////////////////////////////////////

  lib.calcScale = (c, i, mode) => {

    //Calculate scale value to fill canvas
    var aspectC = c.width / c.height;
    var aspectI = i.width / i.height;

    switch (mode) {
      case "FILL":
      case "fill":
        if (aspectC >= aspectI) return c.width / i.width;
        else return c.height / i.height;
        break;
      case "FIT":
      case "fit":
        if (aspectC <= aspectI) return c.width / i.width;
        else return c.height / i.height;
        break;
      default:
        lib.error("CEM.calcScale(): argument 3 should be 'fill' or 'fit'\nNo scaling calculated.");
        return 1;
    }
  };

  lib.calcFillScale = (c, i) => {
    lib.warn("CEM.calcFillScale() deprecated. Use calcScale().");
    lib.calcScale(c, i, "fill");
  };



  // three.js Supplemental ///////////////////////////////////////////////

  lib.clearScene = (sceneForClearing) => {
    for (var i = sceneForClearing.children.length - 1; i >= 0; i--) {
      sceneForClearing.remove(sceneForClearing.children[i]);
    }
  };



  // UI Zoom Feature /////////////////////////////////////////////////////

  lib.UIZoom = function (minimumZoom = 1, maximumZoom = 15, startingZoom = 1, interaction = true) {

    this.minZoom = minimumZoom;
    this.maxZoom = maximumZoom;
    this.zoom = this.startingZoom = lib.constrain(startingZoom, minimumZoom, maximumZoom);

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
  };

  lib.UIZoom.prototype = {

    constructor: lib.UIZoom,

    setInteraction: function (on) {
      this.interaction = on;
    },

    onMouseMove: function (e) {
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
        this.translateX = lib.constrain(this.translateX, -(this.zoom - 1) * window.innerWidth, 0);
        this.translateY = lib.constrain(this.translateY, -(this.zoom - 1) * window.innerHeight, 0);
      }
    },

    onMouseWheel: function (e) {
      if (!this.interaction) return;

      let sourceX = this.mouseX;
      let sourceY = this.mouseY;
      this.translateX -= sourceX;
      this.translateY -= sourceY;
      var rate = 1.07;
      var delta = (e.deltaY / 100) < 0 ? rate : (e.deltaY / 100) > 0 ? 1.0 / rate : 1.0;
      var scaleNew = this.zoom * delta;
      scaleNew = lib.constrain(scaleNew, this.minZoom, this.maxZoom); //Constraints
      this.translateX *= scaleNew / this.zoom;
      this.translateY *= scaleNew / this.zoom;
      this.zoom = scaleNew;
      this.translateX += sourceX;
      this.translateY += sourceY;

      //Constraints
      this.translateX = lib.constrain(this.translateX, -(this.zoom - 1) * window.innerWidth, 0);
      this.translateY = lib.constrain(this.translateY, -(this.zoom - 1) * window.innerHeight, 0);

    },

    onWindowResize: function () {
      var oldW = this.windowX;
      var oldH = this.windowY;
      this.windowX = window.innerWidth;
      this.windowY = window.innerHeight;
      this.translateX = lib.map(this.translateX, 0, oldW, 0, this.windowX);
      this.translateY = lib.map(this.translateY, 0, oldH, 0, this.windowY);
    },

    reset: function () {
      this.zoom = this.startingZoom;
      this.translateX = (-0.5 * window.innerWidth * this.zoom) + 0.5 * window.innerWidth;
      this.translateY = (-0.5 * window.innerHeight * this.zoom) + 0.5 * window.innerHeight;
    },

    get: function () {
      return {
        x: this.translateX,
        y: this.translateY,
        s: this.zoom
      };
    },

    getPercent: function () {

      let mapLin = function (i, logStart, logEnd, linStart, linEnd) {
        let b = Math.log(logEnd / logStart) / (linEnd - linStart);
        let a = logStart * Math.exp(-b * linStart);
        return Math.log(i / a) / b;
      };

      return {
        x: lib.normalize(this.translateX, 0, -(this.zoom - 1) * window.innerWidth) || 0.5,
        y: lib.normalize(this.translateY, 0, -(this.zoom - 1) * window.innerHeight) || 0.5,
        s: mapLin(this.zoom, this.minZoom, this.maxZoom, 0, 1)
      };
    },


    setPercent: function (sxs, _yx, __y) {
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
        this.translateX = lib.constrain(this.translateX, -(this.zoom - 1) * window.innerWidth, 0);
        this.translateY = lib.constrain(this.translateY, -(this.zoom - 1) * window.innerHeight, 0);
      }

      if (doMove) {
        this.translateX = lib.lerp(0, -(this.zoom - 1) * window.innerWidth, x);
        this.translateY = lib.lerp(0, -(this.zoom - 1) * window.innerHeight, y);
      }

    },

  };



  // Time functions //////////////////////////////////////////////////////

  lib.millis = () => {
    return window.performance.now();
  };

  lib.Clock = function (autoStart = true) {
    this.autoStart = autoStart;
    this.startTime = 0;
    this.oldTime = 0;
    this.elapsedTime = 0;

    this.running = false;
  };

  lib.Clock.prototype = {

    constructor: lib.Clock,

    start: function () {
      this.startTime = (performance || Date).now();
      this.oldTime = this.startTime;
      this.elapsedTime = 0;
      this.running = true;
    },

    stop: function () {
      this.getElapsedTime();
      this.running = false;
    },

    getElapsedTime: function () {
      this.getDelta();
      return this.elapsedTime;
    },

    getDelta: function () {
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

  };


  // Trackable Timers //////////////////////////////////////////////////////////

  lib.timeoutArray = [];

  lib.clearTimers = () => {
    if (typeof lib.timeoutArray !== 'undefined') {
      if (lib.timeoutArray.length > 0) {
        for (let i = 0; i < lib.timeoutArray.length; i++) {
          clearTimeout(lib.timeoutArray[i]);
        }
        lib.timeoutArray = [];
      }
    } else {
      lib.timeoutArray = [];
    }
  };

  lib.newTimer = (function_, delay_) => {
    let t = setTimeout(function_, delay_);
    lib.timeoutArray.push(t);
    return t;
  };


  // Math Functions //////////////////////////////////////////////////////

  lib.random = (min, max) => {
    let rand = Math.random();
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

  lib.coin = (odds = 0.5) => {
    if (lib.random(1) < odds) return true;
    else return false;
  };

  lib.coinInt = (odds = 0.5) => {
    return +lib.coin(odds);
  };

  lib.flipAdd = (a, b, odds = 0.5) => {
    if (lib.coin(odds)) return a + b;
    else return a - b;
  };



  // Durstenfeld shuffle
  // Array is passed by reference, this edits the original.
  lib.shuffleArray = (array) => {
    for (var i = array.length - 1; i > 0; i--) {
      var j = Math.floor(lib.random() * (i + 1));
      var temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
  };

  // Randomized Index Generator
  lib.generateRandomIndex = (length) => {
    var array = [];
    for (var i = 0; i < length; i++) array[i] = i;
    lib.shuffleArray(array);
    return array;
  };



  // P5 Math https://github.com/trembl/p5.Math.js //

  // Converts from degrees to radians.
  lib.radians = lib.toRadians = (degrees) => {
    return degrees * (Math.PI / 180.0);
  };

  // Converts from radians to degrees.
  lib.degrees = lib.toDegrees = (radians) => {
    return radians * (180.0 / Math.PI);
  };

  lib.constrain = (amt, low, high) => {
    return (amt < low) ? low : ((amt > high) ? high : amt);
  };

  lib.dist = (x1, y1, x2, y2) => {
    return Math.sqrt(p5.sq(x2 - x1) + p5.sq(y2 - y1));
  };

  lib.lerp = (start, stop, amt) => {
    return start + (stop - start) * amt;
  };

  lib.norm = lib.normalize = (value, start, stop) => {
    return (value - start) / (stop - start);
  };

  lib.map = (value, istart, istop, ostart, ostop) => {
    return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
  };


  // Easing Functions (from jQuery Easing v1.3 - http://gsgd.co.uk/sandbox/jquery/easing/)

  lib.easing = {
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
  }



  // Print functions /////////////////////////////////////////////////////

  lib.verbose = true;

  lib.print = (str) => {
    if (lib.verbose) console.log(str);
  };

  lib.warn = (str) => {
    if (lib.verbose) console.warn(str);
  };

  lib.error = (str) => {
    console.error(str);
  };

  lib.newl = lib.newline = () => {
    lib.print("");
  };

  lib.tokenize = (str) => {
    return str.split(/\s+/);
  };



}).apply(CEM);
