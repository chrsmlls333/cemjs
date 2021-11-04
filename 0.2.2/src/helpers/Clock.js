// Time functions //////////////////////////////////////////////////////

export const millis = () => {
  return window.performance.now();
};

export const getTimeStamp = () => {
  let date = new Date();
  const offset = date.getTimezoneOffset();
  date = new Date(date.getTime() - (offset*60*1000))
  const {
      H, HH, M, MM, S, SS, SSS, d, dd, m, mm, timezone, yy, yyyy
  } = date.toISOString().match(
          /^(?<yyyy>\d\d(?<yy>\d\d))-(?<mm>0?(?<m>\d+))-(?<dd>0?(?<d>\d+))T(?<HH>0?(?<H>\d+)):(?<MM>0?(?<M>\d+)):(?<SSS>(?<SS>0?(?<S>\d+))\.\d+)(?<timezone>[A-Z][\dA-Z.-:]*)$/
      ).groups;
  return `${yyyy}${mm}${dd}-${HH}${MM}${SS}`
}

// == ////////////////////////////////////////////////////////////////////

export class Clock { 
  constructor(autoStart = true) {
    this.autoStart = autoStart;
    this.startTime = 0;
    this.oldTime = 0;
    this.elapsedTime = 0;

    this.running = false;
  }

  start() {
    this.startTime = (performance || Date).now();
    this.oldTime = this.startTime;
    this.elapsedTime = 0;
    this.running = true;
  }

  stop() {
    this.getElapsedTime();
    this.running = false;
  }

  getElapsedTime() {
    this.getDelta();
    return this.elapsedTime;
  }

  getDelta() {
    let diff = 0;
    if (this.autoStart && !this.running) {
      this.start();
    }
    if (this.running) {
      let newTime = (performance || Date).now();
      diff = (newTime - this.oldTime) / 1000;
      this.oldTime = newTime;
      this.elapsedTime += diff;
    }
    return diff;
  }
}