"""Verify every piece of the hands-free patch landed. Run from backend/."""
import pathlib, sys

checks = [
    ("app/config.py",        "COMMAND_SETTLE_SEC",          "settle-pause setting"),
    ("app/config.py",        "COMMAND_WINDOW_SEC\", 15.0",  "15-second window"),
    ("app/voice/agent.py",   "def preview(",                "VoiceAgent.preview"),
    ("app/voice/agent.py",   "self._candidate: str | None", "StreamSession state"),
    ("app/voice/agent.py",   "self._settle_at = 0.0",       "settle timer"),
    ("app/voice/agent.py",   "def _commit(",                "StreamSession._commit"),
    ("app/voice/agent.py",   "result = self.agent.preview(", "_on_final accumulation"),
    ("app/voice/agent.py",   "if self._settle_at and now >= self._settle_at", "feed settle check"),
    ("app/voice/wake.py",    "HOMOPHONE_SETS",              "per-wake-word homophones"),
    ("app/voice/wake.py",    "token in heard_as",           "detect uses heard_as"),
]

ok = True
for path, needle, label in checks:
    text = pathlib.Path(path).read_text(encoding="utf-8")
    hit = needle in text
    ok &= hit
    print(f"  {'OK  ' if hit else 'MISS'} {label}")

for path in ["app/config.py", "app/voice/agent.py", "app/voice/wake.py", "app/api.py"]:
    try:
        compile(pathlib.Path(path).read_text(encoding="utf-8"), path, "exec")
        print(f"  OK   {path} parses")
    except SyntaxError as e:
        ok = False
        print(f"  FAIL {path} line {e.lineno}: {e.msg}")

print("\nall good" if ok else "\nsomething is missing above")
sys.exit(0 if ok else 1)