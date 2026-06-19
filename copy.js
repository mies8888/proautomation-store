const fs = require('fs');
const path = require('path');
const srcDir = 'C:/Users/misch/Downloads/remix_-mcp-maps-3d';
const destDir = 'C:/Users/misch/.gemini/antigravity/scratch/proautomation-store/src/components/maps';
fs.mkdirSync(destDir, {recursive: true});
['map_app.ts', 'mcp_maps_server.ts', 'index.css'].forEach(file => {
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file === 'index.css' ? 'map_app.css' : file));
  console.log('Copied ' + file);
});
