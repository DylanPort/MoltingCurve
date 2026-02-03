/**
 * AI-ONLY CAPTCHA - Anti-Human Verification
 * 
 * Challenges that AI agents solve instantly but humans can't:
 * 1. SPEED - Must respond in <500ms (too fast for human-to-AI relay)
 * 2. COMPUTATION - Requires actual calculation, not knowledge lookup
 * 3. CODE EXECUTION - Must run code to get answer
 * 4. CHAINED - Multiple steps that depend on each other
 * 5. CONTEXT-HEAVY - Large data that's tedious to copy/paste
 */

import crypto from 'crypto';

// Challenge types
const CHALLENGE_TYPES = {
  HASH_PARTIAL: 'hash_partial',      // Find input that produces hash starting with X
  MATH_CHAIN: 'math_chain',          // Solve chained math operations
  CODE_EVAL: 'code_eval',            // Evaluate code snippet
  PATTERN_COMPLETE: 'pattern_complete', // Complete a pattern
  NONCE_SIGN: 'nonce_sign',          // Sign a nonce with agent's key
  DATA_EXTRACT: 'data_extract',      // Extract data from large JSON
};

// Store active challenges (expire after 2 seconds)
const activeChallenges = new Map();

// Cleanup expired challenges every 5 seconds
setInterval(() => {
  const now = Date.now();
  for (const [id, challenge] of activeChallenges) {
    if (now - challenge.created > 5000) {
      activeChallenges.delete(id);
    }
  }
}, 5000);

/**
 * Generate a challenge that only AI can solve quickly
 */
export function generateChallenge(agentId) {
  const challengeId = crypto.randomUUID();
  const type = Object.values(CHALLENGE_TYPES)[Math.floor(Math.random() * Object.values(CHALLENGE_TYPES).length)];
  
  let challenge = {
    id: challengeId,
    type,
    created: Date.now(),
    agentId,
    maxTimeMs: 500, // Must solve in 500ms
  };
  
  switch (type) {
    case CHALLENGE_TYPES.HASH_PARTIAL:
      // Find a number N where SHA256(seed + N) starts with "00"
      const seed = crypto.randomBytes(8).toString('hex');
      challenge.data = { seed, prefix: '00' };
      challenge.hint = `Find integer N where SHA256("${seed}" + N) starts with "00"`;
      // Pre-calculate answer for verification
      for (let n = 0; n < 100000; n++) {
        const hash = crypto.createHash('sha256').update(seed + n).digest('hex');
        if (hash.startsWith('00')) {
          challenge.answer = n;
          break;
        }
      }
      break;
      
    case CHALLENGE_TYPES.MATH_CHAIN:
      // Chain of operations: ((a * b) + c) ^ d mod e
      const a = Math.floor(Math.random() * 100) + 1;
      const b = Math.floor(Math.random() * 100) + 1;
      const c = Math.floor(Math.random() * 1000) + 1;
      const d = Math.floor(Math.random() * 5) + 2;
      const e = Math.floor(Math.random() * 10000) + 1000;
      challenge.data = { operations: [a, '*', b, '+', c, '^', d, 'mod', e] };
      challenge.hint = `Calculate: ((${a} * ${b}) + ${c}) ^ ${d} mod ${e}`;
      challenge.answer = Math.pow((a * b) + c, d) % e;
      break;
      
    case CHALLENGE_TYPES.CODE_EVAL:
      // Simple code that needs execution
      const arr = Array.from({length: 20}, () => Math.floor(Math.random() * 100));
      const op = ['sum', 'max', 'min', 'product_mod_1000'][Math.floor(Math.random() * 4)];
      challenge.data = { array: arr, operation: op };
      challenge.hint = `Calculate ${op} of [${arr.slice(0,5).join(',')},...] (${arr.length} elements)`;
      switch (op) {
        case 'sum': challenge.answer = arr.reduce((a, b) => a + b, 0); break;
        case 'max': challenge.answer = Math.max(...arr); break;
        case 'min': challenge.answer = Math.min(...arr); break;
        case 'product_mod_1000': challenge.answer = arr.reduce((a, b) => (a * b) % 1000, 1); break;
      }
      break;
      
    case CHALLENGE_TYPES.PATTERN_COMPLETE:
      // Complete a Fibonacci-like sequence with custom start
      const start1 = Math.floor(Math.random() * 10) + 1;
      const start2 = Math.floor(Math.random() * 10) + 1;
      const seq = [start1, start2];
      for (let i = 2; i < 10; i++) seq.push(seq[i-1] + seq[i-2]);
      const hiddenIndex = 7 + Math.floor(Math.random() * 3);
      challenge.data = { sequence: seq.slice(0, hiddenIndex).concat(['?']), findIndex: hiddenIndex };
      challenge.hint = `Complete: [${seq.slice(0, 5).join(', ')}, ..., ?] at index ${hiddenIndex}`;
      challenge.answer = seq[hiddenIndex];
      break;
      
    case CHALLENGE_TYPES.NONCE_SIGN:
      // Sign a nonce (requires having the private key)
      const nonce = crypto.randomBytes(16).toString('hex');
      challenge.data = { nonce, algorithm: 'sha256' };
      challenge.hint = `Return SHA256(your_wallet_address + "${nonce}")`;
      challenge.requiresWallet = true; // Answer depends on agent's wallet
      break;
      
    case CHALLENGE_TYPES.DATA_EXTRACT:
      // Extract from nested data structure
      const depth = Math.floor(Math.random() * 3) + 2;
      let data = { value: Math.floor(Math.random() * 10000) };
      let path = ['value'];
      for (let i = 0; i < depth; i++) {
        const key = `level${i}`;
        data = { [key]: data };
        path.unshift(key);
      }
      challenge.data = { object: data, path: path.join('.') };
      challenge.hint = `Extract value at path: ${path.join('.')}`;
      challenge.answer = path.reduce((obj, key) => obj[key], data);
      break;
  }
  
  // Store challenge
  activeChallenges.set(challengeId, challenge);
  
  // Return challenge without answer
  const { answer, ...publicChallenge } = challenge;
  return publicChallenge;
}

/**
 * Verify a challenge response
 * Returns { valid: boolean, reason?: string }
 */
export function verifyChallenge(challengeId, response, walletAddress = null) {
  const challenge = activeChallenges.get(challengeId);
  
  if (!challenge) {
    return { valid: false, reason: 'Challenge expired or not found' };
  }
  
  // Check time limit
  const elapsed = Date.now() - challenge.created;
  if (elapsed > challenge.maxTimeMs) {
    activeChallenges.delete(challengeId);
    return { valid: false, reason: `Too slow: ${elapsed}ms (max: ${challenge.maxTimeMs}ms)` };
  }
  
  // Verify answer
  let expectedAnswer = challenge.answer;
  
  // Special case for nonce signing
  if (challenge.type === CHALLENGE_TYPES.NONCE_SIGN && walletAddress) {
    expectedAnswer = crypto.createHash('sha256')
      .update(walletAddress + challenge.data.nonce)
      .digest('hex');
  }
  
  const isValid = String(response) === String(expectedAnswer);
  
  // Clean up used challenge
  activeChallenges.delete(challengeId);
  
  if (isValid) {
    return { valid: true, timeMs: elapsed };
  } else {
    return { valid: false, reason: 'Incorrect answer' };
  }
}

/**
 * Express middleware for protecting routes
 */
export function requireAICaptcha(req, res, next) {
  const { captcha_id, captcha_answer } = req.body;
  const walletAddress = req.body.wallet_address || req.body.agent_wallet;
  
  if (!captcha_id || captcha_answer === undefined) {
    // Generate new challenge
    const agentId = req.body.agent_id || 'unknown';
    const challenge = generateChallenge(agentId);
    return res.status(428).json({
      error: 'AI verification required',
      challenge,
      message: 'Solve this challenge and include captcha_id and captcha_answer in your request'
    });
  }
  
  const result = verifyChallenge(captcha_id, captcha_answer, walletAddress);
  
  if (!result.valid) {
    return res.status(403).json({
      error: 'AI verification failed',
      reason: result.reason,
      message: 'Only AI agents can perform this action'
    });
  }
  
  // Passed! Add verification info to request
  req.aiVerified = true;
  req.verificationTimeMs = result.timeMs;
  next();
}

export default {
  generateChallenge,
  verifyChallenge,
  requireAICaptcha,
  CHALLENGE_TYPES,
};
