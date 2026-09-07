from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import transactions, payments, saksham

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SAKSHAM — Merchant Intelligence Backend",
    description=(
        "VyaparPulse captures what happened. "
        "SAKSHAM understands what it means — and what the merchant should do next. "
        "Endpoints: /transactions (ledger + ML bridge), /payments (UPI matching), "
        "/saksham (economic intelligence: products, inventory, invoices, memory)."
    ),
    version="2.0.0",
)

# Wide-open CORS for local dev — tighten (specific origins) before production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions.router)
app.include_router(payments.router)
app.include_router(saksham.router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "version": "saksham-2.0"}
