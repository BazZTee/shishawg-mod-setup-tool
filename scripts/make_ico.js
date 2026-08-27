const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const inputPng = path.join(__dirname, '../build/icon.png');
const outputIco = path.join(__dirname, '../build/icon.ico');

pngToIco(inputPng)
  .then(buf => {
    fs.writeFileSync(outputIco, buf);
    console.log('Successfully created build/icon.ico!');
  })
  .catch(err => {
    console.error('Error creating ico file:', err);
    process.exit(1);
  });
