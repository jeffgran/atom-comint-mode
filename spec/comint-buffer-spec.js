'use babel';

import {TextEditor} from 'atom';
import ComintBuffer from '../lib/comint-buffer.js'

describe("ComintBuffer", () => {
  it("instantiates", () => {
    var cb = new ComintBuffer();
    expect(true).toBe(true);
  })
})