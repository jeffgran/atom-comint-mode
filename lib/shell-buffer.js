'use babel';

import ComintBuffer from './comint-buffer';

export default class ShellBuffer extends ComintBuffer {
  constructor() {
     // TODO put these options in the configuration
    var command = atom.config.get('comint-mode.shellCommand');
    var args = atom.config.get('comint-mode.arguments');
    var promptRegex = atom.config.get('comint-mode.promptRegex');
    promptRegex = new RegExp(promptRegex);
    console.log(promptRegex);
    super(command, args, promptRegex);
  }
}