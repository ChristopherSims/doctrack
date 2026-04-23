"""
Demo: Before / After applying the asyncio parallelization skill.

This script shows a toy example of "linting" a list of records.
- code1   = fully synchronous (sequential)
- code1_skill = async parallelized version using the DocTrack async_utils pattern

Run with:  python async_demo.py
"""

import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
import functools

# ---------------------------------------------------------------------------
# Shared infrastructure (same as backend/async_utils.py)
# ---------------------------------------------------------------------------
_cpu_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="demo_cpu")


async def run_in_thread(func, *args, **kwargs):
    return await asyncio.to_thread(func, *args, **kwargs)


async def run_cpu_bound(func, *args, **kwargs):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        _cpu_executor, functools.partial(func, *args, **kwargs)
    )


async def gather_tasks(*coros, return_exceptions=True):
    return await asyncio.gather(*coros, return_exceptions=return_exceptions)


# ---------------------------------------------------------------------------
# Toy "database" and "lint" helpers
# ---------------------------------------------------------------------------
FAKE_DB = [
    {"id": f"REQ-{i:03d}", "title": f"Requirement {i}", "description": f"System shall do thing {i}", "level": "1"}
    for i in range(1, 21)
]


def fetch_requirements_sync():
    """Simulate a blocking DB read (e.g., SQLite query)."""
    time.sleep(0.05)          # 50 ms I/O latency
    return list(FAKE_DB)


def lint_one_sync(req):
    """Simulate a CPU-bound lint check on a single requirement."""
    time.sleep(0.02)          # 20 ms CPU work
    issues = []
    if len(req["description"]) < 25:
        issues.append({"severity": "warning", "message": "Description too short"})
    if not req["title"]:
        issues.append({"severity": "error", "message": "Empty title"})
    return {"req_id": req["id"], "issues": issues} if issues else None


# =============================================================================
# CODE 1  —  Fully synchronous (original / before skill)
# =============================================================================
def code1_lint_all():
    """Synchronous lint: fetch sequentially, then lint each record sequentially."""
    reqs = fetch_requirements_sync()
    results = []
    for r in reqs:
        res = lint_one_sync(r)
        if res:
            results.append(res)
    return results


# =============================================================================
# CODE 1 + SKILL  —  Async parallelized (after applying the skill)
# =============================================================================
async def code1_skill_lint_all():
    """Async lint: fetch in thread pool, then lint all records concurrently."""
    # Step 1: offload the blocking DB read to the default thread pool
    reqs = await run_in_thread(fetch_requirements_sync)

    # Step 2: run every lint check concurrently in the CPU-bound pool
    tasks = [run_cpu_bound(lint_one_sync, r) for r in reqs]
    raw_results = await gather_tasks(*tasks)

    # Step 3: filter out None / exceptions
    results = [r for r in raw_results if isinstance(r, dict)]
    return results


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------
def main():
    print("=" * 70)
    print("Demo: synchronous  vs  async parallelized")
    print("=" * 70)

    # --- Run sync version ---
    t0 = time.perf_counter()
    sync_results = code1_lint_all()
    sync_elapsed = time.perf_counter() - t0

    print(f"\n[code1]  Synchronous")
    print(f"   Records fetched : {len(FAKE_DB)}")
    print(f"   Issues found    : {len(sync_results)}")
    print(f"   Time elapsed    : {sync_elapsed:.3f}s")

    # --- Run async version ---
    t0 = time.perf_counter()
    async_results = asyncio.run(code1_skill_lint_all())
    async_elapsed = time.perf_counter() - t0

    print(f"\n[code1_skill]  Async (thread pool + gather)")
    print(f"   Records fetched : {len(FAKE_DB)}")
    print(f"   Issues found    : {len(async_results)}")
    print(f"   Time elapsed    : {async_elapsed:.3f}s")

    # --- Summary ---
    speedup = sync_elapsed / async_elapsed if async_elapsed > 0 else 0
    print(f"\n{'=' * 70}")
    print(f"Speed-up factor: {speedup:.1f}x")
    print(f"{'=' * 70}")

    # Show a sample result so the user sees the data shape is identical
    print("\nSample output (same shape for both):")
    print(async_results[0] if async_results else "No issues")


if __name__ == "__main__":
    main()
