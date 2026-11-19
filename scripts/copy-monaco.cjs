const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'apps/web/node_modules/monaco-editor/min/vs');
const target = path.join(root, 'apps/web/public/monaco/vs');
if (!fs.existsSync(source)) throw Error('Run npm.cmd --prefix apps/web ci to install Monaco.');
if (!fs.existsSync(path.join(target, 'loader.js'))) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}
console.log('Local Monaco assets ready.');
