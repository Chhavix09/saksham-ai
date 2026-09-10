"""Automated 24-Hour Background Scheduler for Government Scheme Updates.

Runs periodically every 24 hours to check the 9 target government portals
for new and updated schemes, ingesting them automatically into sakshamai.db.
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

from services.scheme_scraper import run_full_sync

logger = logging.getLogger("sakshamai.scheduler")

# Default interval is 24 hours (86,400 seconds)
DEFAULT_INTERVAL_SECONDS = int(os.getenv("SCHEME_SYNC_INTERVAL_SECONDS", 86400))


class SchemeScheduler:
    def __init__(self):
        self.interval_seconds = DEFAULT_INTERVAL_SECONDS
        self._task: asyncio.Task | None = None
        self._running = False
        self.status = "idle"  # idle | running | completed | error
        self.last_run: datetime | None = None
        self.next_run: datetime | None = None
        self.last_result: dict = {
            "scraped_count": 0,
            "persisted_count": 0,
            "status": "not_run_yet",
        }

    def get_status(self) -> dict:
        """Return the current scheduler status for admin inspection."""
        now = datetime.now(timezone.utc)
        time_until_next = None
        if self.next_run:
            diff = (self.next_run - now).total_seconds()
            time_until_next = max(0, int(diff))

        return {
            "is_active": self._running,
            "status": self.status,
            "interval_seconds": self.interval_seconds,
            "interval_hours": round(self.interval_seconds / 3600, 1),
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "next_run": self.next_run.isoformat() if self.next_run else None,
            "seconds_until_next_run": time_until_next,
            "last_result": self.last_result,
        }

    async def execute_sync(self) -> dict:
        """Execute the scrape and upsert cycle in a background thread."""
        logger.info("Scheduler: Starting scheme sync cycle...")
        self.status = "running"
        self.last_run = datetime.now(timezone.utc)
        try:
            # Run blocking scrape and DB upsert in worker thread
            result = await asyncio.to_thread(run_full_sync)
            self.status = "completed"
            self.last_result = result
            logger.info("Scheduler: Scheme sync cycle finished successfully: %s", result)
            return result
        except Exception as exc:
            self.status = "error"
            self.last_result = {"status": "error", "detail": str(exc), "timestamp": datetime.now(timezone.utc).isoformat()}
            logger.error("Scheduler: Scheme sync cycle failed: %s", exc)
            return self.last_result

    async def _loop(self):
        """Continuous 24-hour background loop."""
        logger.info("Scheme Scheduler loop started (Interval: %ds / 24 hours)", self.interval_seconds)
        while self._running:
            self.next_run = datetime.now(timezone.utc) + timedelta(seconds=self.interval_seconds)
            try:
                # Wait for the next interval (e.g. 24 hours)
                await asyncio.sleep(self.interval_seconds)
                if not self._running:
                    break
                await self.execute_sync()
            except asyncio.CancelledError:
                logger.info("Scheme Scheduler loop received cancellation.")
                break
            except Exception as exc:
                logger.error("Unexpected error in scheme scheduler loop: %s", exc)
                # Wait 5 minutes before retrying if there's a loop failure
                await asyncio.sleep(300)

    def start(self):
        """Start the background scheduler task."""
        if self._running:
            logger.warning("Scheme Scheduler is already running.")
            return

        self._running = True
        self.next_run = datetime.now(timezone.utc) + timedelta(seconds=self.interval_seconds)
        self._task = asyncio.create_task(self._loop(), name="scheme-scraper-24h-loop")
        logger.info("Scheme Scheduler task created and activated.")

    def stop(self):
        """Gracefully stop the background scheduler."""
        if not self._running:
            return

        logger.info("Stopping Scheme Scheduler...")
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
        self.status = "idle"


# Global singleton instance
scheduler = SchemeScheduler()
