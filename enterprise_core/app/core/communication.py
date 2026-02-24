"""
Inter-Agent Communication Bus
==============================
Redis-based message bus enabling agent-to-agent communication.

Supports:
- Direct messaging (Agent A → Agent B)
- Delegation requests (Orchestrator → Sub-Agent)
- Result reporting (Sub-Agent → Orchestrator)
- Broadcast messages (Agent → All Agents)
- Shared context/scratchpad per task session
"""

import json
import uuid
import time
import redis
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from enterprise_core.app import crud, schemas


class AgentCommunicationBus:
    """
    Redis-backed communication bus for inter-agent messaging.
    
    Architecture:
    - Each agent has a dedicated Redis channel: `agent:{agent_name}:inbox`
    - Task-scoped shared context stored in: `task:{task_id}:context`
    - Broadcast channel: `agent:broadcast`
    - All messages are also persisted to the database for audit trail.
    """

    def __init__(self, redis_url: str = "redis://redis:6379/0"):
        self.redis_conn = redis.Redis.from_url(redis_url, decode_responses=True)
        self.event_channel = "events"
        print("[CommBus] Agent Communication Bus initialized.")

    # ------------------------------------------------------------------
    # DIRECT MESSAGING
    # ------------------------------------------------------------------
    def send_message(
        self,
        db: Session,
        sender_agent: str,
        receiver_agent: str,
        message_type: str,
        content: Dict[str, Any],
        task_id: str,
        session_id: str = "",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Send a message from one agent to another.
        Pushes to the receiver's Redis inbox and persists to DB.
        Returns the message_id.
        """
        message_id = str(uuid.uuid4())
        if not session_id:
            session_id = task_id  # Default session to task scope

        message = {
            "message_id": message_id,
            "session_id": session_id,
            "task_id": task_id,
            "sender_agent": sender_agent,
            "receiver_agent": receiver_agent,
            "message_type": message_type,
            "content": content,
            "metadata": metadata or {},
            "timestamp": time.time(),
        }

        # Push to receiver's Redis inbox queue
        inbox_key = f"agent:{receiver_agent}:inbox"
        self.redis_conn.rpush(inbox_key, json.dumps(message))

        # Persist to database
        db_msg = schemas.AgentMessageCreate(
            message_id=message_id,
            session_id=session_id,
            task_id=task_id,
            sender_agent=sender_agent,
            receiver_agent=receiver_agent,
            message_type=message_type,
            content=json.dumps(content),
            metadata_json=json.dumps(metadata) if metadata else None,
        )
        crud.create_agent_message(db, db_msg)

        # Emit event for real-time observability
        self._emit_event("AGENT_MESSAGE_SENT", {
            "message_id": message_id,
            "sender": sender_agent,
            "receiver": receiver_agent,
            "type": message_type,
            "task_id": task_id,
        })

        print(f"[CommBus] {sender_agent} → {receiver_agent} [{message_type}] (msg: {message_id[:8]}...)")
        return message_id

    def receive_messages(
        self,
        agent_name: str,
        timeout: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Receive all pending messages from an agent's inbox (non-blocking by default).
        Returns a list of message dicts.
        """
        inbox_key = f"agent:{agent_name}:inbox"
        messages = []

        if timeout > 0:
            # Blocking pop with timeout
            result = self.redis_conn.blpop(inbox_key, timeout=timeout)
            if result:
                messages.append(json.loads(result[1]))
        else:
            # Drain all pending messages
            while True:
                raw = self.redis_conn.lpop(inbox_key)
                if raw is None:
                    break
                messages.append(json.loads(raw))

        return messages

    def receive_one(self, agent_name: str, timeout: int = 5) -> Optional[Dict[str, Any]]:
        """Blocking receive of a single message with timeout."""
        inbox_key = f"agent:{agent_name}:inbox"
        result = self.redis_conn.blpop(inbox_key, timeout=timeout)
        if result:
            return json.loads(result[1])
        return None

    # ------------------------------------------------------------------
    # DELEGATION (Orchestrator → Sub-Agent)
    # ------------------------------------------------------------------
    def delegate_task(
        self,
        db: Session,
        orchestrator_name: str,
        target_agent: str,
        sub_task_description: str,
        parent_task_id: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Delegate a sub-task from an orchestrator to a specialized agent.
        Returns the message_id of the delegation request.
        """
        content = {
            "sub_task": sub_task_description,
            "parent_task_id": parent_task_id,
            "context": context or {},
        }
        return self.send_message(
            db=db,
            sender_agent=orchestrator_name,
            receiver_agent=target_agent,
            message_type="delegate",
            content=content,
            task_id=parent_task_id,
        )

    def report_result(
        self,
        db: Session,
        agent_name: str,
        orchestrator_name: str,
        task_id: str,
        result: Dict[str, Any],
        status: str = "success",
    ) -> str:
        """
        Report sub-task results back to the orchestrator.
        """
        content = {
            "result": result,
            "status": status,
            "reporting_agent": agent_name,
        }
        return self.send_message(
            db=db,
            sender_agent=agent_name,
            receiver_agent=orchestrator_name,
            message_type="result",
            content=content,
            task_id=task_id,
        )

    # ------------------------------------------------------------------
    # BROADCAST
    # ------------------------------------------------------------------
    def broadcast(
        self,
        db: Session,
        sender_agent: str,
        content: Dict[str, Any],
        task_id: str,
    ) -> str:
        """Broadcast a message to all agents via the broadcast channel."""
        message_id = str(uuid.uuid4())
        message = {
            "message_id": message_id,
            "sender_agent": sender_agent,
            "message_type": "broadcast",
            "content": content,
            "task_id": task_id,
            "timestamp": time.time(),
        }
        self.redis_conn.publish("agent:broadcast", json.dumps(message))

        self._emit_event("AGENT_BROADCAST", {
            "message_id": message_id,
            "sender": sender_agent,
            "task_id": task_id,
        })

        print(f"[CommBus] {sender_agent} → BROADCAST (msg: {message_id[:8]}...)")
        return message_id

    # ------------------------------------------------------------------
    # SHARED CONTEXT (Task-Scoped Scratchpad)
    # ------------------------------------------------------------------
    def set_shared_context(self, task_id: str, key: str, value: Any):
        """Store a value in the task-scoped shared context."""
        context_key = f"task:{task_id}:context"
        current = self.redis_conn.hget(context_key, "__all__")
        ctx = json.loads(current) if current else {}
        ctx[key] = value
        self.redis_conn.hset(context_key, "__all__", json.dumps(ctx))
        # Set TTL of 1 hour for cleanup
        self.redis_conn.expire(context_key, 3600)

    def get_shared_context(self, task_id: str) -> Dict[str, Any]:
        """Retrieve the full task-scoped shared context."""
        context_key = f"task:{task_id}:context"
        raw = self.redis_conn.hget(context_key, "__all__")
        return json.loads(raw) if raw else {}

    def get_shared_context_value(self, task_id: str, key: str) -> Any:
        """Retrieve a single value from the shared context."""
        ctx = self.get_shared_context(task_id)
        return ctx.get(key)

    # ------------------------------------------------------------------
    # AGENT INBOX STATUS
    # ------------------------------------------------------------------
    def get_inbox_size(self, agent_name: str) -> int:
        """Get the number of pending messages in an agent's inbox."""
        inbox_key = f"agent:{agent_name}:inbox"
        return self.redis_conn.llen(inbox_key)

    def get_all_agent_inbox_sizes(self, agent_names: List[str]) -> Dict[str, int]:
        """Get inbox sizes for multiple agents."""
        return {name: self.get_inbox_size(name) for name in agent_names}

    # ------------------------------------------------------------------
    # WAIT FOR RESULT
    # ------------------------------------------------------------------
    def wait_for_result(
        self,
        agent_name: str,
        task_id: str,
        timeout: int = 30,
    ) -> Optional[Dict[str, Any]]:
        """
        Wait for a result message for a specific task.
        Polls the agent's inbox and filters by task_id and message_type='result'.
        """
        result_key = f"agent:{agent_name}:result:{task_id}"
        
        # Check if result was already posted
        cached = self.redis_conn.get(result_key)
        if cached:
            return json.loads(cached)

        # Poll inbox with timeout
        deadline = time.time() + timeout
        while time.time() < deadline:
            msg = self.receive_one(agent_name, timeout=1)
            if msg and msg.get("task_id") == task_id and msg.get("message_type") == "result":
                # Cache the result for fast re-access
                self.redis_conn.setex(result_key, 300, json.dumps(msg))
                return msg
            elif msg:
                # Not the message we want, put it back
                inbox_key = f"agent:{agent_name}:inbox"
                self.redis_conn.rpush(inbox_key, json.dumps(msg))
            time.sleep(0.1)
        
        return None

    # ------------------------------------------------------------------
    # INTERNAL
    # ------------------------------------------------------------------
    def _emit_event(self, event_type: str, data: dict):
        event = {
            "event_type": event_type,
            "timestamp": time.time(),
            **data,
        }
        self.redis_conn.publish(self.event_channel, json.dumps(event))


# Singleton instance
comm_bus = AgentCommunicationBus()
