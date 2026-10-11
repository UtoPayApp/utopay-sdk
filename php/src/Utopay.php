<?php
// UTOPAY API client for PHP 7.4+ (ext-curl, ext-json). https://utopay.app/docs

namespace Utopay;

class UtopayException extends \RuntimeException
{
    /** @var mixed */
    public $body;

    public function __construct(string $message, int $status = 0, $body = null)
    {
        parent::__construct($message, $status);
        $this->body = $body;
    }
}

class Utopay
{
    const DEFAULT_BASE = 'https://api.utopay.app';

    private $secretKey;
    private $baseUrl;
    private $timeout;

    /** @param string|null $secretKey utopay_sk_live_… / utopay_sk_test_… — not needed for the no-account endpoints */
    public function __construct(?string $secretKey = null, string $baseUrl = self::DEFAULT_BASE, int $timeout = 20)
    {
        $this->secretKey = $secretKey;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->timeout = $timeout;
    }

    public function request(string $method, string $path, ?array $body = null, bool $auth = true): array
    {
        $headers = ['Accept: application/json'];
        if ($body !== null) $headers[] = 'Content-Type: application/json';
        if ($auth) {
            if (!$this->secretKey) throw new UtopayException('secret key required for ' . $path);
            $headers[] = 'Authorization: Bearer ' . $this->secretKey;
        }
        $ch = curl_init($this->baseUrl . $path);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => $this->timeout,
        ]);
        if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        $raw = curl_exec($ch);
        if ($raw === false) {
            $err = curl_error($ch);
            curl_close($ch);
            throw new UtopayException('network error: ' . $err);
        }
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        $json = json_decode($raw, true);
        if (!is_array($json)) $json = ['error' => $raw];
        if ($status >= 400) throw new UtopayException($json['error'] ?? ('HTTP ' . $status), $status, $json);
        return $json;
    }

    // ---- card and wallet payments (USDC to your wallet, 4.5% all-in) ----
    public function createPayment(array $params): array { return $this->request('POST', '/v1/payments', $params); }
    /** Without an account: pass payout_wallet (Polygon USDC address). */
    public function createPaymentNoAccount(array $params): array { return $this->request('POST', '/v1/pay', $params, false); }
    public function getPayment(string $id): array { return $this->request('GET', '/v1/payments/' . rawurlencode($id)); }
    public function listPayments(int $limit = 50, int $offset = 0, ?string $status = null): array
    {
        $q = http_build_query(array_filter(['limit' => $limit, 'offset' => $offset, 'status' => $status], function ($v) { return $v !== null; }));
        return $this->request('GET', '/v1/payments?' . $q);
    }

    // ---- crypto gateway (to your wallet, 1.5% + network fee) ----
    public function createCryptoPayment(array $params): array { return $this->request('POST', '/v1/crypto/payments', $params); }
    /** Without an account: payout_address is required. */
    public function createCryptoPaymentNoAccount(array $params): array { return $this->request('POST', '/v1/crypto/pay', $params, false); }

    // ---- reference data (public) ----
    public function coins(): array { return $this->request('GET', '/v1/crypto/coins', null, false); }
    public function providers(?float $amount = null, ?string $currency = null): array
    {
        $q = http_build_query(array_filter(['amount' => $amount, 'currency' => $currency], function ($v) { return $v !== null; }));
        return $this->request('GET', '/v1/providers' . ($q ? '?' . $q : ''), null, false);
    }
    public function currencies(): array { return $this->request('GET', '/v1/currencies', null, false); }

    /**
     * Verify an incoming webhook. Pass the RAW body: file_get_contents('php://input').
     * @return array the event ['event' => …, 'created_at' => …, 'data' => order]
     */
    public static function verifyWebhook(string $rawBody, string $signatureHeader, string $webhookSecret, int $toleranceSec = 300): array
    {
        parse_str(str_replace(',', '&', $signatureHeader), $sig);
        $t = $sig['t'] ?? '';
        $expected = hash_hmac('sha256', $t . '.' . $rawBody, $webhookSecret);
        if (!ctype_digit((string) $t) || abs(time() - (int) $t) > $toleranceSec || !hash_equals($expected, $sig['v1'] ?? '')) {
            throw new UtopayException('invalid webhook signature', 400);
        }
        return json_decode($rawBody, true);
    }
}
