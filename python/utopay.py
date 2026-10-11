"""UTOPAY API client for Python 3.8+ (standard library only). https://utopay.app/docs"""
import hashlib
import hmac
import json
import time
import urllib.error
import urllib.parse
import urllib.request

__all__ = ["Utopay", "UtopayError"]
__version__ = "1.0.0"
DEFAULT_BASE = "https://api.utopay.app"


class UtopayError(Exception):
    def __init__(self, message, status=0, body=None):
        super().__init__(message)
        self.status = status
        self.body = body


class Utopay:
    def __init__(self, secret_key=None, base_url=DEFAULT_BASE, timeout=20):
        """secret_key: utopay_sk_live_… / utopay_sk_test_… — not needed for the no-account endpoints."""
        self.secret_key = secret_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def request(self, method, path, body=None, auth=True):
        headers = {"Accept": "application/json", "User-Agent": "utopay-python/" + __version__}
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode()
        if auth:
            if not self.secret_key:
                raise UtopayError("secret key required for " + path)
            headers["Authorization"] = "Bearer " + self.secret_key
        req = urllib.request.Request(self.base_url + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:
                raw = res.read().decode()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raw = e.read().decode()
            try:
                payload = json.loads(raw)
            except ValueError:
                payload = {"error": raw}
            raise UtopayError(payload.get("error") or "HTTP %d" % e.code, e.code, payload) from None

    # ---- card and wallet payments (USDC to your wallet, 4.5% all-in) ----
    def create_payment(self, **params):
        return self.request("POST", "/v1/payments", params)

    def create_payment_no_account(self, **params):
        """Without an account: pass payout_wallet (Polygon USDC address)."""
        return self.request("POST", "/v1/pay", params, auth=False)

    def get_payment(self, payment_id):
        return self.request("GET", "/v1/payments/" + urllib.parse.quote(payment_id))

    def list_payments(self, limit=50, offset=0, status=None):
        q = {"limit": limit, "offset": offset}
        if status:
            q["status"] = status
        return self.request("GET", "/v1/payments?" + urllib.parse.urlencode(q))

    # ---- crypto gateway (to your wallet, 1.5% + network fee) ----
    def create_crypto_payment(self, **params):
        return self.request("POST", "/v1/crypto/payments", params)

    def create_crypto_payment_no_account(self, **params):
        """Without an account: payout_address is required."""
        return self.request("POST", "/v1/crypto/pay", params, auth=False)

    # ---- reference data (public) ----
    def coins(self):
        return self.request("GET", "/v1/crypto/coins", auth=False)

    def providers(self, amount=None, currency=None):
        q = {k: v for k, v in {"amount": amount, "currency": currency}.items() if v is not None}
        return self.request("GET", "/v1/providers" + ("?" + urllib.parse.urlencode(q) if q else ""), auth=False)

    def currencies(self):
        return self.request("GET", "/v1/currencies", auth=False)

    @staticmethod
    def verify_webhook(raw_body, signature_header, webhook_secret, tolerance_sec=300):
        """Verify an incoming webhook (pass the RAW body as bytes) and return the parsed event."""
        if isinstance(raw_body, str):
            raw_body = raw_body.encode()
        parts = dict(p.split("=", 1) for p in (signature_header or "").split(",") if "=" in p)
        t, v1 = parts.get("t", ""), parts.get("v1", "")
        expected = hmac.new(webhook_secret.encode(), t.encode() + b"." + raw_body, hashlib.sha256).hexdigest()
        if not (t.isdigit() and abs(time.time() - int(t)) < tolerance_sec and hmac.compare_digest(expected, v1)):
            raise UtopayError("invalid webhook signature", 400)
        return json.loads(raw_body)
