const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'backend');
const target = path.join(__dirname, '..', 'frontend', '_backend');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.error('Backend folder not found:', src);
    process.exit(1);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

if (fs.existsSync(target)) {
  fs.rmSync(target, { recursive: true, force: true });
}
copyRecursive(source, target);
console.log('Copied backend to frontend/_backend for Vercel API.');
