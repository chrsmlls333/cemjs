export const averageArray = (array) => {
  let sum = array.reduce((a, b) => a + b, 0)
  let avg = (sum * 1.0 / array.length) || 0;
  return avg;
}

export class Queue { 
  constructor(from = null, defaultValue = 0) {
    let a;
    if (from == null) 
      a = [];
    else if (Array.isArray(from)) 
      a = from;
    else if ( Number.isInteger(from) ) 
      a = Array(from).fill(defaultValue);
    else
      throw 'I need an array, integer, or nothing to build this Queue!'
    this.a = a;
  }
  enqueue(e) {
    this.a.push(e);
  }
  dequeue() {
    return this.a.shift();
  }
  isEmpty() {
    return this.a.length == 0;
  }
  peek() {
    return !this.isEmpty() ? this.a[0] : undefined;
  }
  length() {
    return this.a.length;
  }
  average() {
    return averageArray(this.a);
  }
  tick(value) {
    this.enqueue(v);
    this.dequeue();
    return this.average();
  }
}

