"""Diffusion d'événements temps réel (Server-Sent Events) vers les navigateurs ouverts."""

from __future__ import annotations

import asyncio
import json
from collections import defaultdict


class EventBroker:
    def __init__(self) -> None:
        self._queues: dict[int, set[asyncio.Queue[str]]] = defaultdict(set)

    def subscribe(self, user_id: int) -> asyncio.Queue[str]:
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
        self._queues[user_id].add(queue)
        return queue

    def unsubscribe(self, user_id: int, queue: asyncio.Queue[str]) -> None:
        self._queues[user_id].discard(queue)

    def publish(self, user_id: int | None, event: str, data: dict) -> None:
        """user_id=None : envoie à tout le monde."""
        payload = f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"
        targets = self._queues.values() if user_id is None else [self._queues.get(user_id, set())]
        for queues in targets:
            for queue in list(queues):
                try:
                    queue.put_nowait(payload)
                except asyncio.QueueFull:
                    pass


broker = EventBroker()
