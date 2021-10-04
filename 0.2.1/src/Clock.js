// Time functions //////////////////////////////////////////////////////

export const millis = () => {
  return window.performance.now();
};

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