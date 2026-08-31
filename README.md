# VyaparPulse 🚀

**VyaparPulse** is an AI-powered financial intelligence and ledger platform purpose-built for micro-businesses and informal merchants. By replacing manual entry with a localized voice agent and backing it up with predictive machine learning, VyaparPulse turns raw, spoken transactions into actionable business health insights and cash-flow forecasts.

---

## 🌟 Key Features

*   **🗣️ Voice-First Sales Recording:** Merchants can log complex, multi-item transactions simply by speaking (e.g., *"2 teas 20 rupees, 3 samosas 30 rupees"*). The AI agent parses transcripts, extracts items/quantities, and generates a structured cart automatically.
*   **📒 Automated Ledger & Reconciliation:** Seamlessly maps incoming payments to pending voice-generated invoices with intelligent duplicate protection.
*   **🧠 ML-Driven Forecasting (XGBoost):** An embedded ML-2 pipeline evaluates historical data to generate dynamic 7-day revenue forecasts, confidence scores, and tailored business insights. (Gracefully handles "insufficient history" for new merchants).
*   **📱 Native Mobile Experience:** Built with Capacitor to run natively on Android/iOS, fully supporting device microphones and responsive mobile viewports.

---

## 🏗️ Architecture

VyaparPulse consists of four deeply integrated systems:

1.  **React/Vite Frontend:** Cross-platform web application compiled to Android native via Capacitor. Handles offline modes, complex state, and UI charts.
2.  **Voice Agent Microservice:** Fast, local Vosk-powered Speech-to-Text engine mixed with LLM extraction that converts raw audio streams into canonical JSON arrays. *(Runs on Port 8203)*
3.  **Teammate Backend:** FastAPI + SQLAlchemy system acting as the central nervous system. Manages the SQLite ledger, transaction reconciliation, and serves as the bridge. *(Runs on Port 8000)*
4.  **ML-2 Engine:** An advanced Python XGBoost framework embedded within the Teammate Backend that computes scaling variability, seasonality, and revenue forecasts.

---

## 🚀 Getting Started

To run the full stack locally or via an Android emulator, you will need Node.js and Python installed.

### 1. Start the Voice Agent
```bash
cd teammate-backend/ml2
# For Windows Powershell:
$env:PORT="8203"; .\start_backend.bat
# (Make sure to run pip install -r requirements.txt if running for the first time)
```

### 2. Start the Teammate Backend & ML Bridge
```bash
cd teammate-backend
# Activate your virtual environment
.\venv\Scripts\activate
# Start the FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 3. Start the Frontend (Web)
```bash
cd frontend
npm install
npm run dev
```
The app will be available at `http://localhost:5173`.

---

## 📱 Android Emulator Setup

If you are running the application in an Android Studio Emulator, the system must use `10.0.2.2` to route traffic correctly to your host machine's backend.

1. Navigate to the `frontend` directory.
2. Ensure you have the `.env.production` file configured:
   ```env
   VITE_VOICE_URL=http://10.0.2.2:8203
   VITE_BACKEND_URL=http://10.0.2.2:8000
   ```
3. Build the assets and sync to Capacitor:
   ```bash
   npm run build
   npx cap sync android
   ```
4. Open the project in Android Studio:
   ```bash
   npx cap open android
   ```
5. Run the app on your selected AVD!

---

## 🛠️ Technology Stack
*   **Frontend:** React, TypeScript, Vite, TailwindCSS, Framer Motion, Capacitor.
*   **Backend & ML:** Python, FastAPI, SQLite, SQLAlchemy, Vosk, XGBoost, Pandas.

*Built for the Smart India Hackathon (SIH).*
