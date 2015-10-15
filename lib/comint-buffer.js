'use babel';

import {Point, Range} from 'atom';
import pty from 'pty.js';
import AnsiUp from 'ansi_up';
import {fork} from 'child_process';
import _ from 'underscore-plus';
import ComintInputRing from './input-ring';

const _textEditor = Symbol();
const _term = Symbol();
const _inputRing = Symbol();

export default class ComintBuffer {
  
  constructor() {
    atom.workspace.open("comint-mode://shell")
    .done( (te) => {
      
      te.comintBuffer = this;
      //console.log(te);
      this.textEditor = te;
      this.processInsertionPoint = new Point(0,0);
      
      var editorElement = atom.views.getView(te);
      editorElement.classList.add("comint-mode");
      
      var processPath = require.resolve('./terminal-process');
      var bootstrap = `require('${processPath}');`;
      // console.log(processPath);
      // console.log(bootstrap);
      this[_term] = fork('--eval', [bootstrap], {env: process.env, cwd: process.env.HOME});
      this[_term].on('message', this.renderOutput.bind(this));
      this[_term].on('error', (err) => console.log(err) );
      
    });
    
    this[_inputRing] = new ComintInputRing();

  }
  
  renderOutput(output) {
    var insertedRange = this.buffer.insert(this.processInsertionPoint, AnsiUp.ansi_to_text(output), {undo: 'skip'});

    var clippedRange = [
      [insertedRange.start.row, insertedRange.start.column],
      [insertedRange.end.row, insertedRange.end.column - 1]
    ];
    this.lastInsertedRangeMarker = this.buffer.markRange(clippedRange, {comintProcessOutput: true, invalidate: 'never'});
    this.processInsertionPoint = insertedRange.end;

    if (this[_textEditor].getCursorBufferPosition().isGreaterThanOrEqual(this.processInsertionPoint)) {
      this[_textEditor].scrollToBufferPosition(insertedRange.end);
    }

  }
  
  get processInsertionEnd() {
    var marker = this.lastInsertedRangeMarker;
    if (marker) {
      return marker.getEndPosition();
    } else {
      return new Point(0,0);
    }
  }
  
  sendCommand() {
    var point = this[_textEditor].getCursorBufferPosition();
    var line;
    if (point.isLessThan(this.processInsertionEnd)) {
      line = this.buffer.lineForRow(point.row);
    } else {
      var r = [
        [this.processInsertionEnd.row, this.processInsertionEnd.column + 1], 
        this.buffer.getEndPosition()
      ];
      console.log(`Getting line from ${r.toString()}`);
      line = this.buffer.getTextInRange(r);
      this.processInsertionPoint = this.buffer.getEndPosition();
    }
    this.renderOutput("\n");
    console.log(`Got command: "${line}"`);
    
    // TODO also check if the current input matches the front, in case we edited it.
    this[_inputRing].popAndReset(); // remove the current input from ring
    
    if (line.length > 0) {
      this.addToInputRing(line);
    }
      
    
    
    this[_term].send({event: 'input', text: `${line}\n`});
  }
  
  insertInput(input) {
    this.buffer.delete([
      [this.processInsertionEnd.row, this.processInsertionEnd.column + 1], 
      this.buffer.getEndPosition()
    ]);
    this.buffer.insert(
      [this.processInsertionEnd.row, this.processInsertionEnd.column + 1], 
      input
    );
  }
  
  clearBuffer() {
    this.buffer.setTextInRange(
      [
        [0,0], 
        [this[_textEditor].getCursorBufferPosition().row, 0]
      ],
      "",
      {undo: 'skip'}
    );
  }
  
  dispose() {
    if (this[_term]) {
      this[_term].kill();
    }
  }
  
  get textEditor() {
    return this[_textEditor];
  }
  
  set textEditor(te) {
    this[_textEditor] = te;
    this[_textEditor].onDidDestroy(this.dispose.bind(this));
  }
  
  get proc() {
    return this[_term];
  }
  
  get buffer() {
    return this[_textEditor].getBuffer();
  }
  
  get inputRing() {
    return this[_inputRing];
  }
  
  addToInputRing(input) {
    this[_inputRing].push(input);
  }
  
  inputRingPrevious() {
    this.insertInput(this[_inputRing].getPrevious());
  }
  
  inputRingNext() {
    this.insertInput(this[_inputRing].getNext());
  }
  
}
