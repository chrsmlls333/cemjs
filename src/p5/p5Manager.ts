
import { isNumber, isFunction, isString } from 'lodash-es';

import { Pane } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import { ButtonGridApi, FpsGraphBladeApi } from '@tweakpane/plugin-essentials';

import { getTimeStamp } from '../helpers/Clock';
import { RecentAverage } from '../helpers/Queue';
import { Mouse } from './p5Mouse';
import { processSVG } from './p5SVG';
import { vectorReplacer } from '../utils';

export enum DrawStages {
  manager_predraw,
  predraw,
  draw,
  postdraw,
  manager_postdraw
}

export interface DrawCall {
  (canvas: p5.Graphics): void
}

export class p5Manager { 
  pInst: p5;
  #graphics: { [key: string]: p5.Graphics } = {};
  canvas: p5.Renderer;
  P2DhiScale: number;

  mouse: Mouse;

  constructor( p5Instance: p5, width = 100, height = 100 ) {
    const p = this.pInst = p5Instance;
    this.canvas = p.createCanvas(width, height, p.P2D);

    this.#graphics.P2D = <p5.Graphics>p; // white lie
    
    this.#graphics.SVG = p.createGraphics(width, height, (p as any).SVG);

    const s = Math.ceil(4000 / Math.max(width, height)); //target 4K resolution
    this.P2DhiScale = s;
    this.#graphics.P2Dhi = p.createGraphics(width*s, height*s, p.P2D);

    // Convenience /////////////////////////////////////////////////////
    this.mouse = new Mouse( p );
    this.initializeGUI()

    // Image Capture
    this.onDraw(() => this.#recordSVG(), DrawStages.manager_postdraw)
    this.onDraw(() => this.#recordImage(), DrawStages.manager_postdraw)

    // Settings IO
    this.canvas.drop(this.receiveGUIPresetFromFile.bind(this))

    // Commandeer the automatic p5 draw loop
    this.pInst.draw = this.drawAll
    return this;
  }
  
  get canvases() { return { ...this.#graphics } }
  applyToCanvases( callback: (canvas: p5 | p5.Graphics, name: string)=>void ) {
    for (const [canvasName, canvas] of Object.entries(this.canvases)) {
      callback(canvas, canvasName);
    }
  }

  debugViewCanvases() {
    // this.canvas.hide()
    this.#graphics.SVG.show();
    this.#graphics.P2Dhi.show();
  }

  //====================================================

  #allStages = <DrawStages[]>Object.values(DrawStages).filter(v=> typeof v === "number")
  #userStages = [DrawStages.predraw, DrawStages.draw, DrawStages.postdraw]

  #userDrawCalls = new Map(this.#allStages.map(stage => [
    <DrawStages>stage, 
    <DrawCall[]>[]
  ]));

  registerDrawCall( func: DrawCall, stage = DrawStages.draw, top = false ) {
    if (!isFunction(func)) throw 'User-defined draw() is not a function!'
    const stageCalls = this.#userDrawCalls.get(stage)
    if (!stageCalls) throw `No initialized function array for stage ${stage}!`
    if (top) stageCalls.unshift(func)
    else stageCalls.push(func)
  }
  drawThis = this.registerDrawCall
  onDraw = this.registerDrawCall
  onLoop = this.registerDrawCall
  animate = this.registerDrawCall

  clearDrawCalls( stage: DrawStages = DrawStages.draw ) { 
    const stageCalls = this.#userDrawCalls.get(stage)
    if (stageCalls) stageCalls.length = 0
  }
  getDrawCallMap = () => this.#userDrawCalls
  getDrawCalls = ( stages = this.#allStages ) => 
    stages.flatMap(stage => this.#userDrawCalls.get(stage))

  //====================================================

  runDrawStages = (stages = this.#allStages, graphics = this.#graphics.P2D) => {
    for (const stage of stages) {
      const drawCalls = this.#userDrawCalls.get(stage)
      if (stage === DrawStages.draw && !drawCalls?.length) 
        console.warn("No user-defined draw() functions registered!");
      if (drawCalls) for (const drawCall of drawCalls) { drawCall(graphics) }
    }
  }
  drawAll = this.runDrawStages

  runPreDraw() {
    this.runDrawStages([DrawStages.manager_predraw])
  }

  runUserDraw(graphics = this.#graphics.P2D) {
    this.runDrawStages([DrawStages.predraw, DrawStages.draw, DrawStages.postdraw], graphics)
  }

  runPostDraw() {
    this.runDrawStages([DrawStages.manager_postdraw])
  }


  //=====================================================

  #frameRateHistoryLength = 5
  #frameRates = new RecentAverage(this.#frameRateHistoryLength*60, 60)
  #writeFPStoTitle() {
    let frameRate = this.pInst.frameRate()
    let avg = this.#frameRates.tick(frameRate, frameRate*this.#frameRateHistoryLength)
    document.title = `${Math.round(frameRate)}/${Math.round(avg)} fps, Frame ${this.pInst.frameCount}`
  }
  writeFPStoTitleOnDraw() {
    this.onDraw(() => this.#writeFPStoTitle(), DrawStages.manager_predraw)
  }

  //=====================================================

  #svgRequested = false;
  requestSVG = () => { this.#svgRequested = true; }
  #recordSVG = () => {
    if (!this.#svgRequested) return;
    this.#svgRequested = false;

    if (!this.#graphics.SVG) throw "Can't record an SVG!";
    if (!this.getDrawCalls(this.#userStages).length) 
      throw "Can't record an SVG! No user-defined draw() functions registered;";

    const ts = getTimeStamp()

    const svgc = (this.#graphics.SVG as p5.Graphics);
    svgc.clear(0,0,0,0);
    svgc.push();
    this.runUserDraw(svgc);
    processSVG(this.pInst, svgc);
    svgc.save(ts);
    svgc.pop();
  }

  #imageRequested = false;
  requestImage = () => { this.#imageRequested = true; }
  #recordImage = () => {
    if (!this.#imageRequested) return;
    this.#imageRequested = false;

    if (!this.getDrawCalls(this.#userStages).length) 
      throw "No user-defined draw() functions registered;";

    const ts = getTimeStamp()

    if (this.#graphics.P2D) {
      const p2dc = this.#graphics.P2D;
      p2dc.clear(0,0,0,0);
      p2dc.push();
      this.runUserDraw(p2dc);
      p2dc.save(ts);
      p2dc.pop();
    }

    if (this.#graphics.P2Dhi) {
      const p2dhic = this.#graphics.P2Dhi;
      p2dhic.clear(0,0,0,0);
      p2dhic.push();
      p2dhic.scale(this.P2DhiScale);
      this.runUserDraw(p2dhic);
      p2dhic.save(ts+'_hi');
      p2dhic.pop();
    }
  }


 

  //=====================================================
  
  gui?: Pane;
  guiCheck = () => {if ( !this.gui ) throw "GUI is not initialized!"}

  initializeGUI() {
    if (this.gui) return

    const pane = new Pane({ title: "Parameters" })
    pane.registerPlugin(EssentialsPlugin)
    
    // FPS Graph
    let fpsgraph = (pane.addBlade({
      view: "fpsgraph",
      label: "FPS",
      lineCount: 3
    }) as FpsGraphBladeApi)
    this.onDraw(() => fpsgraph.begin(), DrawStages.manager_predraw)
    this.onDraw(() => fpsgraph.end(), DrawStages.manager_postdraw)
    
    // Preset Save
    const presetButtons = new Map([
      ["Import", this.openFileDialogForGUIPreset.bind(this)],
      ["Export", this.saveGUIPresetToFile.bind(this)],
    ]);
    (pane.addBlade({
      view: "buttongrid",
      size: [2, 1],
      cells: (x: number, y: number) => ({
        title: Array.from( presetButtons.keys() )[x + y*2]
      }),
      label: "Preset"
    }) as ButtonGridApi).on("click", ev => {
      const func = presetButtons.get(ev.cell.title)
      if (func) func()
    })

    // Image Save
    const saveButtons = new Map([
      ["PNG", this.requestImage],
      ["SVG", this.requestSVG],
      ["ALL", () => { this.requestImage(); this.requestSVG(); }],
      // ["Preset", null] // TODO
    ]);
    (pane.addBlade({
      view: "buttongrid",
      size: [3, 1],
      cells: (x: number, y: number) => ({
        title: Array.from( saveButtons.keys() )[x + y*3]
      }),
      label: "Save"
    }) as ButtonGridApi).on("click", ev => {
      const func = saveButtons.get(ev.cell.title)
      if (func) func()
    })

    // Keep GUI updated with bound values
    this.onDraw(() => pane.refresh(), DrawStages.manager_postdraw)
    
    // Begin auto-saving to local storage
    this.registerAutoSaveInterval()

    this.gui = pane;
  }

  registerGUIAdditions(callback: (pane: Pane)=>void) {
    if (!this.gui) this.initializeGUI()
    if (this.gui) callback(this!.gui)
    // TODO until error fixed
    // this.getGUIPresetFromLocalStorage()
  }
  


  //=====================================================


  #localStoragePresetKey = "p5ManagerPresetData"
  #localStorageSaveTimeKey = "p5ManagerPresetTime"
  saveGUIPresetToLocalStorage() {
    try {
      this.guiCheck()
      const preset = JSON.stringify(this.gui?.exportPreset(), vectorReplacer)
      this.pInst.storeItem(this.#localStoragePresetKey, preset)
      this.pInst.storeItem(this.#localStorageSaveTimeKey, Date.now())
    } catch (error) {
      return console.error(error)
    }
  }

  #autoSaveTimer?: number | null;
  registerAutoSaveInterval(ms = 5000) {
    if (this.#autoSaveTimer != null){
      clearInterval(this.#autoSaveTimer);
      this.#autoSaveTimer = null;
    }
    this.#autoSaveTimer = setInterval(
      this.saveGUIPresetToLocalStorage.bind(this), 
      ms
    );
  }
  // TODO unregister function, if necessary

  getGUIPresetFromLocalStorage() {
    try {
      this.guiCheck()
      const presetString = this.pInst.getItem(this.#localStoragePresetKey)
      if ( !presetString || !isString(presetString)) 
        throw "No stored preset available..."
      const preset = JSON.parse(presetString)
      this.gui?.importPreset(preset) //load
      const presetSaveTime = this.pInst.getItem(this.#localStorageSaveTimeKey)
      if ( !presetSaveTime || !isNumber(presetSaveTime) )
        throw "Stored preset save time is invalid!"
      const savetime = new Date(presetSaveTime).toString()
      console.log(`Loaded GUI preset from local storage @ ${savetime}`);
    } catch (error) {
      return console.error(error)
    }
  }

  #presetExtension = 'preset.json'
  saveGUIPresetToFile(timestamp = getTimeStamp()) {
    try {
      this.guiCheck()
      const preset = this.gui?.exportPreset()
      console.debug("Preset to prepare:", preset)
      const string = JSON.stringify(preset, vectorReplacer)
      console.debug("Preset output:", string)
      this.pInst.saveStrings(string.split('\n'), timestamp, this.#presetExtension)
    } catch (error) {
      return console.error(error)
    }
  }

  receiveGUIPresetFromFile(file: p5.File) {
    try {
      this.guiCheck()
      if ( !file ) throw ("No file received...")
      if ( !file.size ) throw ("File received is empty...")
      if ( 
        file.subtype !== "json" || 
        !file.name?.toLowerCase().endsWith(this.#presetExtension)
      ) throw ("Not a preset file...")
      console.debug("Received preset file data:", file.data);
      this.gui?.importPreset(file.data)
      console.log(`Loaded GUI preset from ${file.name}`);
    } catch (error) {
      return console.error(error)
    }
  }


  openFileDialogForGUIPreset() {
    const input = this.pInst.createFileInput((file: any) => {
      console.log(...arguments);
      this.receiveGUIPresetFromFile(file)
      input.remove()
    }, false)
    input.hide()
    setTimeout(() => {
      input.elt.click();
    }, 250);
  }

}

