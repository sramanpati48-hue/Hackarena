"""
Internal Webhook Poller for Supabase Tables

This module runs a background task that polls the `interventions` and `sahayak_cases`
tables for new records and broadcasts them to connected moderators and sahayaks via WebSocket.

This replaces the need for Supabase webhooks and ensures real-time updates reach the frontend.
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from database.supabase_db import supabase
from database import supabase_db
from websocket_manager import manager

logger = logging.getLogger(__name__)

# ── Cross-process lock ─────────────────────────────────────────────────────
# When uvicorn runs with multiple workers, each worker starts its own poller.
# We use a file lock so only ONE worker actually polls — others skip silently.
# On Linux (VPS) we use fcntl; on Windows we fall back to always-run (single worker).
_LOCK_FILE = "/tmp/nyaysahayak_poller.lock"
_lock_fd = None

def _acquire_poller_lock() -> bool:
    """Try to grab the exclusive poller lock. Returns True only in the winning process."""
    global _lock_fd
    if sys.platform == "win32":
        return True  # Windows dev — single worker, always run
    try:
        import fcntl
        _lock_fd = open(_LOCK_FILE, "w")
        fcntl.flock(_lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)  # non-blocking
        _lock_fd.write(str(os.getpid()))
        _lock_fd.flush()
        return True
    except (IOError, OSError):
        return False  # Another worker already holds the lock


class WebhookPoller:
    def __init__(self):
        self.last_intervention_check: Optional[datetime] = None
        self.last_sahayak_check: Optional[datetime] = None
        self.processed_interventions: set = set()  # Track processed case IDs
        self.processed_sahayak_cases: set = set()  # Track processed case IDs
        self.poll_interval: int = 15  # Poll every 15s — reduces Supabase load on multi-worker VPS
        self.running: bool = False
        
    async def start(self):
        """Start the polling loop — only runs in the process that wins the file lock."""
        if self.running:
            logger.warning("Webhook poller already running")
            return

        if not _acquire_poller_lock():
            logger.info(f"⏭️  Webhook poller skipped (another worker is already polling) PID={os.getpid()}")
            return

        self.running = True
        logger.info(f"🔄 Starting Webhook Poller in PID={os.getpid()}...")
        
        try:
            await self._polling_loop()
        except Exception as e:
            logger.error(f"❌ Webhook poller error: {e}")
            self.running = False
            
    async def stop(self):
        """Stop the polling loop"""
        self.running = False
        logger.info("🛑 Stopping Webhook Poller...")
        
    async def _polling_loop(self):
        """Main polling loop - checks tables periodically"""
        while self.running:
            try:
                # Poll both tables concurrently
                await asyncio.gather(
                    self._check_interventions(),
                    self._check_sahayak_cases(),
                    return_exceptions=True
                )
                
                # Wait before next poll
                await asyncio.sleep(self.poll_interval)
                
            except Exception as e:
                logger.error(f"Error in polling loop: {e}")
                await asyncio.sleep(self.poll_interval)
    
    async def _check_interventions(self):
        """Check for new pending interventions"""
        if not supabase:
            logger.warning("Supabase not connected")
            return
            
        try:
            # Query pending interventions with recent timestamps
            query = supabase.table("interventions") \
                .select("*") \
                .eq("status", "pending") \
                .order("created_at", desc=True) \
                .limit(50)
            
            response = await asyncio.to_thread(query.execute)
            cases = response.data or []
            
            for case in cases:
                case_id = case.get("id")
                
                # Skip if already processed
                if case_id in self.processed_interventions:
                    continue
                
                # Mark as processed
                self.processed_interventions.add(case_id)
                
                # Parse structured report
                s_report = case.get("structured_report") or {}
                if isinstance(s_report, str):
                    try:
                        s_report = json.loads(s_report)
                    except Exception:
                        s_report = {}
                
                # Build broadcast message
                case_data = {
                    "type": "new_intervention",
                    "case_id": case_id,
                    "user_id": case.get("user_id"),
                    "incident_type": s_report.get("incident_type", "Unknown"),
                    "risk_level": s_report.get("risk_level", "High"),
                    "structured_report": s_report,
                    "collection": case.get("collection_name") or "moderator",
                    "created_at": case.get("created_at"),
                    "session_id": case.get("session_id"),
                    "user_statement": case.get("user_statement", ""),
                    "location": case.get("location", {}),
                    "routing_recommendation": supabase_db.get_intervention_routing_recommendation(
                        s_report,
                        case.get("user_statement", ""),
                        case.get("location", {}),
                    ),
                }
                
                # Broadcast to moderator channel
                await manager.broadcast(
                    json.dumps(case_data),
                    channel="moderator"
                )
                logger.info(f"📢 New intervention broadcast: {case_id}")
                
        except Exception as e:
            logger.error(f"Error checking interventions: {e}")
    
    async def _check_sahayak_cases(self):
        """Check for new pending sahayak cases"""
        if not supabase:
            logger.warning("Supabase not connected")
            return
            
        try:
            # Query pending sahayak cases
            query = supabase.table("sahayak_cases") \
                .select("*") \
                .eq("status", "pending") \
                .order("created_at", desc=True) \
                .limit(50)
            
            response = await asyncio.to_thread(query.execute)
            cases = response.data or []
            
            for case in cases:
                case_id = case.get("id")
                
                # Skip if already processed
                if case_id in self.processed_sahayak_cases:
                    continue
                
                # Mark as processed
                self.processed_sahayak_cases.add(case_id)
                
                # Parse structured report
                s_report = case.get("structured_report") or {}
                if isinstance(s_report, str):
                    try:
                        s_report = json.loads(s_report)
                    except Exception:
                        s_report = {}
                
                # Build broadcast message
                case_data = {
                    "type": "new_sahayak_case",
                    "case_id": case_id,
                    "user_id": case.get("user_id"),
                    "user_name": case.get("user_name", ""),
                    "incident_type": s_report.get("incident_type", "Unknown"),
                    "risk_level": s_report.get("risk_level", "High"),
                    "summary": s_report.get("summary", ""),
                    "structured_report": s_report,
                    "created_at": case.get("created_at"),
                    "session_id": case.get("session_id"),
                }
                
                # Broadcast to sahayak channel
                await manager.broadcast(
                    json.dumps(case_data),
                    channel="sahayak"
                )
                logger.info(f"📢 New sahayak case broadcast: {case_id}")
                
        except Exception as e:
            logger.error(f"Error checking sahayak cases: {e}")
    
    async def reset_tracking(self):
        """Reset processed case tracking (useful for recovery)"""
        self.processed_interventions.clear()
        self.processed_sahayak_cases.clear()
        logger.info("🔄 Reset case tracking")


# Global poller instance
poller = WebhookPoller()
