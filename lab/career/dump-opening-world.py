#!/usr/bin/env python3
"""Freeze opening_world(random.Random(20261123)) for the career engine.

C-R2-3. The runtime does not run this script and does not reimplement
Python's random.Random. The hashed bytes are json.dumps of the 80 players
in pid order, keys in the ruling's order, separators (',', ':'), with no
trailing newline.

    python3 lab/career/dump-opening-world.py --model path/to/lanebound-career-model-v1.py
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import random
import sys
from pathlib import Path

EXPECTED_SHA256 = "19b3fbe89aa605b8d131d8112e2790b82d5faae3e4fb395be22fcdffae7b0088"
SEED = 20261123

REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO / "packages" / "career" / "data" / "opening-world-20261123.json"


def load_model(path: Path):
    spec = importlib.util.spec_from_file_location("lanebound_career_model_v1", path)
    if spec is None or spec.loader is None:
        raise SystemExit(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    # dataclass looks up the module in sys.modules during class creation.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def fingerprint(model) -> str:
    if model._NEXT_PID != 1:
        raise SystemExit(f"_NEXT_PID must start at 1, found {model._NEXT_PID}")
    _clubs, players = model.opening_world(random.Random(SEED))
    if [player.pid for player in players] != list(range(1, 81)):
        raise SystemExit("expected pids 1-80 from a fresh _NEXT_PID")
    rows = []
    for player in players:
        rows.append(
            {
                "pid": player.pid,
                "name": player.name,
                "role": player.role,
                "age": player.age,
                "attrs": [player.attrs[attr] for attr in model.ATTRS],
                "ovr": player.ovr,
                "potential": player.potential,
                "attr_pot": [player.attr_pot[attr] for attr in model.ATTRS],
                "mastery_main": player.mastery_main,
                "contract_years": player.contract_years,
                "wage": player.wage,
                "club": player.club,
                "focus": player.focus,
            }
        )
    return json.dumps(rows, separators=(",", ":"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Dump the C-R2-3 opening world")
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    blob = fingerprint(load_model(args.model))
    digest = hashlib.sha256(blob.encode()).hexdigest()
    if digest != EXPECTED_SHA256:
        raise SystemExit(f"fingerprint {digest} != {EXPECTED_SHA256}")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(blob, encoding="utf-8", newline="\n")
    print(digest)


if __name__ == "__main__":
    main()
