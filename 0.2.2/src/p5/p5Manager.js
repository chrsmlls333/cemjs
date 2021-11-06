
import { getTimeStamp } from '../helpers/Clock.js';
import { FrameData } from '../helpers/FrameData.js';
import { Queue } from '../helpers/Queue.js';
import { processSVG } from './p5SVG.js';


export class p5Manager { 
  #graphics = {};

  constructor(width, height) {
    this.canvas = createCanvas(width, height, P2D);
    this.#graphics.P2D = this.canvas._pInst;
    this.#graphics.SVG = createGraphics(width, height, SVG);

    

    //debug
    // this.canvas.hide()
    // this.#graphics.SVG.show();
    // this.#graphics.P2Dhi.show();

    return this;
  }
  
  get canvases() { return { ...this.#graphics } }
  applyToCanvases( callback ) {
    for (const [canvasName, canvas] of Object.entries(this.canvases)) {
      callback(canvas, canvasName);
    }
  }

  //====================================================

  registerDraw( func ) {
    const isFunction = f => (f && {}.toString.call(f) === '[object Function]');
    if (!isFunction(func)) throw 'User-defined draw() is not a function!';
    this.userDraw = func;
  }

  //====================================================

  
  preDraw() {
    let avg = this.#frameCounterTick();
    document.title = `${int(frameRate())}/${int(avg)} fps, Frame ${frameCount}`;
  }

  runUserDraw() {
    if (!this.userDraw) throw "Can't record an SVG! No user-defined draw() function registered;";
    this.userDraw(this.#graphics.P2D);
  }

  postDraw() {
    this.#recordSVG();
    this.#recordImage();
  }


  //=====================================================

  #frames = new Queue(300, 60);
  #frameCounterTick = () => {
    this.#frames.tick(frameRate());
    return this.#frames.average(frameRate()*5);
  }

  //=====================================================

  #svgRequested = false;
  requestSVG = () => { this.#svgRequested = true; }
  #recordSVG = () => {
    if (!this.#svgRequested) return;
    this.#svgRequested = false;

    if (!this.#graphics.SVG) throw "Can't record an SVG!";
    if (!this.userDraw) throw "Can't record an SVG! No user-defined draw() function registered;";

    const svgc = this.#graphics.SVG;
    svgc.clear();
    this.userDraw(svgc)
    processSVG(svgc.elt);
    svgc.save(this.getFileTimeStamp());

    this.saveUserData();
  }

  #imageRequested = false;
  requestImage = () => { this.#imageRequested = true; }
  #recordImage = () => {
    if (!this.#imageRequested) return;
    this.#imageRequested = false;

    if (!this.#graphics.P2D) throw "Can't save an image!";

    const p2dc = this.#graphics.P2D;
    p2dc.save(this.getFileTimeStamp());

    this.saveUserData();
  }


  #frameTS = new FrameData(getTimeStamp);
  getFileTimeStamp() { return this.#frameTS.get() }


  //=====================================================


  #frameUserConfig = new FrameData();
  #frameUserConfigSaved = new FrameData(() => false);
  registerUserData( callback ) { this.#frameUserConfig.registerFrameData(callback); }
  setUserData(data) { this.#frameUserConfig.set(data); }
  getUserData() { return this.#frameUserConfig.get(); }
  saveUserData() {
    if (this.#frameUserConfigSaved.get() === true) return;
    const userData = this.getUserData();
    if ( !userData || !Object.keys(userData).length ) {
      console.warn("p5Manager.saveUserData: No data to write!");
      return;
    }

    let json = JSON.stringify(userData, function(key, value) {
      if (value instanceof p5.Vector) {
        const { x, y, z } = value;
        return { x, y, z };
      }
      return value
    }, 2);
    saveStrings(json.split('\n'), `${this.getFileTimeStamp()}.config.json`, 'json');

    this.#frameUserConfigSaved.set(true);
  }

}

