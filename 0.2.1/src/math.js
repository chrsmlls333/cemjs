// Math Functions //////////////////////////////////////////////////////

export * from "./scalingfit.js";
export * from "./random.js";
export * from "./p5math.js";

// TO BE SORTED //

export const averageArray = (array) => {
  let sum = array.reduce((a, b) => a + b, 0)
  let avg = (sum * 1.0 / array.length) || 0;
  return avg;
}