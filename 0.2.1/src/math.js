// Math Functions //////////////////////////////////////////////////////

export * from "./scalingfit.js";
export * from "./random.js";
export * from "./p5math.js";

const findStep = (func, value, step) => {
    if (step == 0) return 0; //throw?
    return step * func(value / step);
}
export const roundStep = function(value, step = 1) { return findStep(Math.round, ...arguments) };
export const floorStep = function(value, step = 1) { return findStep(Math.floor, ...arguments) };
export const  ceilStep = function(value, step = 1) { return findStep( Math.ceil, ...arguments) };

const operateOnVecComponents = (vec, func) => {
    if (!(vec instanceof p5.Vector)) throw "I actually only work with p5.Vector objects, sorry!"
    const xyz = vec.array();
    const newxyz = xyz.map(v => func(v));
    return vec.set(newxyz);
}
export const roundVector = function(vec) { return operateOnVecComponents(vec, Math.round) };
export const floorVector = function(vec) { return operateOnVecComponents(vec, Math.floor) };
export const  ceilVector = function(vec) { return operateOnVecComponents(vec,  Math.ceil) };