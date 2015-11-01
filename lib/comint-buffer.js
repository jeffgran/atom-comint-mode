'use babel';

import {Point, Range} from 'atom';
import pty from 'pty.js';
import AnsiUp from 'ansi_up';
import {fork} from 'child_process';
import _ from 'underscore-plus';
import ComintInputRing from './input-ring';
import Shellwords from 'shellwords';

const _textEditor = Symbol();
const _term = Symbol();
const _inputRing = Symbol();
const _promptRegex = Symbol();
const _messageInterceptor = Symbol();

export default class ComintBuffer {
  
  constructor(command, args, promptRegex) {
    atom.workspace.open("comint-mode://shell").done( (te) => {
      this.setTextEditor(te);
      var options = {
        command: command,
        args: args,
        cwd: atom.project.getPaths()[0],
        cols: te.displayBuffer.getEditorWidthInChars()
      };
      
      var processPath = require.resolve('./terminal-process');
      var bootstrap = `require('${processPath}')(${JSON.stringify(options)});`;
      this[_term] = fork('--eval', [bootstrap], {env: process.env, cwd: process.env.HOME});
      this.messageInterceptor = this.renderOutput.bind(this);
      this[_term].on('message', this.interceptMessage.bind(this));
      this[_term].on('error', (err) => console.log(err) );
    });
    
    this[_inputRing] = new ComintInputRing();
    this[_promptRegex] = promptRegex;
  }
  
  
  //
  // initialize a new atom TextEditor as a comint-mode buffer
  //
  setTextEditor(te) {
    te.comintBuffer = this;
    te.setGrammar(atom.grammars.grammarForScopeName('comint'));
    this.textEditor = te;
    
    var editorElement = atom.views.getView(te);
    editorElement.classList.add("comint-mode");
    
    this.processInsertionPoint = new Point(0,0);
  }
  
  
  //
  // when this buffer is killed, kill the associated terminal process too.
  //
  dispose() {
    if (this[_term]) {
      this[_term].kill();
    }
  }

  //
  // a message has come from the process. what to do?
  //
  interceptMessage(message) {
    this[_messageInterceptor].call(this, message);
  }
  
  
  //
  // change what we do when we get data from the process
  //  - interceptor function takes one arg -- the string of data from the proc
  //
  set messageInterceptor(fn) {
    this[_messageInterceptor] = fn;
  }
  
  get messageInterceptor() {
    return this[_messageInterceptor];
  }
  
  
  //
  // given output from the terminal process, render it into the buffer
  //
  renderOutput(output) {
    
    // strip out backspace characters. TODO maybe strip out other control
    // characters too? We'll likely never want them. 
    output = output.replace(/\x08/, '');
    
    // strip out any ANSI directives for color, cursor movement, etc.
    // TODO render them correctly instead of just stripping them.
    output = AnsiUp.ansi_to_text(output);
    
    // don't render empty output
    if (output.length === 0) return;
    
    // console.log(`rendering output: ${output}`);
    // for (var i = 0, len = output.length; i < len; i++) {
    //   console.log(output[i], output.charCodeAt(i));
    // }

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

      var promptDecoration = this.textEditor.decorateMarker(promptMarker, {
        type: 'highlight',
        class: 'prompt'
      });

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
    
    if (this.textEditor.getCursorBufferPosition()
        .isGreaterThanOrEqual(this.processInsertionPoint)) {
      this.textEditor.scrollToBufferPosition(insertedRange.end);
    }
    
  }
  
  
  //
  // the last place we inserted output from the terminal process
  //
  get processInsertionEnd() {
    var marker = this.lastInsertedRangeMarker;
    if (marker) {
      return marker.getEndPosition();
    } else {
      return new Point(0,0);
    }
  }
  
  
  
  getCurrentCommand(yank) {
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
      if (yank) this.buffer.delete(r);
      this.processInsertionPoint = this.buffer.getEndPosition();
    }

    console.log(`Got command: "${line}"`);
    
    return line;
  }


  //
  // send the currently entered command to the terminal process
  //
  sendCurrentCommand() {
    this.sendCommand(this.getCurrentCommand(true));
  }
  
  
  
  sendCommand(line) {
    // TODO also check if the current input matches the front, in case we edited
    // it.
    this[_inputRing].popAndReset(); // remove the current input from ring
    if (line.length > 0) {
      this.addToInputRing(line);
    }
    
    this[_term].send(`${line}\n`);
  }
  
  sendControlC() {
    this[_term].send("\x03"); // ^C is hex 3
  }
  
  
  //
  // automatically insert fake user input.
  //
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
  
  
  //
  // clear the screen
  //
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
  

  //
  // auxilliary function to find prompts in a chunk of output from the process
  //
  findPromptRange(string)  {
    var matchData = this[_promptRegex].exec(string);
    if (matchData) {
      var fullPrompt = matchData[0];
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
    
    if (prompts.length > 0) { // it could only be 1 or 0, really
      this.textEditor.setCursorBufferPosition(prompts[0].getBufferRange().end);
    } else {
      this.textEditor.moveToBeginningOfLine();
    }
  }
  
  bashAutoComplete(prefix) {
    var prevFn = this.messageInterceptor;
    var accumulatedOutput = "";
    var currentCommand = this.getCurrentCommand();
    
    var mode = "accumulate";
    
    var promise = new Promise( (resolve, reject) => {
      
      this.messageInterceptor = function(message) {
        
        accumulatedOutput += message;
        
        if (mode == "accumulate" && accumulatedOutput.slice(-3) == "!!!") {
          mode = "terminate";
          this[_term].send("\x15"); // NAK -- kill that input now
          this[_term].send("J");
          
          // weird split is char code 13 -- "carriage return"/C-m/^M,
          // so we strip those out.
          var fixedOutput = accumulatedOutput.replace(/.\r/g, '');
          // console.log(`accumulatedOutput is ${accumulatedOutput}`);
          // console.log(`fixedOutput is ${fixedOutput}`);
          
          var numStaticWords = Shellwords.split(currentCommand).length - 1;
          var words = Shellwords.split(fixedOutput.slice(0, -3)).slice(numStaticWords);
          // console.log("autocomplete words:");
          // console.log(words);
          var prefix = Shellwords.split(currentCommand).slice(-1)[0];
          var suggs = words.map( (t) => {
            return {
              text: t,
              replacementPrefix: prefix
            }; 
          });
          // console.log(suggs);
          resolve(suggs);
        } else if (mode == "terminate" && message.slice(-1) == "J") {
            //console.log("resetting messageInterceptor");
            // ^[^H -- escape,backspace -- backspace without echoing
            this[_term].send("\x1b\x08");
            this.messageInterceptor = prevFn; // we're done here.
        }
        
      };
    });
    
    this[_term].send(currentCommand);
    
    // Meta-*, default binding for bash's `insert-completions` command
    this[_term].send("\x1b*");
    
     // !!! -- we'll look for that to be our signal that completions output is 
     // over.
    this[_term].send("!!!");
    
    return promise;
  }
  
}