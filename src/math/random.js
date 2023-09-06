
let randomFunc = Math.random;
export const setRandomFunction = (_randomFunction = Math.random) => randomFunc = _randomFunction;

export const random = (min, max) => {
  let rand = randomFunc();
  if (typeof min === 'undefined') return rand;
  else if (typeof max === 'undefined') {
    if (min instanceof Array) return min[Math.floor(rand * min.length)];
    else return rand * min;
  } else {
    if (min > max) {
      let tmp = min;
      min = max;
      max = tmp;
    }
    return rand * (max - min) + min;
  }
};

// Random Integer with min and max inclusive
export const randomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(random() * (max - min + 1)) + min;
}

export const coin = (odds = 0.5) => {
  if (random() < odds) return true;
  else return false;
};

export const coinInt = (odds = 0.5) => +coin(odds);

export const flipAdd = (a, b, odds = 0.5) => {
  if (coin(odds)) return a + b;
  else return a - b;
};

// Durstenfeld shuffle
// Array is passed by reference, this edits the original.
// We return it for convenience.
export const shuffleArray = (array) => {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
};

// Randomized Index Generator
export const generateRandomIndex = (length) => {
  const array = [];
  for (var i = 0; i < length; i++) array[i] = i;
  shuffleArray(array);
  return array;
};