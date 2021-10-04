// Print functions /////////////////////////////////////////////////////

let verbose = true;
export const setVerbose = (v) => verbose = v;

export const print = (str) => {
  if (verbose) console.log(str);
};

export const warn = (str) => {
  if (verbose) console.warn(str);
};

export const error = console.error;

export const newl = () => print("");
export const newline = newl;

export const tokenize = str => str.split(/\s+/);

