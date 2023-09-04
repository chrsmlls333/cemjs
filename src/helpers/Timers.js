// Trackable Timers //////////////////////////////////////////////////////////

let timeoutArray = [];

export const clearTimers = () => {
  if (typeof timeoutArray !== 'undefined') {
    if (timeoutArray.length > 0) {
      for (let i = 0; i < timeoutArray.length; i++) {
        clearTimeout(timeoutArray[i]);
      }
      timeoutArray = [];
    }
  } else {
    timeoutArray = [];
  }
};

export const newTimer = (function_, delay_) => {
  if (delay_ == 0) { function_(); return null }
  let t = setTimeout(function_, delay_);
  timeoutArray.push(t);
  return t;
};