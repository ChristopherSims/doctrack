"""
Asyncio utilities for parallelizing CPU-bound and I/O-bound work
in the DocTrack Flask backend.

Uses asyncio.to_thread() for running sync functions in the default
thread pool, and a custom ThreadPoolExecutor for CPU-intensive tasks
(export generation, lint, etc.).
"""

import asyncio
import functools
from concurrent.futures import ThreadPoolExecutor

# Dedicated thread pool for CPU-bound work so we don't starve the default pool.
_cpu_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="doctrack_cpu")


async def run_in_thread(func, *args, **kwargs):
    """Run a synchronous function in the default thread pool.

    Best for I/O-bound work (DB reads, file I/O).
    """
    return await asyncio.to_thread(func, *args, **kwargs)


async def run_cpu_bound(func, *args, **kwargs):
    """Run a CPU-bound function in a dedicated thread pool.

    Best for export generation, lint, heavy JSON parsing, etc.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        _cpu_executor, functools.partial(func, *args, **kwargs)
    )


async def gather_tasks(*coros, return_exceptions=True):
    """Gather awaitables with consistent error handling.

    Defaults to return_exceptions=True so one failure doesn't cancel the rest.
    """
    return await asyncio.gather(*coros, return_exceptions=return_exceptions)
