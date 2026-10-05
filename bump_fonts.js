const fs = require('fs');

function bumpFonts(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Bump simple pixel values (e.g., font-size: 12px)
  let newContent = content.replace(/font-size:\s*([0-9.]+)(px)/g, (match, p1, p2) => {
    let size = parseFloat(p1);
    if (size < 40) {
      size += 3; // Increase font size by 3px for readability
    }
    return `font-size: ${size}${p2}`;
  });

  // Bump clamped pixel values (e.g., font-size: clamp(24px, 4vw, 30px))
  // Just bump any px value inside a clamp for font-size.
  newContent = newContent.replace(/font-size:\s*clamp\(([^)]+)\)/g, (match, p1) => {
    let newClampArgs = p1.replace(/([0-9.]+)(px)/g, (m, px1) => {
        let size = parseFloat(px1);
        if (size < 60) size += 4;
        return `${size}px`;
    });
    return `font-size: clamp(${newClampArgs})`;
  });

  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Updated ${file}`);
  }
}

bumpFonts('index.html');
bumpFonts('room/index.html');
