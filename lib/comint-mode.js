'use babel';

import ComintBuffer from './comint-buffer';
import ShellBuffer from './shell-buffer';
import { CompositeDisposable } from 'atom';
import BashAutocompleteProvider from './bash-autocomplete-plus-provider.js';
console.log(BashAutocompleteProvider);

// TODO:
// - comint-beginning-of-line
//   √ prompt-regex search
//   - prompt-regex setting
//   √ marker for prompt
//   √ bol command looks for prompt beginning
//   - all movement commands eject you back to the end of the prompt?
//   - better prompt marking for ^
//   ? prompt should be as read-only as possible? ON HOLD, no api for this
//
// √ break out shell-buffer to separate file
// - break out shell-mode to separate package
// - derived-mode generator
//
// - readline autocomplete provider?
// - send signals...
//   - C-c
//   - C-d
//   - ..etc. arbitrary?
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
// - sendInput on a previous prompt line should strip out the prompt
//
//
// - SHELL MODE
// √ default directory to current project dir
// - directory-tracking-mode
//   - modify prompt to include "hidden" pwd tag
//   - strip out pwd tag and send pwd message to comint-buffer obj
//   - filename-only autocomplete provider based on pwd info?
// - open file at point (use navigate package?)
//   - with line number
//     - with column number?


export default {
  
  config: {
    shellCommand: {
      type: 'string',
      default: 'bash'
    },
    arguments: {
      type: 'array',
      default: ['-l'],
      items: {
        type: 'string'
      }
    },
    promptRegex: {
      type: 'string',
      default: '^[^#$%>\n]*[#$%>] *'
    }
  },

  subscriptions: null,
  buffers: null,
  autocompleteProvider: () => { return BashAutocompleteProvider; },

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'comint-mode:newShell': () => { this.newShell(); }
    }));

    this.subscriptions.add(atom.commands.add('atom-text-editor.comint-mode', {
      'comint-mode:send-command': () => { this.sendCommand(); },
      'comint-mode:clear-buffer': () => { this.clearBuffer(); },
      'comint-mode:input-ring-previous': () => { this.inputRingPrevious(); },
      'comint-mode:input-ring-next': () => { this.inputRingNext(); },
      'comint-mode:bash-autocomplete': () => { this.bashAutoComplete(); }, // TODO move to shell-mode
    }));

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

    this.buffers.push(new ShellBuffer());
  },

  sendCommand() {
    this.tryComintBufferAction('sendCurrentCommand');
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

  bashAutoComplete() {
    this.tryComintBufferAction('bashAutoComplete');
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
