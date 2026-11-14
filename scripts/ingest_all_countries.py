#!/usr/bin/env python3
"""
Run Wikidata ingestion for all European countries.
This script runs the ingestion sequentially with proper delays to respect rate limits.
"""
import subprocess
import sys
import time

REGIONS = [
    "austria",
    "germany",
    "france",
    "italy",
    "united_kingdom",
    "spain",
    "poland",
    "netherlands",
    "belgium",
]

def run_command(cmd, timeout=600):
    """Run a command and return the result."""
    print(f"\n{'='*60}")
    print(f"Running: {' '.join(cmd)}")
    print(f"{'='*60}")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        print(f"Exit code: {result.returncode}")
        if result.stdout:
            print(f"STDOUT:\n{result.stdout}")
        if result.stderr:
            print(f"STDERR:\n{result.stderr}")
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        print(f"TIMEOUT after {timeout}s")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False

def main():
    print("Starting Wikidata ingestion for all European regions...")
    print(f"Regions: {REGIONS}")
    print(f"Note: Wikidata Query Service rate limits to ~1 request/minute per category.")
    print(f"This will take approximately {len(REGIONS) * 10} minutes.\n")

    results = {}

    for region in REGIONS:
        print(f"\n>>> Processing {region}...")

        # Step 1: Import Wikidata events
        success = run_command([
            sys.executable, "ingestion/connectors/wikidata_events.py", region
        ], timeout=900)

        if not success:
            print(f"Failed to import events for {region}, continuing...")
            results[region] = {"events": False}
            continue

        # Step 2: Import additional landmarks/wars
        success = run_command([
            sys.executable, "ingestion/connectors/wikidata_more.py", region
        ], timeout=600)

        if not success:
            print(f"Failed to import landmarks for {region}, continuing...")
            results[region] = {"events": True, "landmarks": False}
            continue

        # Step 3: Export to JSON files for web app
        success = run_command([
            sys.executable, "-m", "timewise_api.export", region
        ], timeout=300)

        if not success:
            print(f"Failed to export for {region}, continuing...")
            results[region] = {"events": True, "landmarks": True, "export": False}
            continue

        # Step 4: Copy to public folder
        import shutil
        try:
            src = f"data/generated/{region}/db-collection.json"
            dst = f"apps/web/public/data/regions/{region}.json"
            shutil.copy2(src, dst)
            print(f"Copied {src} -> {dst}")
        except Exception as e:
            print(f"Failed to copy: {e}")

        results[region] = {"events": True, "landmarks": True, "export": True}

        # Be nice to Wikidata - extra delay between regions
        print("Waiting 10 seconds before next region...")
        time.sleep(10)

    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    for region, status in results.items():
        status_str = ", ".join([f"{k}: {'✓' if v else '✗'}" for k, v in status.items()])
        print(f"  {region}: {status_str}")

if __name__ == "__main__":
    main()