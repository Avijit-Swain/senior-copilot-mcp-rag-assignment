from __future__ import annotations

from contextvars import ContextVar
from typing import Any, Callable

EventSink = Callable[[dict[str, Any]], None]

_event_sink: ContextVar[EventSink | None] = ContextVar("agent_event_sink", default=None)


def set_event_sink(sink: EventSink | None):
    return _event_sink.set(sink)


def reset_event_sink(token) -> None:
    _event_sink.reset(token)


def emit_event(event: dict[str, Any]) -> None:
    sink = _event_sink.get()
    if sink is not None:
        sink(event)
