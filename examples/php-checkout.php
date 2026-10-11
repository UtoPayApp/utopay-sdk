<?php
// Minimal PHP checkout + webhook with the UTOPAY client. Docs: https://utopay.app/docs
// Run: UTOPAY_SK=utopay_sk_test_… UTOPAY_WHSEC=whsec_… php -S localhost:8000 php-checkout.php
require __DIR__ . '/../php/src/Utopay.php';

use Utopay\Utopay;
use Utopay\UtopayException;

$utopay = new Utopay(getenv('UTOPAY_SK'));
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if ($path === '/hooks/utopay') {
    try {
        $event = Utopay::verifyWebhook(file_get_contents('php://input'), $_SERVER['HTTP_X_UTOPAY_SIGNATURE'] ?? '', getenv('UTOPAY_WHSEC'));
    } catch (UtopayException $e) {
        http_response_code(400);
        exit;
    }
    if ($event['event'] === 'payment.succeeded') {
        error_log('paid ' . $event['data']['id']); // mark the order as paid (idempotently)
    }
    http_response_code(200);
    exit;
}

if ($path === '/pay') {
    $coin = $_GET['coin'] ?? null; // e.g. ?coin=bep20/usdt for crypto
    $params = ['amount' => 19.99, 'currency' => 'USD', 'description' => 'Order #' . time()];
    $order = $coin ? $utopay->createCryptoPayment($params + ['coin' => $coin]) : $utopay->createPayment($params);
    header('Location: ' . $order['checkout_url']);
    exit;
}

echo '<a href="/pay">Pay by card / Apple Pay</a> · <a href="/pay?coin=bep20/usdt">Pay in USDT</a>';
