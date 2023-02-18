import { error, warn } from "../utils/logging";

// P5.js Supplemental //////////////////////////////////////////////////

export const calcScale = (c, i, mode) => {

  //Calculate scale value to fill canvas
  var aspectC = c.width / c.height;
  var aspectI = i.width / i.height;

  switch (mode) {
    case "FILL":
    case "fill":
      if (aspectC >= aspectI) return c.width / i.width;
      else return c.height / i.height;
      break;
    case "FIT":
    case "fit":
      if (aspectC <= aspectI) return c.width / i.width;
      else return c.height / i.height;
      break;
    default:
      error("CEM.calcScale(): argument 3 should be 'fill' or 'fit'\nNo scaling calculated.");
      return 1;
  }
};

export const calcFillScale = (c, i) => {
  warn("CEM.calcFillScale() deprecated. Use calcScale().");
  calcScale(c, i, "fill");
};