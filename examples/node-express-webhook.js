// Express example: create a UTOPAY payment and confirm it by webhook.
// npm i express  ·  UTOPAY_SK=utopay_sk_test_… UTOPAY_WHSEC=whsec_… node node-express-webhook.js
// Docs: https://utopay.app/docs · More: https://utopay.app/crypto/accept-on-website
const express = require('express');
const { Utopay } = require('../node/utopay');

const utopay = new Utopay(process.env.UTOPAY_SK);
const app = express();
const paid = new Set(); // use your database in production

app.post('/checkout', express.json(), async (req, res) => {
  try {
    const order = await utopay.createPayment({
      amount: 49.9, currency: 'EUR', description: 'Pro plan',
      success_url: 'https://shop.example/thanks', cancel_url: 'https://shop.example/cart',
    });
    // or crypto: utopay.createCryptoPayment({ coin: 'bep20/usdt', amount: 49.9, currency: 'EUR' })
    res.json({ id: order.id, redirect: order.checkout_url });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// The RAW body is required for the signature check
app.post('/hooks/utopay', express.raw({ type: 'application/json' }), (req, res) => {
  let event;
  try {
    event = Utopay.verifyWebhook(req.body, req.get('x-utopay-signature'), process.env.UTOPAY_WHSEC);
  } catch {
    return res.sendStatus(400);
  }
  if (event.event === 'payment.succeeded' && !paid.has(event.data.id)) {
    paid.add(event.data.id); // idempotent: deliveries can repeat
    console.log('paid', event.data.id, event.data.amount, event.data.currency);
  }
  if (event.event === 'payment.underpaid') console.log('underpaid', event.data.id);
  res.sendStatus(200);
});

app.listen(3000, () => console.log('http://localhost:3000'));
