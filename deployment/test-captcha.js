const http = require('http');
const crypto = require('crypto');

function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method: opts.method || 'GET',
      headers: opts.headers || {}
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } 
        catch(e) { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function test() {
  console.log('\n=== AI CAPTCHA INTEGRATION TEST ===\n');
  
  // 1. Get challenge
  console.log('1. Requesting challenge...');
  const challenge = await fetch('http://localhost:3002/api/captcha/challenge?agent_id=test');
  console.log('   Challenge received:', JSON.stringify(challenge.challenge));
  
  const { id, type, problem } = challenge.challenge;
  let answer;
  
  // 2. Solve it (like an AI would)
  const start = Date.now();
  
  if (type === 'math') {
    const m = problem.match(/\(\((\d+) \* (\d+)\) \+ (\d+)\) % (\d+)/);
    if (m) answer = ((parseInt(m[1]) * parseInt(m[2])) + parseInt(m[3])) % parseInt(m[4]);
  } else if (type === 'hash') {
    const m = problem.match(/SHA256\("([^"]+)"\)/);
    if (m) answer = crypto.createHash('sha256').update(m[1]).digest('hex').slice(0, 8);
  } else if (type === 'array') {
    const m = problem.match(/(sum|max|min)\(\[([^\]]+)\]\)/);
    if (m) {
      const arr = m[2].split(',').map(Number);
      if (m[1] === 'sum') answer = arr.reduce((a,b) => a+b, 0);
      else if (m[1] === 'max') answer = Math.max(...arr);
      else answer = Math.min(...arr);
    }
  } else if (type === 'pattern') {
    const m = problem.match(/sequence: ([\d, ]+), \?/);
    if (m) {
      const nums = m[1].split(', ').map(Number);
      const mult = nums[1] / nums[0];
      answer = nums[nums.length - 1] * mult;
    }
  }
  
  const solveTime = Date.now() - start;
  console.log('2. Solved in', solveTime, 'ms');
  console.log('   Type:', type);
  console.log('   Problem:', problem);
  console.log('   Answer:', answer);
  
  // 3. Verify
  console.log('3. Verifying...');
  const result = await fetch('http://localhost:3002/api/captcha/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ captcha_id: id, captcha_answer: answer })
  });
  
  console.log('   Result:', JSON.stringify(result));
  
  if (result.valid) {
    console.log('\n✅ SUCCESS! AI CAPTCHA IS WORKING!');
    console.log('   - Challenge generated: YES');
    console.log('   - AI solved it in:', solveTime, 'ms');
    console.log('   - Verification passed: YES');
    console.log('   - Time recorded:', result.timeMs, 'ms');
  } else {
    console.log('\n❌ FAILED:', result.reason);
  }
  
  // 4. Test that humans get blocked
  console.log('\n4. Testing human block (no captcha)...');
  const blocked = await fetch('http://localhost:3002/api/trades', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: 'human-test', token_id: 'test', trade_type: 'buy', sol_amount: 0.1 })
  });
  
  if (blocked.error === 'AI verification required') {
    console.log('   ✅ Humans correctly blocked!');
    console.log('   Message:', blocked.message);
  } else {
    console.log('   ❌ Human block not working:', blocked);
  }
  
  console.log('\n=== TEST COMPLETE ===\n');
}

test().catch(console.error);
