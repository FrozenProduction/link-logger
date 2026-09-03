#!/usr/bin/env python3
"""Check script: verify that required dependencies are installed."""
import sys

modules = ["fastapi", "uvicorn", "pydantic"]
for m in modules:
    try:
        mod = __import__(m)
        print(f"✓ {m} — {getattr(mod, '__version__', 'installed')}")
    except ImportError as e:
        print(f"✗ {m} — NOT INSTALLED: {e}")
        sys.exit(1)

print("\nAll dependencies installed. Ready to start the server.")
