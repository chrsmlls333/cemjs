// Print functions /////////////////////////////////////////////////////

let verbose = true;
export const setVerbose = (v) => verbose = v;

export const print = (...args) => {
  if (verbose) console.log(...args);
};

export const warn = (...args) => {
  if (verbose) console.warn(...args);
};

export const error = console.error;

export const newl = () => print("");
export const newline = newl;

export const tokenize = str => str.split(/\s+/);

