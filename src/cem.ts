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
// export * from '../legacy/UIZoom.js';
export * from './helpers/Clock.js';
export * from './helpers/Queue.js';
export * from './p5/p5Manager.js';

// Named Groups
// export * as THREE from './helpers/THREE.js';
export * as Timers from './helpers/Timers.js';
export * as SVG from './p5/p5SVG.js';

// Assorted
export * from './math/index.js';
export * from './utils/logging.js';

//============================================
