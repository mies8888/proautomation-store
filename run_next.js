const { spawn } = require('child_process');
const fs = require('fs');
const out = fs.openSync('next_out.log', 'w');
const err = fs.openSync('next_err.log', 'w');

console.log('Starting Next.js...');
const child = spawn('npx.cmd', ['next', 'dev'], {
  stdio: ['ignore', out, err]
});

child.on('close', (code) => {
  fs.writeFileSync('next_exit.log', `Child exited with code ${code}`);
});
