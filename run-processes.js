const { spawn } = require('child_process');

const serverProcess = spawn('node', ['server.js']);
const sProcess = spawn('node', ['s.js']);

serverProcess.stdout.on('data', (data) => {
  console.log(`server.js output: ${data}`);
});

sProcess.stdout.on('data', (data) => {
  console.log(`s.js output: ${data}`);
});

serverProcess.stderr.on('data', (data) => {
  console.error(`server.js error: ${data}`);
});

sProcess.stderr.on('data', (data) => {
  console.error(`s.js error: ${data}`);
});

serverProcess.on('close', (code) => {
  console.log(`server.js exited with code ${code}`);
});

sProcess.on('close', (code) => {
  console.log(`s.js exited with code ${code}`);
});
