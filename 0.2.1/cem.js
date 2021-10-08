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

export const preDraw = function() {
  
}

export const postDraw = function() {
  
}