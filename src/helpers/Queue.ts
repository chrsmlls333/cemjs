
export const averageArray = (array: number[]) => {
  let sum = array.reduce((a, b) => a + b, 0)
  let avg = (sum * 1.0 / array.length) || 0;
  return avg;
}

export class Queue<T = any> { 
  array: T[];

  constructor(from: T[] = []) {
    if (from && !Array.isArray(from)) throw new TypeError("Queue requires a parameter 'from' of type Array, or skip it.")
    if (!from) { this.array = []; return }
    this.array = from;
  }
  enqueue(e: T) { this.array.push(e) }
  dequeue() { return this.array.shift() }
  tick(e: T) {
    this.enqueue(e);
    this.dequeue();
    return this.length();
  }
  peek() {
    if (!this.isEmpty()) return this.array[0]
    else return undefined;
  }
  length() { return this.array.length }
  isEmpty() { return this.array.length === 0 }
  toArray() { return Array.from(this.array) }
}

export class RecentAverage {
  #history: Queue<number>
  #historySamples: number

  constructor(historySamples = 100, defaultValue = 60) {
    this.#historySamples = historySamples
    this.#history = new Queue(Array(historySamples).fill(defaultValue))
  }
  tick(latestValue: number, samples = this.#historySamples) {
    this.#history.tick(latestValue)
    this.#history.array
    return this.average(samples)
  }
  average(samples = this.#history.array.length) {
    let len = Math.min(samples, this.#history.array.length);
    return averageArray(this.#history.array.slice(-len));
  }
}
