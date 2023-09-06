
let _random = Math.random;
export const setRandomFunction = (randomFunction = Math.random) => _random = randomFunction;

export const random = (min, max) => {
  let rand = _random();
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

export const randomWeighted = (items, _weights = Array(20).fill(1)) => {
  // https://github.com/trekhleb/javascript-algorithms/blob/master/src/algorithms/statistics/weighted-random/weightedRandom.js
  if (!items.length) throw new Error('Items must not be empty');

  var weights = _weights.slice(0); //clone

  var i = 0
  for (i = 0; i < weights.length; i++) 
    weights[i] += weights[i - 1] || 0;
  
  var rand = random() * weights[weights.length - 1];
  
  for (i = 0; i < weights.length; i++)
    if (weights[i] > rand) break;

  return items[i];
}