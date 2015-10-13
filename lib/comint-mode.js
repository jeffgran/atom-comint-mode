'use babel';

import ComintBuffer from './comint-buffer';
import { CompositeDisposable } from 'atom';

// TODO:
// - default directory to current project dir
// - sendCommand should take the rest of the line, not just up to the cursor
// - input ring
//   - save input into ring
//   - cycle through past inputs with keybinding
//   - fuzzy-match (or non-fuzzy match) past inputs
// - auto-truncate based on configured max "scrollback"
// - derived-mode generator
// - comint-process-echoes -- remove echo from output
// - "send-invisible" -- read password and send to process
//   - comint-watch-for-password-prompt to automatically invoke ^
// - execute selection
// - open file at point
//   - directory-tracking-mode? -- need to know the pwd
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
