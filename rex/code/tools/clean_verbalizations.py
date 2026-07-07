#!/usr/bin/env python3
"""Strip score/confidence sentences from cached verbalizations in saved_models.

This mirrors ``src/app/hooks/verbalization.ts:stripScoreMentions`` so the stored
verbalization matches what the UI shows. Cleaning the source means every
consumer (dashboard, PNG/report export, copy-to-clipboard) reads clean text,
instead of relying on each consumer to filter on the fly.

Usage:
    # dry run (default) — reports how many files would change, shows examples
    python clean_verbalizations.py [ROOT]

    # actually rewrite the files in place
    python clean_verbalizations.py [ROOT] --apply

ROOT defaults to ``rex/saved_models`` (run from the ADDEx repo root). Files are
pretty-printed JSON, and only the ``verbalization`` field is modified.

Note: saved_models is regenerable data. The change is deterministic and the
generator prompt has been updated so new verbalizations are already clean, so a
re-run only affects files verbalized before that change.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Keep this in lock-step with src/app/hooks/verbalization.ts
SCORE_RE = re.compile(
    r"\b(scores?|confidence|ranked|ranking|probabilit\w*|likelihood)\b|\b0\.\d{2,}\b",
    re.IGNORECASE,
)


def strip_score_mentions(explanation: str) -> str:
    paragraphs_out: list[str] = []
    for para in re.split(r"\n{2,}", explanation):
        kept = [
            s
            for s in re.split(r"(?<=[.!?])\s+", para)
            if s.strip() and not SCORE_RE.search(s)
        ]
        joined = " ".join(kept).strip()
        if joined:
            paragraphs_out.append(joined)
    cleaned = "\n\n".join(paragraphs_out).strip()
    # Safety net: never blank out a summary if stripping was too aggressive.
    return cleaned if len(cleaned) >= 40 else explanation.strip()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default="rex/saved_models")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="rewrite files in place (default: dry run, no writes)",
    )
    parser.add_argument(
        "--show", type=int, default=5, help="print up to N example removals"
    )
    args = parser.parse_args()

    root = Path(args.root)
    if not root.exists():
        print(f"error: root not found: {root}", file=sys.stderr)
        return 2

    files = root.glob("*/*/*/pairs/*.json")
    total = verbalized = changed = shown = 0
    for path in files:
        total += 1
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        verbalization = data.get("verbalization")
        if not isinstance(verbalization, str) or not verbalization.strip():
            continue
        verbalized += 1
        cleaned = strip_score_mentions(verbalization)
        if cleaned == verbalization.strip():
            continue
        changed += 1
        if shown < args.show:
            shown += 1
            removed = [
                s.strip()
                for s in re.split(r"(?<=[.!?])\s+", verbalization)
                if SCORE_RE.search(s)
            ]
            print(f"\n--- {path} ---")
            for sentence in removed:
                print(f"  REMOVED: {sentence}")
        if args.apply:
            data["verbalization"] = cleaned
            path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
            )

    mode = "APPLIED" if args.apply else "DRY RUN (no files written)"
    print(
        f"\n[{mode}] scanned={total} verbalized={verbalized} "
        f"{'changed' if args.apply else 'would change'}={changed}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
