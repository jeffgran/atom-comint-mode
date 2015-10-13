var pty = require('pty.js');

var ptyProcess = pty.spawn('bash', ['-l'], {
    name: 'atom',
    cwd: process.env.HOME,
    env: process.env
});

//ptyProcess.write("stty -echo\n");

ptyProcess.on('data', function (data) {
    process.send(data);
});

process.on('message', function (message) {
    if (message.event == 'input') {
        ptyProcess.write(message.text);
    }
});
