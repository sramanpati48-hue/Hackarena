import asyncio
import json
from typing import List, Dict, Any, Optional
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Dictionary to store active connections by channel (e.g., 'moderator', user_uid)
        self.active_channels: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel: str = "default"):
        await websocket.accept()
        if channel not in self.active_channels:
            self.active_channels[channel] = []
        self.active_channels[channel].append(websocket)
        print(f"🔌 WebSocket Connected to channel '{channel}'. Total in channel: {len(self.active_channels[channel])}")

    def disconnect(self, websocket: WebSocket, channel: str = "default"):
        if channel in self.active_channels and websocket in self.active_channels[channel]:
            self.active_channels[channel].remove(websocket)
            print(f"🔌 WebSocket Disconnected from channel '{channel}'. Total in channel: {len(self.active_channels[channel])}")

    async def broadcast(self, message: str, channel: Optional[str] = None):
        """Asynchronously send a message to all connected clients, optionally filtered by channel."""
        channels_to_broadcast = [channel] if channel else list(self.active_channels.keys())

        for ch in channels_to_broadcast:
            if ch in self.active_channels:
                disconnected_clients = []
                for connection in self.active_channels[ch]:
                     try:
                         await connection.send_text(message)
                     except Exception as e:
                         print(f"⚠️ Error broadcasting to websocket client on channel '{ch}': {e}")
                         disconnected_clients.append(connection)
                         
                for client in disconnected_clients:
                    self.disconnect(client, ch)

    def broadcast_sync(self, data: Dict[str, Any], channel: Optional[str] = None):
        """
        Helper method to be called from synchronous threads (like LangGraph nodes).
        It schedules the async broadcast task in the main event loop.
        """
        message = json.dumps(data)
        try:
            # Get the running event loop
            loop = asyncio.get_running_loop()
            # Schedule the broadcast coroutine
            loop.create_task(self.broadcast(message, channel))
        except RuntimeError:
            # If no running loop (e.g. testing), just run it
            asyncio.run(self.broadcast(message, channel))
        
# Global instance to be imported by main.py and legal_moderator.py
manager = ConnectionManager()
