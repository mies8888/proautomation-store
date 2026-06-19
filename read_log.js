const fs = require('fs');

try {
  const file1 = 'C:\\Users\\misch\\.gemini\\antigravity\\brain\\4d800ced-f873-4cd7-8153-11c2d2a6037c\\.system_generated\\tasks\\task-2014.log';
  const data1 = fs.readFileSync(file1, 'utf8');
  console.log("=== TASK 2014 LOG ===");
  console.log(data1.substring(Math.max(0, data1.length - 2000)));

  const file2 = 'C:\\Users\\misch\\.gemini\\antigravity\\brain\\4d800ced-f873-4cd7-8153-11c2d2a6037c\\.system_generated\\tasks\\task-2066.log';
  const data2 = fs.readFileSync(file2, 'utf8');
  console.log("=== TASK 2066 LOG ===");
  console.log(data2.substring(Math.max(0, data2.length - 2000)));
} catch (e) {
  console.error(e);
}
