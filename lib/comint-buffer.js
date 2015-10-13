'use babel';

import {Point, Range} from 'atom';
import pty from 'pty.js';
import AnsiUp from 'ansi_up';
import {fork} from 'child_process';

const _textEditor = Symbol();
const _term = Symbol();

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
    }

    renderOutput(output) {
        var insertedRange = this.buffer.insert(this.processInsertionPoint, AnsiUp.ansi_to_text(output), {undo: 'skip'});
        //console.log(insertedRange);
        //this.buffer.findMarkers({comintProcessMark: true}).map((m) => m.destroy());
        var clippedRange = [
          [insertedRange.start.row, insertedRange.start.column],
          [insertedRange.end.row, insertedRange.end.column - 1]
        ];
        this.lastInsertedRangeMarker = this.buffer.markRange(clippedRange, {comintProcessOutput: true, invalidate: 'never'});
        this.processInsertionPoint = insertedRange.end;
        //this.lastInsertedRange = insertedRange;
        this[_textEditor].scrollToBufferPosition(insertedRange.end);
        //console.log(`processInsertionPoint is now ${this.processInsertionPoint}`);
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
        if (point.isLessThan(this.processInsertionEnd)) {
          var line = this.buffer.lineForRow(point.row);
        } else {
          var r = [[this.processInsertionEnd.row, this.processInsertionEnd.column + 1], [point.row, point.column]];
          console.log(`Getting line from ${r.toString()}`);
          var line = this.buffer.getTextInRange(r);
          this.processInsertionPoint = point;
        }
        this.renderOutput("\n");
        console.log(`Got command: "${line}"`);
        this[_term].send({event: 'input', text: `${line}\n`});
    }

    clearBuffer() {
      this.buffer.delete([[0,0,], [this[_textEditor].getCursorBufferPosition().row, 0]]);
    }

    dispose() {
        if (this[_term]) {
            this[_term].kill();
        }
        // TODO: also remove it from the registry!
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

};
