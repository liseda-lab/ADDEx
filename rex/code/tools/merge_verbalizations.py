#!/usr/bin/env python3
"""Merge downloaded verbalizations into this repo's rex/saved_models, filling
ONLY the empty ones, then delete each source file that was merged.

Per pair file found under SRC:
  - source verbalization is empty          -> skip (nothing to add), keep source
  - repo file already has a non-empty
    verbalization                          -> skip (NEVER overwrite), keep source
  - repo file missing, or its verbalization
    is empty                               -> MERGE the source verbalization in
                                              (fills the field, or copies the
                                              whole file if it doesn't exist yet)

With --apply the changes are written and each MERGED source file is deleted.
Without --apply it's a dry run (no writes, no deletes) that just reports counts.

Usage:
    python merge_verbalizations.py SRC [DST] [--apply]

    SRC = the downloaded saved_models directory
          (e.g. ~/Downloads/saved_models — must be the saved_models ROOT, i.e.
           it contains <dataset>/<task>/<persona>/pairs/*.json)
    DST = target saved_models (default: rex/saved_models, relative to CWD)

Run the dry run first, eyeball the numbers, then re-run with --apply.
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


def verbalization(data: dict) -> str:
    v = (data or {}).get("verbalization")
    return v if isinstance(v, str) and v.strip() else ""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("src", help="downloaded saved_models root")
    ap.add_argument("dst", nargs="?", default="rex/saved_models")
    ap.add_argument("--apply", action="store_true",
                    help="write merges and delete merged source files (default: dry run)")
    args = ap.parse_args()

    src, dst = Path(args.src).expanduser(), Path(args.dst).expanduser()
    if not src.exists():
        print(f"error: SRC not found: {src}")
        return 2

    filled = copied = skip_has_verb = skip_empty_src = errors = deleted = 0
    scanned = 0
    print(f"Scanning {src} ...", flush=True)
    for sp in src.glob("*/*/*/pairs/*.json"):
        scanned += 1
        if scanned % 10000 == 0:
            print(f"  ... {scanned} scanned | merged={filled + copied} "
                  f"skipped={skip_has_verb + skip_empty_src}", flush=True)
        rel = sp.relative_to(src)
        dp = dst / rel
        try:
            sdata = json.loads(sp.read_text(encoding="utf-8"))
        except Exception:
            errors += 1
            continue

        if not verbalization(sdata):
            skip_empty_src += 1
            continue

        merged = False
        if dp.exists():
            try:
                ddata = json.loads(dp.read_text(encoding="utf-8"))
            except Exception:
                errors += 1
                continue
            if verbalization(ddata):
                skip_has_verb += 1          # repo already has one -> never overwrite
                continue
            if args.apply:
                ddata["verbalization"] = sdata["verbalization"]
                dp.write_text(json.dumps(ddata, ensure_ascii=False, indent=2),
                              encoding="utf-8")
            filled += 1
            merged = True
        else:
            if args.apply:
                dp.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(sp, dp)
            copied += 1
            merged = True

        if merged and args.apply:
            sp.unlink(missing_ok=True)
            deleted += 1

    mode = "APPLIED" if args.apply else "DRY RUN (no writes/deletes)"
    print(
        f"\n[{mode}] merged={filled + copied} "
        f"(filled empty={filled}, copied new={copied}) | "
        f"skipped: repo-already-has-verbalization={skip_has_verb}, "
        f"source-empty={skip_empty_src} | errors={errors} | "
        f"source-files-deleted={deleted}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
