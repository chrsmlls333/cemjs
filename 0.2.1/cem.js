// CEM LIBRARY //////////////////////////////////////////////////////////

/*
  Instructions:
  Declare CEM object at top of code.
  > import * as CEM from './libraries/cem/0.2.1/cem.js';
  
  Include key:value pairs for settings.
  Include this injector library before anything.

  Available settings in init declaration:
  boolean verbose || true
    enables debug printing to console
*/

// Classes
export * from './src/helpers/UIZoom.js';
export * from './src/helpers/Clock.js';
export * from './src/helpers/Queue.js';

// Named Groups
export * as THREE from './src/helpers/THREE.js';
export * as Timers from './src/helpers/Timers.js';
export * as SVG from './src/p5SVG.js';

// Assorted
export * from './src/math/index.js';
export * from './src/logging.js';

//============================================

import { Queue } from './src/helpers/Queue.js';
import { SVGmode, processSVG } from './src/p5SVG.js';


const frames = new Queue(30, 60);
export const preDraw = function() {
  frames.tick(frameRate());
  document.title = `${int(frameRate())}/${int(frames.average())} fps, Frame ${frameCount}`;
  if (SVGmode()) clear();

}

export const postDraw = function() {
  recordSVG();
}

//===========================================


let svgRequested = false;
export const requestSVG = () => { svgRequested = true; }
const recordSVG = () => {
  if (!svgRequested) return;
  if (!SVGMode()) console.log("Can't record an SVG with this kind of canvas!")

  processSVG();
  save();
  // const svgGraphicsContainer = querySVG(':scope > g');
  // const backgroundSVG = querySVG(':scope > g > rect:first-child')
  svgRequested = false;
}