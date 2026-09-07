"""
SAKSHAM Demo Seed Data
======================
Raju General Store — deterministic demo dataset.
Used by the /saksham/seed endpoint.

All numbers here correspond exactly to the frontend sakshamDemoData.ts.
"""
from datetime import datetime, timedelta


def _days_ago(n: int) -> str:
    """Return ISO date string for n days before 2026-09-07."""
    d = datetime(2026, 9, 7) - timedelta(days=n)
    return d.strftime("%Y-%m-%d")


DEMO_PRODUCTS = [
    {
        "name": "Tea (loose)", "unit": "kg", "category": "Beverages",
        "selling_price": 350.0, "purchase_price_old": 286.0, "purchase_price_new": 306.0,
        "supplier_name": "ABC Wholesale", "margin_old": 18.4, "margin_new": 12.6,
        "safety_stock_days": 1.5, "reorder_unit": 8.0,
    },
    {
        "name": "Rice bag (5 kg)", "unit": "bag", "category": "Staples",
        "selling_price": 520.0, "purchase_price_old": 470.0, "purchase_price_new": 480.0,
        "supplier_name": "ABC Wholesale", "margin_old": 9.6, "margin_new": 7.7,
        "safety_stock_days": 2.0, "reorder_unit": 20.0,
    },
    {
        "name": "Cooking oil (1 L)", "unit": "litre", "category": "Cooking",
        "selling_price": 185.0, "purchase_price_old": 155.0, "purchase_price_new": 158.0,
        "supplier_name": "Sharma Distributors", "margin_old": 16.2, "margin_new": 14.6,
        "safety_stock_days": 2.0, "reorder_unit": 24.0,
    },
    {
        "name": "Sugar (1 kg)", "unit": "kg", "category": "Staples",
        "selling_price": 55.0, "purchase_price_old": 44.0, "purchase_price_new": 44.0,
        "supplier_name": "ABC Wholesale", "margin_old": 20.0, "margin_new": 20.0,
        "safety_stock_days": 2.0, "reorder_unit": 50.0,
    },
    {
        "name": "Detergent (500g)", "unit": "piece", "category": "Household",
        "selling_price": 85.0, "purchase_price_old": 62.0, "purchase_price_new": 65.0,
        "supplier_name": "Sharma Distributors", "margin_old": 27.1, "margin_new": 23.5,
        "safety_stock_days": 3.0, "reorder_unit": 12.0,
    },
    {
        "name": "Notebook (200 pg)", "unit": "piece", "category": "Stationery",
        "selling_price": 50.0, "purchase_price_old": 32.0, "purchase_price_new": 32.0,
        "supplier_name": "Local Stationery", "margin_old": 36.0, "margin_new": 36.0,
        "safety_stock_days": 7.0, "reorder_unit": 24.0,
    },
    {
        "name": "Parle-G (1 kg)", "unit": "packet", "category": "Snacks",
        "selling_price": 52.0, "purchase_price_old": 44.0, "purchase_price_new": 46.0,
        "supplier_name": "ABC Wholesale", "margin_old": 15.4, "margin_new": 11.5,
        "safety_stock_days": 3.0, "reorder_unit": 20.0,
    },
    {
        "name": "Salt (1 kg)", "unit": "kg", "category": "Staples",
        "selling_price": 25.0, "purchase_price_old": 18.0, "purchase_price_new": 18.0,
        "supplier_name": "ABC Wholesale", "margin_old": 28.0, "margin_new": 28.0,
        "safety_stock_days": 3.0, "reorder_unit": 50.0,
    },
    {
        "name": "Lifebuoy soap", "unit": "piece", "category": "Household",
        "selling_price": 45.0, "purchase_price_old": 34.0, "purchase_price_new": 36.0,
        "supplier_name": "Sharma Distributors", "margin_old": 24.4, "margin_new": 20.0,
        "safety_stock_days": 5.0, "reorder_unit": 24.0,
    },
    {
        "name": "Toor Daal (500 g)", "unit": "packet", "category": "Staples",
        "selling_price": 80.0, "purchase_price_old": 62.0, "purchase_price_new": 68.0,
        "supplier_name": "ABC Wholesale", "margin_old": 22.5, "margin_new": 15.0,
        "safety_stock_days": 2.0, "reorder_unit": 20.0,
    },
    {
        "name": "Wheat flour (10 kg)", "unit": "bag", "category": "Staples",
        "selling_price": 440.0, "purchase_price_old": 380.0, "purchase_price_new": 390.0,
        "supplier_name": "ABC Wholesale", "margin_old": 13.6, "margin_new": 11.4,
        "safety_stock_days": 2.0, "reorder_unit": 10.0,
    },
    {
        "name": "Cold drink (600 ml)", "unit": "bottle", "category": "Beverages",
        "selling_price": 40.0, "purchase_price_old": 28.0, "purchase_price_new": 30.0,
        "supplier_name": "Sharma Distributors", "margin_old": 30.0, "margin_new": 25.0,
        "safety_stock_days": 2.0, "reorder_unit": 24.0,
    },
    {
        "name": "Haldirams Namkeen", "unit": "packet", "category": "Snacks",
        "selling_price": 30.0, "purchase_price_old": 21.0, "purchase_price_new": 23.0,
        "supplier_name": "ABC Wholesale", "margin_old": 30.0, "margin_new": 23.3,
        "safety_stock_days": 3.0, "reorder_unit": 24.0,
    },
    {
        "name": "Matchbox (pack of 10)", "unit": "pack", "category": "Household",
        "selling_price": 22.0, "purchase_price_old": 15.0, "purchase_price_new": 15.0,
        "supplier_name": "Local Stationery", "margin_old": 31.8, "margin_new": 31.8,
        "safety_stock_days": 7.0, "reorder_unit": 50.0,
    },
    {
        "name": "Reynolds pen (blue)", "unit": "piece", "category": "Stationery",
        "selling_price": 12.0, "purchase_price_old": 8.0, "purchase_price_new": 8.0,
        "supplier_name": "Local Stationery", "margin_old": 33.3, "margin_new": 33.3,
        "safety_stock_days": 10.0, "reorder_unit": 50.0,
    },
]

DEMO_INVENTORY = [
    {"product_name": "Tea (loose)",          "quantity": 2.1},
    {"product_name": "Rice bag (5 kg)",      "quantity": 18.0},
    {"product_name": "Cooking oil (1 L)",    "quantity": 30.0},
    {"product_name": "Sugar (1 kg)",         "quantity": 40.0},
    {"product_name": "Detergent (500g)",     "quantity": 22.0},
    {"product_name": "Notebook (200 pg)",    "quantity": 60.0},
    {"product_name": "Parle-G (1 kg)",       "quantity": 30.0},
    {"product_name": "Salt (1 kg)",          "quantity": 35.0},
    {"product_name": "Lifebuoy soap",        "quantity": 48.0},
    {"product_name": "Toor Daal (500 g)",    "quantity": 25.0},
    {"product_name": "Wheat flour (10 kg)",  "quantity": 8.0},
    {"product_name": "Cold drink (600 ml)",  "quantity": 36.0},
    {"product_name": "Haldirams Namkeen",    "quantity": 50.0},
    {"product_name": "Matchbox (pack of 10)","quantity": 80.0},
    {"product_name": "Reynolds pen (blue)",  "quantity": 100.0},
]

DEMO_INVOICES = [
    {
        "supplier_name": "ABC Wholesale",
        "invoice_number": "ABC/2026/0821",
        "invoice_date": _days_ago(14),
        "grand_total": 16240.0,
        "line_items": [
            {"product_name": "Tea (loose)",      "quantity": 10.0, "unit": "kg",     "unit_price": 286.0, "total_amount": 2860.0},
            {"product_name": "Rice bag (5 kg)",  "quantity": 20.0, "unit": "bag",    "unit_price": 470.0, "total_amount": 9400.0},
            {"product_name": "Sugar (1 kg)",     "quantity": 50.0, "unit": "kg",     "unit_price": 44.0,  "total_amount": 2200.0},
            {"product_name": "Salt (1 kg)",      "quantity": 50.0, "unit": "kg",     "unit_price": 18.0,  "total_amount": 900.0},
            {"product_name": "Parle-G (1 kg)",   "quantity": 20.0, "unit": "packet", "unit_price": 44.0,  "total_amount": 880.0},
        ],
    },
    {
        "supplier_name": "ABC Wholesale",
        "invoice_number": "ABC/2026/0828",
        "invoice_date": _days_ago(7),
        "grand_total": 8110.0,
        "line_items": [
            {"product_name": "Rice bag (5 kg)",      "quantity": 10.0, "unit": "bag",    "unit_price": 480.0, "total_amount": 4800.0},
            {"product_name": "Toor Daal (500 g)",    "quantity": 20.0, "unit": "packet", "unit_price": 68.0,  "total_amount": 1360.0},
            {"product_name": "Wheat flour (10 kg)",  "quantity": 5.0,  "unit": "bag",    "unit_price": 390.0, "total_amount": 1950.0},
        ],
    },
    {
        "supplier_name": "ABC Wholesale",
        "invoice_number": "ABC/2026/0905",
        "invoice_date": _days_ago(2),
        "grand_total": 2542.0,
        "line_items": [
            {"product_name": "Tea (loose)",      "quantity": 5.0,  "unit": "kg",     "unit_price": 306.0, "total_amount": 1530.0},
            {"product_name": "Parle-G (1 kg)",   "quantity": 10.0, "unit": "packet", "unit_price": 46.0,  "total_amount": 460.0},
            {"product_name": "Haldirams Namkeen","quantity": 24.0, "unit": "packet", "unit_price": 23.0,  "total_amount": 552.0},
        ],
    },
]
