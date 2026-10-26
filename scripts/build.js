// Inline src/ css and js into one self-contained page: dist/index.html (no dependencies).
// Run: npm run build
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const DIST = path.join(__dirname, '..', 'dist');
const read = file => fs.readFileSync(path.join(SRC, file), 'utf8').trimEnd();

let html = read('index.html');

// Function replacers so "$" in the code is never treated as a replacement pattern.
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g,
  (tag, file) => '<style>\n' + read(file) + '\n  </style>');
html = html.replace(/<script src="([^"]+)"><\/script>/g,
  (tag, file) => '<script>\n' + read(file).replace(/<\/script/gi, '<\\/script') + '\n  </script>');

if (/<script src=|<link rel="stylesheet"/.test(html)) throw new Error('build: external css/js left in output');

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), html + '\n');
console.log('built dist/index.html (' + Buffer.byteLength(html) + ' bytes)');
