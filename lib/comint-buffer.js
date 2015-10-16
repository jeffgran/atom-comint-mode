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
const _promptRegex = Symbol();

export default class ComintBuffer {
  
  constructor() {
    atom.workspace.open("comint-mode://shell")
    .done( (te) => {
      
      te.comintBuffer = this;
      //console.log(te);
      this.textEditor = te;
      this.initializeTextBuffer();
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
    this[_promptRegex] = /^[^#$%>\n]*[#$%>] */m; // TODO make this configurable
  }
  
  dispose() {
    if (this[_term]) {
      this[_term].kill();
    }
  }
  
  initializeTextBuffer() {
    // TODO ... not working. wanted to prevent deletion of prompts
    // this.textEditor.onWillInsertText( (event) => {
    //   console.log(event);
    // });
  }
  
  renderOutput(output) {
    output = AnsiUp.ansi_to_text(output);
    var promptRange = this.findPromptRange(output);
    var insertedRange = this.buffer.insert(
      this.processInsertionPoint, 
      output,
      {undo: 'skip'}
    );
    
    if (promptRange) {
      var promptMarker = this.textEditor.markBufferRange(
        [
          insertedRange.start.traverse([0, promptRange.offset]), 
          insertedRange.start.traverse([0, promptRange.offset + promptRange.size])
        ],
        {comintPrompt: true, invalidate: 'inside'}
      );
      //console.log(promptMarker);
      //console.log(promptMarker.getBufferRange());
      var promptDecoration = this.textEditor.decorateMarker(promptMarker, {
        type: 'highlight',
        class: 'prompt'
      });
      //console.log(promptDecoration);
      //atom.views.getView(atom.workspace).focus();
    }
    
    
    this.processInsertionPoint = insertedRange.end;
    
    // we clip it and leave a "no-mans land" of one character in between. this
    // is so that typing won't expand that range, since we would be typing
    // adjacent to the range marker. We later have to put that extra character
    // back on when computing where to insert artificial user input -- i.e. 
    // from the input ring.
    var clippedRange = [
      [insertedRange.start.row, insertedRange.start.column],
      [insertedRange.end.row, insertedRange.end.column - 1]
    ];
    this.lastInsertedRangeMarker = this.buffer.markRange(
      clippedRange, 
      {comintProcessOutput: true, invalidate: 'never'}
    );

    if (this.textEditor.getCursorBufferPosition().isGreaterThanOrEqual(this.processInsertionPoint)) {
      this.textEditor.scrollToBufferPosition(insertedRange.end);
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
  

  findPromptRange(string)  {
    var matchData = this[_promptRegex].exec(string);
    if (matchData) {
      var fullPrompt = matchData[0];
      console.log(`found fullPrompt: ${fullPrompt}`);
      var index = matchData.index;
      return { 
        offset: index, 
        size: fullPrompt.length
      };
    } else {
      return null;
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
  
  moveToBeginningOfLine() {
    var prompts = this.textEditor.findMarkers({ 
      endBufferRow: this.textEditor.getCursorBufferPosition().row,
      comintPrompt: true
    });
    
    console.log("found prompts!");
    console.log(prompts);
    
    if (prompts.length > 0) { // it could only be 1, really
      var bol = prompts[0].getBufferRange().end;
      console.log(prompts[0].getBufferRange());
      this.textEditor.setCursorBufferPosition(bol);
    } else {
      this.textEditor.moveToBeginningOfLine();
    }
  }
  
}

