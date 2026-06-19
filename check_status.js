const http = require('http');
const fs = require('fs');

http.get('http://localhost:3000', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    fs.writeFileSync('status.txt', `STATUS: ${res.statusCode}\n\n${data.substring(0, 1000)}`);
  });
}).on('error', (e) => {
  fs.writeFileSync('status.txt', `ERROR: ${e.message}`);
});
