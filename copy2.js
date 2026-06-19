const fs = require('fs');
try {
  const src = 'C:/Users/misch/Downloads/remix_-mcp-maps-3d/map_app.ts';
  const dst = 'C:/Users/misch/.gemini/antigravity/scratch/proautomation-store/src/components/maps/map_app.ts';
  fs.mkdirSync('C:/Users/misch/.gemini/antigravity/scratch/proautomation-store/src/components/maps', {recursive: true});
  fs.writeFileSync(dst, fs.readFileSync(src));
  
  const cssSrc = 'C:/Users/misch/Downloads/remix_-mcp-maps-3d/index.css';
  const cssDst = 'C:/Users/misch/.gemini/antigravity/scratch/proautomation-store/src/components/maps/map_app.css';
  fs.writeFileSync(cssDst, fs.readFileSync(cssSrc));
  console.log('SUCCESS');
} catch(e) {
  console.error(e);
}
