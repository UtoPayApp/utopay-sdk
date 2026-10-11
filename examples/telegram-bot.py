"""Telegram bot that sells access for USDT or by card through UTOPAY.

pip install aiogram>=3  ·  BOT_TOKEN=… UTOPAY_SK=utopay_sk_test_… python telegram-bot.py
The bot sends a payment link; confirm payments with a webhook (see node-express-webhook.js)
or by polling get_payment() as shown here. Docs: https://utopay.app/docs
"""
import asyncio
import os
import sys

from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "python"))
from utopay import Utopay  # noqa: E402

PRICE_USD = 10
utopay = Utopay(os.environ["UTOPAY_SK"])
dp = Dispatcher()

menu = InlineKeyboardMarkup(inline_keyboard=[
    [InlineKeyboardButton(text=f"Pay ${PRICE_USD} in USDT (BEP-20)", callback_data="pay:crypto")],
    [InlineKeyboardButton(text=f"Pay ${PRICE_USD} by card / Apple Pay", callback_data="pay:card")],
])


@dp.message(CommandStart())
async def start(message: Message):
    await message.answer("Premium access — choose how to pay:", reply_markup=menu)


@dp.callback_query(F.data.startswith("pay:"))
async def pay(call: CallbackQuery):
    desc = f"Premium for tg:{call.from_user.id}"
    if call.data == "pay:crypto":
        order = utopay.create_crypto_payment(coin="bep20/usdt", amount=PRICE_USD, currency="USD", description=desc)
    else:
        order = utopay.create_payment(amount=PRICE_USD, currency="USD", description=desc)
    button = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="Open payment page", url=order["checkout_url"])]])
    await call.message.answer("Pay on the page below — I will confirm automatically.", reply_markup=button)
    await call.answer()
    asyncio.create_task(wait_paid(call.message, order["id"]))


async def wait_paid(message: Message, order_id: str):
    for _ in range(180):  # up to 30 minutes; prefer webhooks in production
        await asyncio.sleep(10)
        order = await asyncio.to_thread(utopay.get_payment, order_id)
        if order["status"] in ("paid", "underpaid"):
            await message.answer("✅ Payment received, premium is active!")
            return


async def main():
    await dp.start_polling(Bot(os.environ["BOT_TOKEN"]))


if __name__ == "__main__":
    asyncio.run(main())
