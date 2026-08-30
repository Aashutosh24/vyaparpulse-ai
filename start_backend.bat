@echo off
REM One-shot backend setup + run. Safe to re-run; it skips work already done.
cd /d "%~dp0backend"

if not exist venv (
    echo creating venv
    python -m venv venv
)
call venv\Scripts\activate

pip install -q -r requirements.txt

if not exist models (
    echo downloading the speech model ^(~40 MB, one time^)
    python scripts\download_model.py
)

echo.
echo console:  http://127.0.0.1:8000
echo api docs: http://127.0.0.1:8000/docs
echo phone:    point the app at http://^<this machine^'s LAN IP^>:8000
echo.
python run.py
pause
