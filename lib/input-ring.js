'use babel';

import CBuffer from 'CBuffer';

const ring = Symbol();
const offset = Symbol();

export default class ComintInputRing {
  constructor() {
    this[ring] = new CBuffer(50);
    this[offset] = 0;
  }
  
  push(input) {
    console.log(`push '${input}' onto ring.`);
    this[ring].shift();
    this[ring].unshift(input);
    this[ring].unshift("");
    console.log(`push: ring is ${JSON.stringify(this[ring].toArray())}`);
  }
  
  getPrevious() {
    this.incOffset();
    var v = this[ring].get(this[offset]);
    console.log(`getPrevious: offset is now ${this[offset]}, returning '${v}'`);
    console.log(`getPrevious: ring is ${JSON.stringify(this[ring].toArray())}`);
    return v;
  }
  
  getNext() {
    console.log(`getNext: ring is ${JSON.stringify(this[ring].toArray())}`);
    this.decOffset();
    var v = this[ring].get(this[offset]);
    console.log(`getNext: offset is now ${this[offset]}, returning '${v}'`);
    return v;
  }
  
  incOffset() {
    this[offset] ++;
    if (this[offset] === (this[ring].toArray().length)) {
      this[offset] = 0;
    }
  }
  
  decOffset() {
    this[offset] --;
    if (this[offset] === -1) {
      this[offset] = this[ring].toArray().length - 1;
    }
  }
  
  popAndReset() {
    // TODO also check if the current input matches the front, in case we edited it.
    if (this[offset] > 0) {
      this[ring].rotateLeft(this[offset]);
      var v = this[ring].shift();
      this[ring].rotateRight(this[offset]);
      this[offset] = 0;
    }
  }


}