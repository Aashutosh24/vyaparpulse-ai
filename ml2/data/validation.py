"""
Layer A — Data validation and normalization.

Responsibilities (architecture doc section 5, Layer A):
  - schema validation
  - missing-value handling
  - type normalization
  - timestamp normalization
  - duplicate detection
  - impossible-value detection
  - merchant-level isolation

This module does not decide *whether* a transaction is paid — that is
Layer B (aggregation.py) and payment.schema.json's job. It only decides
whether a record is well-formed enough to enter the pipeline at all.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import jsonschema

SCHEMA_DIR = Path(__file__).resolve().parent.parent / "schemas"


def _load_schema(name: str) -> dict:
    with open(SCHEMA_DIR / name, "r", encoding="utf-8") as f:
        return json.load(f)


TRANSACTION_SCHEMA = _load_schema("transaction.schema.json")
PAYMENT_SCHEMA = _load_schema("payment.schema.json")


@dataclass
class ValidationResult:
    """Result of validating one batch of records."""
    valid: list[dict] = field(default_factory=list)
    rejected: list[dict] = field(default_factory=list)  # {"record": ..., "reason": ...}

    @property
    def valid_count(self) -> int:
        return len(self.valid)

    @property
    def rejected_count(self) -> int:
        return len(self.rejected)


def _normalize_timestamp(value: object) -> str | None:
    """Best-effort normalization to ISO-8601. Returns None if unparseable
    OR if it carries timezone info (see _is_timezone_aware)."""
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    if parsed.tzinfo is not None:
        return None  # rejected separately below with a distinct reason
    return value


def _is_timezone_aware(value: object) -> bool:
    """True if `value` parses as an ISO timestamp that carries a UTC
    offset/zone. The canonical contract (per section 24's own naive
    example) currently assumes naive local timestamps throughout; a
    tz-aware value mixed into the same batch as naive ones crashes
    pandas datetime parsing downstream, and silently stripping the
    offset risks shifting the wall-clock hour used by
    peak_hour_revenue_share. Rejected explicitly rather than guessed at
    -- see the Phase 1.5 reconciliation report, section E (Ambiguities)."""
    if not isinstance(value, str):
        return False
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).tzinfo is not None
    except (ValueError, TypeError):
        return False


def validate_transactions(records: list[dict]) -> ValidationResult:
    """
    Validate raw transaction records against transaction.schema.json,
    plus the business rules the JSON schema can't express on its own
    (duplicate transaction_id, merchant isolation bookkeeping).
    """
    result = ValidationResult()
    seen_ids: set[str] = set()

    for raw in records:
        record = dict(raw)  # never mutate caller's data

        # --- type/timestamp normalization before schema validation ---
        if "timestamp" in record:
            if _is_timezone_aware(record["timestamp"]):
                result.rejected.append({"record": raw, "reason": "timestamp_has_timezone_not_yet_supported"})
                continue
            normalized = _normalize_timestamp(record["timestamp"])
            if normalized is None:
                result.rejected.append({"record": raw, "reason": "invalid_timestamp"})
                continue
            record["timestamp"] = normalized

        # --- duplicate detection ---
        tx_id = record.get("transaction_id")
        if tx_id is not None and tx_id in seen_ids:
            result.rejected.append({"record": raw, "reason": "duplicate_transaction_id"})
            continue

        # --- schema validation (covers missing fields, impossible values
        #     like amount <= 0, wrong types, unknown extra fields) ---
        try:
            jsonschema.validate(instance=record, schema=TRANSACTION_SCHEMA)
        except jsonschema.ValidationError as exc:
            result.rejected.append({"record": raw, "reason": f"schema: {exc.message}"})
            continue

        seen_ids.add(tx_id)
        result.valid.append(record)

    return result


def validate_payments(records: list[dict]) -> ValidationResult:
    """Validate raw payment records against payment.schema.json."""
    result = ValidationResult()
    seen_ids: set[str] = set()

    for raw in records:
        record = dict(raw)

        if "timestamp" in record:
            if _is_timezone_aware(record["timestamp"]):
                result.rejected.append({"record": raw, "reason": "timestamp_has_timezone_not_yet_supported"})
                continue
            normalized = _normalize_timestamp(record["timestamp"])
            if normalized is None:
                result.rejected.append({"record": raw, "reason": "invalid_timestamp"})
                continue
            record["timestamp"] = normalized

        pay_id = record.get("payment_id")
        if pay_id is not None and pay_id in seen_ids:
            result.rejected.append({"record": raw, "reason": "duplicate_payment_id"})
            continue

        try:
            jsonschema.validate(instance=record, schema=PAYMENT_SCHEMA)
        except jsonschema.ValidationError as exc:
            result.rejected.append({"record": raw, "reason": f"schema: {exc.message}"})
            continue

        seen_ids.add(pay_id)
        result.valid.append(record)

    return result


def isolate_by_merchant(records: list[dict]) -> dict[str, list[dict]]:
    """
    Split a flat list of validated records into per-merchant buckets.
    This is the 'merchant-level isolation' requirement from section 5 —
    downstream code should never accidentally compute a feature that
    mixes two merchants' data.
    """
    by_merchant: dict[str, list[dict]] = {}
    for record in records:
        merchant_id = record["merchant_id"]
        by_merchant.setdefault(merchant_id, []).append(record)
    return by_merchant
