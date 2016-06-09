export default class Cycle {
  constructor(values) {
    this.values = values;
  }

  create(initialValueIndex = 0) {
    return new CycleInstance(this, initialValueIndex);
  }
}

class CycleInstance {
  constructor(cycle, valueIndex = 0) {
    this.cycle = cycle;
    this.valueIndex = valueIndex;
  }

  goBackward() {
    this.valueIndex = (this.valueIndex === 0 ? this.cycle.values.length : this.valueIndex) - 1;
  }

  goForward() {
    this.valueIndex = (this.valueIndex + 1) % this.cycle.values.length;
  }

  get value() {
    return this.cycle.values[this.valueIndex];
  }
}