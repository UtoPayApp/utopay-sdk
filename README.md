# UTOPAY SDK — payment gateway API for cards and crypto

Official API clients for **[UTOPAY](https://utopay.app)** — a payment gateway for high-risk and international businesses.
Accept **cards, Apple Pay, Google Pay, PayPal, Revolut** and **crypto (USDT, ETH, BNB and more)** and get paid straight to your own wallet.

| | |
|---|---|
| Card & wallet payments | 4.5% all-in, paid out in USDC on Polygon — [card gateway](https://utopay.app/gateway) |
| Crypto payments | 1.5% + network fee, forwarded on-chain to your wallet — [crypto gateway](https://utopay.app/crypto) |
| Without an account | `POST /v1/pay`, `POST /v1/crypto/pay` with just a wallet address |
| Webhooks | HMAC-SHA256 signed — verification helpers included |
| Docs | **[utopay.app/docs](https://utopay.app/docs)** · [API overview](https://utopay.app/payment-gateway-api) · [OpenAPI spec](openapi.yaml) |

## Clients

| Language | Folder | Dependencies |
|---|---|---|
| Node.js 18+ (TypeScript types included) | [`node/`](node) | none — uses built-in `fetch` |
| PHP 7.4+ | [`php/`](php) | `ext-curl`, `ext-json` |
| Python 3.8+ | [`python/`](python) | none — standard library only |

Each client is a single file: copy it into your project or install it from this repository.

## Quick start

### Node.js

```js
const { Utopay } = require('./node/utopay');
const utopay = new Utopay(process.env.UTOPAY_SK); // utopay_sk_live_… or utopay_sk_test_…

// Card / Apple Pay payment → USDC to your wallet
const order = await utopay.createPayment({ amount: 49.9, currency: 'EUR', description: 'Order #1042' });
console.log(order.checkout_url); // redirect the buyer here

// Crypto payment → straight to your wallet
const crypto = await utopay.createCryptoPayment({ coin: 'bep20/usdt', amount: 100, currency: 'USD' });
```

### PHP

```php
require 'php/src/Utopay.php';
$utopay = new \Utopay\Utopay(getenv('UTOPAY_SK'));
$order = $utopay->createPayment(['amount' => 49.90, 'currency' => 'EUR', 'description' => 'Order #1042']);
header('Location: ' . $order['checkout_url']);
```

### Python

```python
from utopay import Utopay
utopay = Utopay(os.environ["UTOPAY_SK"])
order = utopay.create_payment(amount=49.90, currency="EUR", description="Order #1042")
print(order["checkout_url"])
```

### No account at all

```js
const utopay = new Utopay(); // no key
const order = await utopay.createCryptoPaymentNoAccount({
  coin: 'polygon/usdt', amount: 25, currency: 'USD', payout_address: '0xYourWallet…',
});
```

## Webhooks

```js
// Express: use the RAW body
app.post('/hooks/utopay', express.raw({ type: 'application/json' }), (req, res) => {
  const event = Utopay.verifyWebhook(req.body, req.get('x-utopay-signature'), process.env.UTOPAY_WHSEC);
  if (event.event === 'payment.succeeded') { /* mark event.data.id as paid */ }
  res.sendStatus(200);
});
```

Events: `payment.succeeded`, `payment.underpaid`, `payment.expired`, `payment.failed`. See [webhooks](https://utopay.app/docs#webhooks).

## Examples

- [`examples/node-express-webhook.js`](examples/node-express-webhook.js) — create a payment and confirm it by webhook
- [`examples/telegram-bot.py`](examples/telegram-bot.py) — a Telegram bot that sells access for USDT or by card
- [`examples/php-checkout.php`](examples/php-checkout.php) — minimal PHP checkout + webhook

## No-code options

- **[Payment links](https://utopay.app/payment-links)** — share a link, get paid by card or Apple Pay
- **[CMS plugins](https://utopay.app/plugins)** — WooCommerce, WHMCS, OpenCart, PrestaShop, MODX, Easy Digital Downloads, Paid Memberships Pro, Tilda

## Links

- Website: **https://utopay.app**
- Documentation: https://utopay.app/docs
- Crypto gateway: https://utopay.app/crypto · Accept USDT: https://utopay.app/crypto/usdt
- High-risk merchants: https://utopay.app/high-risk-merchant-account
- Support: info@utopay.app · Telegram [@UtoPayApp](https://t.me/UtoPayApp)

---

**Русский.** Официальные клиенты API платёжного шлюза [UTOPAY](https://utopay.app/ru/) для Node.js, PHP и Python: приём карт, Apple Pay, PayPal и криптовалюты с выплатой на ваш кошелёк. Документация — [utopay.app/ru/docs](https://utopay.app/ru/docs).

License: MIT
