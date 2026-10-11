// UTOPAY API client for Node.js 18+ (no dependencies). https://utopay.app/docs
'use strict';
const crypto = require('node:crypto');

const DEFAULT_BASE = 'https://api.utopay.app';

class UtopayError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'UtopayError';
    this.status = status;
    this.body = body;
  }
}

class Utopay {
  /**
   * @param {string} [secretKey] utopay_sk_live_… / utopay_sk_test_… — not needed for the no-account endpoints
   * @param {{ baseUrl?: string, timeoutMs?: number }} [opts]
   */
  constructor(secretKey, opts = {}) {
    this.secretKey = secretKey || null;
    this.baseUrl = (opts.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs || 20000;
  }

  async request(method, path, body, { auth = true } = {}) {
    const headers = { accept: 'application/json' };
    if (body) headers['content-type'] = 'application/json';
    if (auth) {
      if (!this.secretKey) throw new UtopayError('secret key required for ' + path, 0, null);
      headers.authorization = 'Bearer ' + this.secretKey;
    }
    const res = await fetch(this.baseUrl + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { json = { error: text }; }
    if (!res.ok) throw new UtopayError((json && json.error) || 'HTTP ' + res.status, res.status, json);
    return json;
  }

  // ---- card and wallet payments (USDC to your wallet, 4.5% all-in) ----
  /** Create a payment. Fields: amount, currency, description, email, provider, success_url, cancel_url, callback_url, settlement */
  createPayment(params) { return this.request('POST', '/v1/payments', params); }
  /** Create a payment without an account: pass payout_wallet (Polygon USDC address). */
  createPaymentNoAccount(params) { return this.request('POST', '/v1/pay', params, { auth: false }); }
  getPayment(id) { return this.request('GET', '/v1/payments/' + encodeURIComponent(id)); }
  listPayments({ limit = 50, offset = 0, status } = {}) {
    const q = new URLSearchParams({ limit, offset, ...(status ? { status } : {}) });
    return this.request('GET', '/v1/payments?' + q);
  }

  // ---- crypto gateway (to your wallet, 1.5% + network fee) ----
  /** Create a crypto payment. Fields: coin (e.g. "bep20/usdt"), amount + currency or amount_coin, payout_address, description, success_url, cancel_url */
  createCryptoPayment(params) { return this.request('POST', '/v1/crypto/payments', params); }
  /** Crypto payment without an account: payout_address is required. */
  createCryptoPaymentNoAccount(params) { return this.request('POST', '/v1/crypto/pay', params, { auth: false }); }

  // ---- reference data (public) ----
  coins() { return this.request('GET', '/v1/crypto/coins', null, { auth: false }); }
  providers({ amount, currency } = {}) {
    const q = new URLSearchParams({ ...(amount ? { amount } : {}), ...(currency ? { currency } : {}) });
    return this.request('GET', '/v1/providers' + (String(q) ? '?' + q : ''), null, { auth: false });
  }
  currencies() { return this.request('GET', '/v1/currencies', null, { auth: false }); }

  /**
   * Verify an incoming webhook. Use the RAW request body (Buffer or string), not re-serialised JSON.
   * @returns {object} the parsed event { event, created_at, data }
   * @throws {UtopayError} when the signature is invalid or older than toleranceSec
   */
  static verifyWebhook(rawBody, signatureHeader, webhookSecret, toleranceSec = 300) {
    const parts = Object.fromEntries(String(signatureHeader || '').split(',').map((p) => p.split('=')));
    const t = parts.t, v1 = parts.v1 || '';
    const expected = crypto.createHmac('sha256', webhookSecret).update(`${t}.${rawBody}`).digest('hex');
    const fresh = /^\d+$/.test(t || '') && Math.abs(Date.now() / 1000 - Number(t)) < toleranceSec;
    const a = Buffer.from(v1), b = Buffer.from(expected);
    if (!fresh || a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new UtopayError('invalid webhook signature', 400, null);
    return JSON.parse(String(rawBody));
  }
}

module.exports = { Utopay, UtopayError };
