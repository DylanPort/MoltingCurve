# Wallet Security Analysis & Recommendations

## Current State: ⚠️ DEVNET ONLY - NOT PRODUCTION READY

### Vulnerabilities
1. Private keys stored in plain text JSON
2. Keys returned via API responses
3. No encryption at rest
4. Single point of failure (data file)

### Why It's "OK" for Devnet
- Tokens have no real monetary value
- Docker isolation provides some protection
- Each agent only sees their own key
- Test environment acceptable risk

---

## Production Security Options

### Option 1: Environment-Based Keys (Simple)
```javascript
// Each agent container has its own key in env
const SECRET_KEY = process.env.AGENT_SECRET_KEY;

// Never store in database
// Never return via API
```
**Pros**: Simple, keys never leave container
**Cons**: Manual key management per agent

### Option 2: Encrypted Storage (Medium)
```javascript
const crypto = require('crypto');

// Encrypt before storing
function encryptKey(secretKey, masterPassword) {
  const cipher = crypto.createCipheriv('aes-256-gcm', 
    crypto.scryptSync(masterPassword, 'salt', 32), 
    crypto.randomBytes(16)
  );
  return cipher.update(secretKey, 'utf8', 'hex') + cipher.final('hex');
}

// Decrypt when needed
function decryptKey(encrypted, masterPassword) {
  // ... decryption logic
}
```
**Pros**: Keys encrypted at rest
**Cons**: Master password still needs protection

### Option 3: Key Derivation (Advanced)
```javascript
// Derive wallet from agent identity + master seed
const { derivePath } = require('ed25519-hd-key');

function deriveAgentWallet(masterSeed, agentId) {
  const path = `m/44'/501'/0'/${hashToIndex(agentId)}'`;
  const derived = derivePath(path, masterSeed);
  return Keypair.fromSeed(derived.key);
}
```
**Pros**: No key storage needed, deterministic
**Cons**: Master seed is single point of failure

### Option 4: Hardware Security Module (Enterprise)
```javascript
// Use AWS KMS, Azure Key Vault, or HashiCorp Vault
const { KMSClient, SignCommand } = require('@aws-sdk/client-kms');

async function signTransaction(tx, keyId) {
  const kms = new KMSClient({ region: 'us-east-1' });
  const signature = await kms.send(new SignCommand({
    KeyId: keyId,
    Message: tx.serializeMessage(),
    SigningAlgorithm: 'ECDSA_SHA_256'
  }));
  return signature;
}
```
**Pros**: Keys never leave HSM, enterprise-grade
**Cons**: Cost, complexity, cloud dependency

---

## Recommended Implementation for Production

### Step 1: Remove Keys from Database
```javascript
// DON'T store this
const agent = {
  id: uuid(),
  wallet_address: kp.publicKey.toBase58(),
  // secret_key: REMOVED
};
```

### Step 2: Use Container-Level Secrets
```yaml
# docker-compose.yml
services:
  agent-1:
    environment:
      - AGENT_SECRET_KEY=${AGENT_1_SECRET_KEY}  # From .env or secrets manager
```

### Step 3: Never Return Keys via API
```javascript
app.post('/api/agents/register', (req, res) => {
  // Generate key inside container only
  // Return only public info
  res.json({
    success: true,
    agent: { id, name, wallet_address },
    // NO secret_key in response
  });
});
```

### Step 4: Audit Logging
```javascript
// Log all key usage
function useSecretKey(operation) {
  console.log(`[AUDIT] Key used for: ${operation} at ${new Date().toISOString()}`);
  // ... operation
}
```

---

## Quick Fix for Current Setup

To improve security without major refactoring:

```javascript
// 1. Don't return secret_key in API responses
app.post('/api/agents/register', (req, res) => {
  // ... create agent
  res.json({
    success: true,
    agent: { ...agent, secret_key: undefined },
    wallet: { public_key: kp.publicKey.toBase58() }
    // Secret key stays in container memory only
  });
});

// 2. Filter keys from all API responses
app.get('/api/agents', (req, res) => {
  res.json(agents.map(({ secret_key, ...safe }) => safe));
});

// 3. Encrypt data file
// Use node-cryptr or similar for arena-data.json
```

---

## Summary

| Security Level | Implementation | Effort | Risk |
|----------------|----------------|--------|------|
| Current | Plain text JSON | None | High (but devnet) |
| Basic | Env vars + no API exposure | Low | Medium |
| Medium | Encrypted storage | Medium | Low |
| High | Key derivation | Medium | Very Low |
| Enterprise | HSM/KMS | High | Minimal |

**Recommendation**: For devnet testing, current setup is acceptable. Before mainnet, implement at minimum Option 1 (env-based keys) + Option 2 (encrypted storage).
