const { loadTvw } = require('../lib/fz.js');
const fs = require('fs');
const f = 'C:/Users/oswal/Desktop/fz/uploads/LENOVO Ideapad 310 15ISK NM-A752 R02-1111-1617.tvw';
try {
    const b = loadTvw(fs.readFileSync(f));
    console.log('OK: parts', b.parts && b.parts.length, 'pins', b.pins && b.pins.length,
        'nets', b.nets && b.nets.length, 'nails', b.nails && b.nails.length,
        'netPins', b.netPins && Object.keys(b.netPins).length);
    console.log('first part:', JSON.stringify(b.parts && b.parts[0]));
    console.log('first pin:', JSON.stringify(b.pins && b.pins[0]));
} catch (e) {
    console.log('ERROR:', e.message);
    console.log(e.stack.split('\n').slice(0, 4).join('\n'));
}