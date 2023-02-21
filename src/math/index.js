// Math Functions //////////////////////////////////////////////////////

export * from "./easing";
export * from "./lineClipping";
export * from "./p5math";
export * from "./random";
export * from "./scalingfit";
export * from "./vectormath";

//

const findStep = (func, value, step) => {
    if (step == 0) return 0; //throw?
    return step * func(value / step);
}
export const roundStep = function(value, step = 1) { return findStep(Math.round, ...arguments) };
export const floorStep = function(value, step = 1) { return findStep(Math.floor, ...arguments) };
export const  ceilStep = function(value, step = 1) { return findStep( Math.ceil, ...arguments) };

export const mod = (a, b) => {
    return (((a % b) + b) % b);
}