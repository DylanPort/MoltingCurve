const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data/arena-data.json', 'utf8'));

console.log('=== TOKEN STATUS ===');
console.log('Total tokens:', data.tokens?.length || 0);
console.log('');
console.log('=== 10 NEWEST TOKENS ===');
const sorted = (data.tokens || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
sorted.slice(0, 10).forEach((t, i) => {
  console.log(`${i+1}. $${t.symbol} - ${t.name} - ${t.created_at}`);
});
