// Math Functions //////////////////////////////////////////////////////

export * from "./easing";
export * from "./lineClipping";
export * from "./p5math";
export * from "./random";
export * from "./scalingfit";
export * from "./vectormath";

//

const findStep = (func: (n:number)=>number, value:number, step:number) => {
    if (step == 0) return 0; //throw?
    return step * func(value / step);
}
export const roundStep = function(value:number, step = 1) { return findStep(Math.round, value, step) };
export const floorStep = function(value:number, step = 1) { return findStep(Math.floor, value, step) };
export const  ceilStep = function(value:number, step = 1) { return findStep( Math.ceil, value, step) };

export const mod = (a:number, b:number) => {
    return (((a % b) + b) % b);
}