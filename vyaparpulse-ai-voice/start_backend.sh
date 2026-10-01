#!/usr/bin/env bash
# One-shot backend setup + run. Safe to re-run; it skips work already done.
set -e
cd "$(dirname "$0")/backend"

if [ ! -d venv ]; then
  echo "creating venv"
  python3 -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate

pip install -q -r requirements.txt

if [ ! -d models ]; then
  echo "downloading the speech model (~40 MB, one time)"
  python scripts/download_model.py
fi

echo
echo "console:  http://127.0.0.1:8000"
echo "api docs: http://127.0.0.1:8000/docs"
echo "phone:    point the app at http://<this machine's LAN IP>:8000"
echo
python run.py
