// Type definitions for the UTOPAY Node.js client. https://utopay.app/docs
export interface PaymentParams {
  amount: number;
  currency: string;
  description?: string;
  email?: string;
  /** Pin a payment method: "stripe" (cards, Apple Pay), "paypal", "revolut", "transak" (UPI) … — see providers() */
  provider?: string;
  success_url?: string;
  cancel_url?: string;
  callback_url?: string;
  settlement?: 'direct' | 'custody';
}
export interface NoAccountPaymentParams extends PaymentParams {
  /** Polygon USDC address that receives the payout */
  payout_wallet: string;
}
export interface CryptoPaymentParams {
  /** Ticker from coins(), e.g. "bep20/usdt", "erc20/usdt", "polygon/usdt", "eth" */
  coin: string;
  amount?: number;
  currency?: string;
  /** Exact amount in the coin instead of amount + currency */
  amount_coin?: number;
  payout_address?: string;
  description?: string;
  email?: string;
  success_url?: string;
  cancel_url?: string;
  callback_url?: string;
}
export interface Order {
  id: string;
  status: 'pending' | 'paid' | 'underpaid' | 'expired' | 'failed' | string;
  is_test: boolean;
  amount: number;
  currency: string;
  checkout_url: string;
  payment_page_url: string;
  [key: string]: unknown;
}
export interface WebhookEvent {
  event: 'payment.succeeded' | 'payment.underpaid' | 'payment.expired' | 'payment.failed' | string;
  created_at: number;
  data: Order;
}
export class UtopayError extends Error {
  status: number;
  body: unknown;
}
export class Utopay {
  constructor(secretKey?: string, opts?: { baseUrl?: string; timeoutMs?: number });
  createPayment(params: PaymentParams): Promise<Order>;
  createPaymentNoAccount(params: NoAccountPaymentParams): Promise<Order>;
  getPayment(id: string): Promise<Order>;
  listPayments(opts?: { limit?: number; offset?: number; status?: string }): Promise<Order[]>;
  createCryptoPayment(params: CryptoPaymentParams): Promise<Order>;
  createCryptoPaymentNoAccount(params: CryptoPaymentParams & { payout_address: string }): Promise<Order>;
  coins(): Promise<{ fee: { total: number; note: string }; coins: Array<{ ticker: string; coin: string; symbol: string; network: string; minimum: number | null; available: boolean }> }>;
  providers(opts?: { amount?: number; currency?: string }): Promise<unknown>;
  currencies(): Promise<unknown>;
  static verifyWebhook(rawBody: string | Buffer, signatureHeader: string, webhookSecret: string, toleranceSec?: number): WebhookEvent;
}
