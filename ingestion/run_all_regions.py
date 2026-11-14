#!/usr/bin/env python3
"""
Run the full Wikidata ingestion pipeline for ALL regions.

This script:
1. Imports Wikidata events for each region (wikidata_events.py)
2. Imports additional landmarks/wars for each region (wikidata_more.py)
3. Rewrites the atlas files and region lists (export.py --imported)

Run it with the project's venv, in the background; at one Wikidata request a minute it takes
about a quarter of an hour per region:

    .venv/Scripts/python ingestion/run_all_regions.py --resume

Finished regions are recorded in data/generated/ingest-progress.json, so --resume skips them.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGIONS_DIR = ROOT / "data" / "source-configs" / "regions"
PROGRESS = ROOT / "data" / "generated" / "ingest-progress.json"
ENV = {**os.environ, "PYTHONPATH": os.pathsep.join([str(ROOT / "apps" / "api"), os.environ.get("PYTHONPATH", "")]), "PYTHONIOENCODING": "utf8"}


def get_all_regions() -> list[str]:
    """Get all region IDs from the source configs."""
    return sorted(p.stem for p in REGIONS_DIR.glob("*.json") if not p.name.endswith(".boundary.geojson"))


def load_progress() -> dict:
    return json.loads(PROGRESS.read_text("utf8")) if PROGRESS.exists() else {}


def save_progress(progress: dict) -> None:
    PROGRESS.write_text(json.dumps(progress, indent=1, sort_keys=True), "utf8")


def run_cmd(cmd: list[str], description: str, max_retries: int = 3, base_delay: float = 60.0) -> bool:
    """Run a command with retries and exponential backoff on failure."""
    for attempt in range(max_retries):
        print(f"\n{'='*60}")
        print(f"{description} (attempt {attempt + 1}/{max_retries})")
        print(f"Command: {' '.join(cmd)}")
        print(f"{'='*60}\n")

        result = subprocess.run(cmd, cwd=ROOT, env=ENV)

        if result.returncode == 0:
            print(f"\n[OK] {description} succeeded")
            return True

        print(f"\n[FAIL] {description} failed (exit code {result.returncode})")

        if attempt < max_retries - 1:
            delay = base_delay * (2 ** attempt)
            print(f"  Waiting {delay:.0f}s before retry...")
            time.sleep(delay)
        else:
            print(f"  All {max_retries} attempts exhausted")

    return False


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Run full ingestion pipeline for all regions")
    parser.add_argument("regions", nargs="*", help="Region IDs to process (default: all)")
    parser.add_argument("--skip-events", action="store_true", help="Skip wikidata_events.py step")
    parser.add_argument("--skip-more", action="store_true", help="Skip wikidata_more.py step")
    parser.add_argument("--skip-export", action="store_true", help="Skip export step")
    parser.add_argument("--resume", action="store_true", help="Skip regions recorded as finished")
    parser.add_argument("--delay-between-regions", type=float, default=5.0, help="Seconds to wait between regions (the connectors already pace themselves)")
    parser.add_argument("--max-retries", type=int, default=3, help="Max retries per step (default: 3)")
    args = parser.parse_args()

    regions = args.regions or get_all_regions()
    progress = load_progress()
    if args.resume:
        regions = [r for r in regions if progress.get(r, {}).get("status") != "ok"]
    print(f"Processing {len(regions)} regions: {', '.join(regions)}")
    print(f"Delay between regions: {args.delay_between_regions}s")
    print(f"Max retries per step: {args.max_retries}")

    results = {}

    for i, region_id in enumerate(regions):
        print(f"\n{'#'*70}")
        print(f"# REGION {i+1}/{len(regions)}: {region_id}")
        print(f"{'#'*70}")

        region_results = {"events": True, "more": True, "export": True}

        # Step 1: Wikidata events
        if not args.skip_events:
            cmd = [sys.executable, "-m", "ingestion.connectors.wikidata_events", region_id, "--skip-done"]
            region_results["events"] = run_cmd(cmd, f"Wikidata events for {region_id}", max_retries=args.max_retries)

        # Step 2: Wikidata more (landmarks, wars)
        if not args.skip_more:
            cmd = [sys.executable, "-m", "ingestion.connectors.wikidata_more", region_id]
            region_results["more"] = run_cmd(cmd, f"Wikidata more for {region_id}", max_retries=args.max_retries)

        # Step 3: Export
        if not args.skip_export:
            cmd = [sys.executable, "-m", "timewise_api.export", "--imported"]
            region_results["export"] = run_cmd(cmd, f"Export for {region_id}", max_retries=args.max_retries)

        results[region_id] = region_results
        progress[region_id] = {"status": "ok" if all(region_results.values()) else "failed", "steps": region_results,
                               "finished": time.strftime("%Y-%m-%d %H:%M:%S")}
        save_progress(progress)

        # Wait between regions to avoid hammering Wikidata
        if i < len(regions) - 1:
            print(f"\n  Waiting {args.delay_between_regions}s before next region...")
            time.sleep(args.delay_between_regions)

    # Summary
    print(f"\n{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")
    for region_id, res in results.items():
        status = "[OK]" if all(res.values()) else "[FAIL]"
        steps = ", ".join(f"{k}={'[OK]' if v else '[FAIL]'}" for k, v in res.items())
        print(f"  {status} {region_id}: {steps}")

    failed = [r for r, res in results.items() if not all(res.values())]
    if failed:
        print(f"\n[FAIL] {len(failed)} region(s) had failures: {', '.join(failed)}")
        sys.exit(1)
    else:
        print(f"\n[OK] All {len(regions)} regions completed successfully")


if __name__ == "__main__":
    main()