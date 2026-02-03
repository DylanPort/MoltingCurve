const data = require('./data/arena-data.json');

console.log('=== AGENT WALLETS ===');
console.log(`Total: ${data.agents.length} agents\n`);

data.agents.forEach(a => {
  const encrypted = typeof a.secret_key === 'object' && a.secret_key.iv;
  console.log(`${a.name}`);
  console.log(`  Wallet: ${a.wallet_address}`);
  console.log(`  Key: ${encrypted ? '🔒 ENCRYPTED' : '⚠️ PLAIN TEXT'}`);
  console.log('');
});
