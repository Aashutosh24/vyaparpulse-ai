"""
Central configuration.

Kept as plain constants (with env var overrides) instead of a full settings
framework, since this is a hackathon-scoped backend. Switching DATABASE_URL
to a Postgres URL later is the only change needed to move off SQLite.
"""
import os

# --- Database ---------------------------------------------------------------
# e.g. "postgresql://user:pass@host:5432/merchant_db" when migrating later.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./merchant.db")

# --- Matching ----------------------------------------------------------------
# How close (in seconds) a payment's timestamp must be to a transaction's
# created_at for it to be considered a match. 5 minutes each side by default.
MATCH_TIME_WINDOW_SECONDS = int(os.getenv("MATCH_TIME_WINDOW_SECONDS", 5 * 60))

# After this many minutes with no matching payment, a transaction is
# considered "stale" and worth notifying the merchant about.
PENDING_ALERT_AFTER_MINUTES = int(os.getenv("PENDING_ALERT_AFTER_MINUTES", 7))

# --- Merchant ------------------------------------------------------------
# Hackathon scope assumes a single merchant using the app. merchant_id is
# still modeled everywhere so multi-merchant support is a non-breaking
# addition later (just start passing a real merchant_id from auth).
DEFAULT_MERCHANT_ID = os.getenv("DEFAULT_MERCHANT_ID", "merchant_1")
