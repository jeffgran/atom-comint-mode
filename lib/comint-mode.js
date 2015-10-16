'use babel';

import ComintBuffer from './comint-buffer';
import { CompositeDisposable } from 'atom';

// TODO:
// - comint-beginning-of-line
//   √ prompt-regex search
//   - prompt-regex setting
//   √ marker for prompt
//   - prompt should be as read-only as possible?
//   √ bol command looks for prompt beginning
//   - related: sendInput on a previous prompt line should strip out the prompt
//
// - break out shell-mode
// - derived-mode generator
//
// - readline autocomplete provider
//
// √ sendCommand should take the rest of the line, not just up to the cursor
// - input ring
//   √ save input into ring
//   √ cycle through past inputs with keybinding
//   - fuzzy-match (or non-fuzzy match) past inputs
//
// - comint-process-echoes -- remove echo from output
//
// - ANSI color rendering
// - ANSI cursor movement rendering
//
// - auto-truncate based on configured max "scrollback"
//
// NICE TO HAVE
// - option for "scroll to bottom on output"
// - default "terminal" width to atom's "preferred width" setting?
// - "send-invisible" -- read password and send to process
//   - comint-watch-for-password-prompt to automatically invoke ^
// - execute selection
//
//
// - SHELL MODE
// - default directory to current project dir
// - directory-tracking-mode
//   - modify prompt to include "hidden" pwd tag
//   - strip out pwd tag and send pwd message to comint-buffer obj
// - open file at point (use navigate package?)
//   - with line number
//     - with column number?


export default {

  subscriptions: null,
  buffers: null,

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'comint-mode:newShell': () => { this.newShell(); }
    }));

    atom.commands.add('atom-text-editor.comint-mode', 'comint-mode:send-command', (event) => {
      this.sendCommand();
    });

    atom.commands.add('atom-text-editor.comint-mode', 'comint-mode:clear-buffer', (event) => {
      this.clearBuffer();
    });

    atom.commands.add('atom-text-editor.comint-mode', 'comint-mode:input-ring-previous', (event) => {
      this.inputRingPrevious();
    });

    atom.commands.add('atom-text-editor.comint-mode', 'comint-mode:input-ring-next', (event) => {
      this.inputRingNext();
    });

    atom.commands.add('atom-text-editor.comint-mode', 'comint-mode:move-to-beginning-of-line', (event) => {
      this.moveToBeginningOfLine();
    });

    this.buffers = [];
  },

  deactivate() {
    this.subscriptions.dispose();
    this.buffers.forEach((buf) => {
      buf.dispose();
    });
  },

  serialize() {
    return {};
  },

  newShell() {
    console.log('Comint-mode:newShell was called!');

    this.buffers.push(new ComintBuffer());
  },

  sendCommand() {
    this.tryComintBufferAction('sendCommand');
  },

  clearBuffer() {
    this.tryComintBufferAction('clearBuffer');
  },

  inputRingPrevious() {
    this.tryComintBufferAction('inputRingPrevious');
  },

  inputRingNext() {
    this.tryComintBufferAction('inputRingNext');
  },

  moveToBeginningOfLine() {
    this.tryComintBufferAction('moveToBeginningOfLine');
  },

  tryComintBufferAction(method) {
    var textEditor = atom.workspace.getActiveTextEditor();
    var cbuf = textEditor.comintBuffer;
    if (cbuf) {
      cbuf[method].call(cbuf);
    } else {
      alert("No buffer process!");
    }
  }

};
