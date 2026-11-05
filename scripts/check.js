// Run syntax checks on every maintained JavaScript source file.
// This avoids forgetting new controller or module files in package.json.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const sourceDirectories = ['controllers', 'models', 'modules', 'public/js', 'scripts', 'tests'];
const files = ['server.js'];

function collect(directory) {
  const fullDirectory = path.join(projectRoot, directory);
  if (!fs.existsSync(fullDirectory)) return;
  for (const entry of fs.readdirSync(fullDirectory, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(relative);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(relative);
  }
}

sourceDirectories.forEach(collect);
for (const file of files) {
  execFileSync(process.execPath, ['--check', path.join(projectRoot, file)], { stdio: 'pipe' });
}
console.log(`Syntax checked ${files.length} JavaScript files.`);
