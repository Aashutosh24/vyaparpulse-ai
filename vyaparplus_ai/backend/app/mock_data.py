"""
A handful of representative SMS messages for exercising the parser and
matcher without a real Android device — genuine credit/debit messages
mixed with an OTP and a promo message that must both be ignored.

Timestamps are generated relative to `base_time` so a demo always lines up
with transactions created "just now" in the same test session.
"""

from datetime import datetime, timedelta


def get_mock_sms(base_time: datetime | None = None) -> list[dict]:
    base_time = base_time or datetime.utcnow()
    return [
        {
            "sms_id": "mock-1",
            "sender": "HDFCBK",
            "raw_sms": "Rs.50.00 credited to your a/c XXXX1234 on 01-01-26. Ref No 123456789.",
            "sms_timestamp": (base_time + timedelta(minutes=1)).isoformat(),
        },
        {
            "sms_id": "mock-2",
            "sender": "ICICIB",
            "raw_sms": "INR 20 debited from your account for UPI txn. UTR 987654321.",
            "sms_timestamp": (base_time + timedelta(minutes=2)).isoformat(),
        },
        {
            "sms_id": "mock-3",
            "sender": "VM-OTPSMS",
            "raw_sms": "123456 is your OTP for login. Do not share this with anyone.",
            "sms_timestamp": (base_time + timedelta(minutes=3)).isoformat(),
        },
        {
            "sms_id": "mock-4",
            "sender": "AD-PROMO",
            "raw_sms": "Big Sale now! Get 50% discount on your next order. Use code SAVE50.",
            "sms_timestamp": (base_time + timedelta(minutes=4)).isoformat(),
        },
        {
            "sms_id": "mock-5",
            "sender": "SBIBNK",
            "raw_sms": "Rs.25.00 credited to your account. Ref TXN55512.",
            "sms_timestamp": (base_time + timedelta(minutes=5)).isoformat(),
        },
    ]
