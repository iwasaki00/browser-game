const fs = require('node:fs');
const path = require('node:path');
const APP = path.resolve(__dirname, '..');
// The existing runtime constant remains the version source. No runtime loader.
const VERSION = fs.readFileSync(path.join(APP, 'app.js'), 'utf8').match(/const VERSION = "(\d+\.\d+\.\d+)";/)?.[1];
if (!VERSION) throw new Error('Missing application version');
const FILES = Object.freeze([
  'index.html', 'style.css', 'startup.js', 'poses.js', 'copy-brush.js', 'paint.js',
  'editor-view.js', 'export.js', 'app.js',
  'assets/kakureron.svg', 'assets/menu-icon.svg',
  'assets/poses/crouch.svg', 'assets/poses/spread.svg', 'assets/poses/lie.svg'
]);
module.exports = { APP, VERSION, FILES };
