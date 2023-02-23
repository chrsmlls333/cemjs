
import { getTimeStamp } from '../helpers/Clock';
import { FrameData } from '../helpers/FrameData';
import { Queue } from '../helpers/Queue';
import { Mouse } from './p5Mouse';
import { processSVG } from './p5SVG';

export class p5Manager { 
  pInst: p5;
  #graphics: { [key: string]: p5.Graphics } = {};
  canvas: p5.Renderer;
  P2DhiScale: number;

  mouse: Mouse;

  userDraw?: (canvas: p5.Graphics)=>void;

  constructor(p: p5, width = 100, height = 100) {
    this.pInst = p;
    this.canvas = p.createCanvas(width, height, p.P2D);

    this.#graphics.P2D = <p5.Graphics>p; // white lie
    
    this.#graphics.SVG = p.createGraphics(width, height, (p as any).SVG);

    const s = Math.ceil(4000 / Math.max(width, height)); //target 4K resolution
    this.P2DhiScale = s;
    this.#graphics.P2Dhi = p.createGraphics(width*s, height*s, p.P2D);

    //debug
    // this.canvas.hide()
    // this.#graphics.SVG.show();
    // this.#graphics.P2Dhi.show();

    // Convenience
    this.mouse = new Mouse( p );

    return this;
  }
  
  get canvases() { return { ...this.#graphics } }
  applyToCanvases( callback: (canvas: p5 | p5.Graphics, name: string)=>void ) {
    for (const [canvasName, canvas] of Object.entries(this.canvases)) {
      callback(canvas, canvasName);
    }
  }

  //====================================================

  registerDraw( func: (canvas: p5.Graphics)=>void ) {
    const isFunction = (f:any) => (f && {}.toString.call(f) === '[object Function]');
    if (!isFunction(func)) throw 'User-defined draw() is not a function!';
    this.userDraw = func;
  }

  //====================================================

  
  preDraw() {
    let avg = this.#frameCounterTick();
    document.title = `${Math.round(this.pInst.frameRate())}/${Math.round(avg)} fps, Frame ${this.pInst.frameCount}`;
  }

  runUserDraw() {
    if (!this.userDraw) throw "No user-defined draw() function registered;";
    this.userDraw(this.#graphics.P2D);
  }

  postDraw() {
    this.#recordSVG();
    this.#recordImage();
  }


  //=====================================================

  #frames = new Queue(300, 60);
  #frameCounterTick = () => {
    this.#frames.tick(this.pInst.frameRate());
    const secondsHistory = 5;
    return this.#frames.average(this.pInst.frameRate()*secondsHistory);
  }

  //=====================================================

  #svgRequested = false;
  requestSVG = () => { this.#svgRequested = true; }
  #recordSVG = () => {
    if (!this.#svgRequested) return;
    this.#svgRequested = false;

    if (!this.#graphics.SVG) throw "Can't record an SVG!";
    if (!this.userDraw) throw "Can't record an SVG! No user-defined draw() function registered;";

    const svgc = (this.#graphics.SVG as p5.Graphics);
    svgc.clear(0,0,0,0);
    svgc.push();
    this.userDraw(svgc);
    processSVG(this.pInst, svgc);
    svgc.save(this.getFileTimeStamp());
    svgc.pop();

    this.saveUserData();
  }

  #imageRequested = false;
  requestImage = () => { this.#imageRequested = true; }
  #recordImage = () => {
    if (!this.#imageRequested) return;
    this.#imageRequested = false;

    if (!this.userDraw) throw "No user-defined draw() function registered;";

    if (this.#graphics.P2D) {
      const p2dc = this.#graphics.P2D;
      p2dc.clear(0,0,0,0);
      p2dc.push();
      this.userDraw(p2dc);
      p2dc.save(this.getFileTimeStamp());
      p2dc.pop();
    }

    if (this.#graphics.P2Dhi) {
      const p2dhic = this.#graphics.P2Dhi;
      p2dhic.clear(0,0,0,0);
      p2dhic.push();
      p2dhic.scale(this.P2DhiScale);
      this.userDraw(p2dhic);
      p2dhic.save(this.getFileTimeStamp()+'_hi');
      p2dhic.pop();
    }

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
    this.pInst.saveStrings(json.split('\n'), `${this.getFileTimeStamp()}.config.json`, 'json');

    this.#frameUserConfigSaved.set(true);
  }

}

