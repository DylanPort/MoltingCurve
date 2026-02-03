/**
 * Turnkey Secure Wallet Integration
 * 
 * MPC wallet provider - private keys NEVER exist in one place
 * Even server admins cannot extract the full key
 * 
 * Setup:
 * 1. Create account at https://app.turnkey.com
 * 2. Create an organization
 * 3. Create an API key
 * 4. Set environment variables:
 *    - TURNKEY_ORGANIZATION_ID
 *    - TURNKEY_API_PUBLIC_KEY
 *    - TURNKEY_API_PRIVATE_KEY
 */

const TURNKEY_BASE_URL = 'https://api.turnkey.com';

// Check if Turnkey is configured
export function isTurnkeyConfigured() {
  return !!(
    process.env.TURNKEY_ORGANIZATION_ID &&
    process.env.TURNKEY_API_PUBLIC_KEY &&
    process.env.TURNKEY_API_PRIVATE_KEY
  );
}

// Turnkey API client
class TurnkeyClient {
  constructor() {
    this.organizationId = process.env.TURNKEY_ORGANIZATION_ID;
    this.apiPublicKey = process.env.TURNKEY_API_PUBLIC_KEY;
    this.apiPrivateKey = process.env.TURNKEY_API_PRIVATE_KEY;
  }

  async request(endpoint, body) {
    const crypto = await import('crypto');
    const fetch = (await import('node-fetch')).default;
    
    const timestamp = Date.now().toString();
    const payload = JSON.stringify(body);
    
    // Create signature (simplified - in production use @turnkey/http)
    const message = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', this.apiPrivateKey)
      .update(message)
      .digest('hex');

    const response = await fetch(`${TURNKEY_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Stamp-WebAuthn': JSON.stringify({
          publicKey: this.apiPublicKey,
          signature,
          timestamp,
        }),
      },
      body: payload,
    });

    return response.json();
  }

  // Create a new wallet for an agent
  async createWallet(agentName) {
    try {
      const result = await this.request('/public/v1/submit/create_wallet', {
        type: 'ACTIVITY_TYPE_CREATE_WALLET',
        organizationId: this.organizationId,
        timestampMs: Date.now().toString(),
        parameters: {
          walletName: `arena-agent-${agentName}-${Date.now()}`,
          accounts: [
            {
              curve: 'CURVE_ED25519',
              pathFormat: 'PATH_FORMAT_BIP32',
              path: "m/44'/501'/0'/0'",
              addressFormat: 'ADDRESS_FORMAT_SOLANA',
            },
          ],
        },
      });

      if (result.activity?.result?.createWalletResult) {
        const wallet = result.activity.result.createWalletResult;
        return {
          success: true,
          walletId: wallet.walletId,
          addresses: wallet.addresses,
          publicKey: wallet.addresses?.[0]?.address,
        };
      }

      return { success: false, error: result.error || 'Unknown error' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Sign a Solana transaction
  async signTransaction(walletId, unsignedTransaction) {
    try {
      const result = await this.request('/public/v1/submit/sign_transaction', {
        type: 'ACTIVITY_TYPE_SIGN_TRANSACTION',
        organizationId: this.organizationId,
        timestampMs: Date.now().toString(),
        parameters: {
          signWith: walletId,
          unsignedTransaction,
          type: 'TRANSACTION_TYPE_SOLANA',
        },
      });

      if (result.activity?.result?.signTransactionResult) {
        return {
          success: true,
          signedTransaction: result.activity.result.signTransactionResult.signedTransaction,
        };
      }

      return { success: false, error: result.error || 'Signing failed' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Sign raw payload (for custom operations)
  async signRawPayload(walletId, payload, encoding = 'PAYLOAD_ENCODING_HEXADECIMAL') {
    try {
      const result = await this.request('/public/v1/submit/sign_raw_payload', {
        type: 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD',
        organizationId: this.organizationId,
        timestampMs: Date.now().toString(),
        parameters: {
          signWith: walletId,
          payload,
          encoding,
          hashFunction: 'HASH_FUNCTION_NOT_APPLICABLE',
        },
      });

      if (result.activity?.result?.signRawPayloadResult) {
        return {
          success: true,
          signature: result.activity.result.signRawPayloadResult.signature,
        };
      }

      return { success: false, error: result.error || 'Signing failed' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Get wallet info
  async getWallet(walletId) {
    try {
      const result = await this.request('/public/v1/query/get_wallet', {
        organizationId: this.organizationId,
        walletId,
      });

      return result.wallet || null;
    } catch (e) {
      return null;
    }
  }
}

// Singleton instance
let turnkeyClient = null;

export function getTurnkeyClient() {
  if (!turnkeyClient && isTurnkeyConfigured()) {
    turnkeyClient = new TurnkeyClient();
  }
  return turnkeyClient;
}

// Helper: Create wallet for agent
export async function createSecureWallet(agentName) {
  const client = getTurnkeyClient();
  if (!client) {
    return { success: false, error: 'Turnkey not configured' };
  }
  return client.createWallet(agentName);
}

// Helper: Sign transaction
export async function signTransaction(walletId, unsignedTx) {
  const client = getTurnkeyClient();
  if (!client) {
    return { success: false, error: 'Turnkey not configured' };
  }
  return client.signTransaction(walletId, unsignedTx);
}

export default {
  isTurnkeyConfigured,
  getTurnkeyClient,
  createSecureWallet,
  signTransaction,
};
