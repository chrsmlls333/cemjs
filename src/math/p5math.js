// P5 Math https://github.com/trembl/p5.Math.js //

// Converts from degrees to radians.
export const radians = (degs) => degs * (Math.PI / 180.0);
export const toRadians = radians;

// Converts from radians to degrees.
export const degrees = rads => rads * (180.0 / Math.PI);
export const toDegrees = degrees;

export const constrain = (amt, low, high) => (amt < low) ? low : ((amt > high) ? high : amt);

export const dist = (x1, y1, x2, y2) => Math.sqrt(p5.sq(x2 - x1) + p5.sq(y2 - y1));

export const lerp = (start, stop, amt) => start + (stop - start) * amt;

export const norm = (value, start, stop) => (value - start) / (stop - start);
export const normalize = norm;

export const map = (value, istart, istop, ostart, ostop) => {
  return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
};