import { constrain, map, normalize, lerp } from "../math/index.js";

// UI Zoom Feature /////////////////////////////////////////////////////

export class UIZoom {
  
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