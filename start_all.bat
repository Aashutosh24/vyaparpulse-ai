@echo off
REM ============================================================
REM VyaparPulse — Start All Backends (Windows)
REM Starts: teammate-backend (port 8000) + voice-agent (port 8203)
REM Run this from the project root: vyaparpulse-ai\
REM ============================================================

echo.
echo ========================================================
echo  VyaparPulse — Starting all backends
echo ========================================================
echo.

REM ── 1. Teammate Backend (port 8000) ──────────────────────
echo [1/2] Setting up teammate-backend...
cd /d "%~dp0teammate-backend"

if not exist venv (
    echo   Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat

echo   Installing dependencies...
pip install -q -r requirements.txt

echo   Starting teammate-backend on port 8000...
start "VyaparPulse - Teammate Backend" cmd /k "cd /d %~dp0teammate-backend && call venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

REM ── 2. Voice Agent (port 8203) ───────────────────────────
echo.
echo [2/2] Setting up voice-agent...
cd /d "%~dp0voice-agent\backend"

if not exist venv (
    echo   Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat

echo   Installing dependencies (vosk + fastapi)...
pip install -q -r requirements.txt

if not exist models (
    echo   Downloading Vosk speech model (~40 MB, one time)...
    python scripts\download_model.py en-in
)

echo   Starting voice-agent on port 8203...
start "VyaparPulse - Voice Agent" cmd /k "cd /d %~dp0voice-agent\backend && call venv\Scripts\activate.bat && set PORT=8203 && python run.py"

echo.
echo ========================================================
echo  Both backends are starting in separate windows:
echo    Teammate Backend: http://127.0.0.1:8000
echo    Voice Agent:      http://127.0.0.1:8203
echo.
echo  Frontend: cd frontend ^&^& npm run dev
echo  App URL:  http://localhost:5173
echo ========================================================
echo.
pause
