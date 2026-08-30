"""Storage for transactions and the merchant's product list.

Deliberately small: a thread-safe in-memory list plus one JSON-lines file per
day. The daily files are the history the spec asks to keep for later business
and ML analysis, and they're trivial to load into pandas. Swapping this for
SQLite or Postgres later means reimplementing this one class.
"""

from __future__ import annotations

import json
import logging
import threading
from datetime import date, datetime, timezone
from pathlib import Path

from .config import settings
from .models.product import Product
from .models.transaction import Transaction, TransactionStatus

log = logging.getLogger(__name__)

DEFAULT_PRODUCTS = [
    Product(name="Samosa", price=25, aliases=["samosas", "somosa", "samosa chaat"]),
    Product(name="Tea", price=10, aliases=["chai", "chay", "cutting chai"]),
    Product(name="Coffee", price=20, aliases=["kaapi", "filter coffee"]),
]


def _local_date(ts: datetime) -> date:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.astimezone().date()


class TransactionStore:
    def __init__(self, data_dir: Path | None = None) -> None:
        self.data_dir = Path(data_dir or settings.DATA_DIR)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._items: list[Transaction] = []
        self._load_today()

    # -- persistence -----------------------------------------------------

    def _file_for(self, day: date) -> Path:
        return self.data_dir / f"transactions-{day.isoformat()}.jsonl"

    def _load_today(self) -> None:
        path = self._file_for(date.today())
        if not path.exists():
            return
        loaded = 0
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                self._items.append(Transaction.model_validate_json(line))
                loaded += 1
            except Exception as exc:
                log.warning("skipping unreadable row in %s: %s", path.name, exc)
        log.info("restored %d transactions from %s", loaded, path.name)

    def _rewrite_day(self, day: date) -> None:
        rows = [t for t in self._items if _local_date(t.timestamp) == day]
        path = self._file_for(day)
        with path.open("w", encoding="utf-8") as fh:
            for t in rows:
                fh.write(t.model_dump_json() + "\n")

    def _append(self, txn: Transaction) -> None:
        with self._file_for(_local_date(txn.timestamp)).open("a", encoding="utf-8") as fh:
            fh.write(txn.model_dump_json() + "\n")

    # -- api -------------------------------------------------------------

    def add(self, txn: Transaction) -> Transaction:
        with self._lock:
            self._items.append(txn)
            self._append(txn)
        return txn

    def get(self, txn_id: str) -> Transaction | None:
        with self._lock:
            return next((t for t in self._items if t.id == txn_id), None)

    def list(self, day: date | None = None, status: TransactionStatus | None = None) -> list[Transaction]:
        with self._lock:
            rows = list(self._items)
        if day is not None:
            rows = [t for t in rows if _local_date(t.timestamp) == day]
        if status is not None:
            rows = [t for t in rows if t.status == status]
        return sorted(rows, key=lambda t: t.timestamp, reverse=True)

    def set_status(self, txn_id: str, status: TransactionStatus) -> Transaction | None:
        with self._lock:
            txn = next((t for t in self._items if t.id == txn_id), None)
            if txn is None:
                return None
            txn.status = status
            self._rewrite_day(_local_date(txn.timestamp))
            return txn

    def delete(self, txn_id: str) -> bool:
        with self._lock:
            txn = next((t for t in self._items if t.id == txn_id), None)
            if txn is None:
                return False
            day = _local_date(txn.timestamp)
            self._items.remove(txn)
            self._rewrite_day(day)
            return True

    def last_pending(self) -> Transaction | None:
        rows = self.list(status=TransactionStatus.pending)
        return rows[0] if rows else None

    def match_payment(self, amount: float, when: datetime, window_min: float = 10.0) -> Transaction | None:
        """Oldest pending transaction with this amount inside the time window.

        The payment-matching module owns this decision; the endpoint exists so
        the two halves can be tested end to end.
        """
        window = window_min * 60
        candidates = [
            t
            for t in self.list(status=TransactionStatus.pending)
            if abs(t.amount - amount) < 0.01 and 0 <= t.age_seconds(when) <= window
        ]
        return min(candidates, key=lambda t: t.timestamp) if candidates else None

    def summary(self, day: date | None = None) -> dict:
        day = day or date.today()
        rows = self.list(day=day)
        paid = [t for t in rows if t.status == TransactionStatus.paid]
        pending = [t for t in rows if t.status == TransactionStatus.pending]
        overdue = [t for t in pending if t.age_seconds() > settings.PENDING_ALERT_MIN * 60]
        return {
            "date": day.isoformat(),
            "total_transactions": len(rows),
            "total_amount": round(sum(t.amount for t in rows), 2),
            "paid_count": len(paid),
            "paid_amount": round(sum(t.amount for t in paid), 2),
            "pending_count": len(pending),
            "pending_amount": round(sum(t.amount for t in pending), 2),
            "overdue_count": len(overdue),
            "overdue_ids": [t.id for t in overdue],
        }


class ProductCatalog:
    def __init__(self, path: Path | None = None) -> None:
        self.path = Path(path or settings.PRODUCTS_FILE)
        self._products: list[Product] = []
        self.load()

    def load(self) -> list[Product]:
        if self.path.exists():
            try:
                raw = json.loads(self.path.read_text(encoding="utf-8"))
                self._products = [Product.model_validate(p) for p in raw]
                return self._products
            except Exception as exc:
                log.warning("products file unreadable (%s), using defaults", exc)
        self._products = [p.model_copy(deep=True) for p in DEFAULT_PRODUCTS]
        self.save()
        return self._products

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps([p.model_dump() for p in self._products], indent=2),
            encoding="utf-8",
        )

    @property
    def products(self) -> list[Product]:
        return self._products

    def replace(self, products: list[Product]) -> list[Product]:
        self._products = products
        self.save()
        return self._products


store = TransactionStore()
catalog = ProductCatalog()
