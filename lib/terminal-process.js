var pty = require('pty.js');

function fork(options) {
  
  var ptyProcess = pty.spawn(options.command, options.args || [], {
    name: 'atom',
    cwd: options.cwd || process.env.HOME,
    env: process.env
  });
  
  ptyProcess.on('data', function (output) {
    process.send(output);
  });
  
  process.on('message', function (input) {
    ptyProcess.write(input);
  });
}

module.exports = fork;