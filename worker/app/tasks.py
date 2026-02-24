"""
Background Worker — Agentic Task Processor
=============================================
Listens on Redis 'task_queue' and processes tasks using the full agentic pipeline:

1. Dequeue task from Redis
2. Route through the Orchestrator (which decomposes → delegates → aggregates)
3. The Orchestrator uses the Execution Loop (ReAct: Think → Act → Observe)
4. Agents communicate via the Communication Bus
5. Results are persisted and events emitted in real-time

Optionally delivers results back to OpenClaw via callback URL.
"""

import redis
import json
import time
import sys
import os
import random
import requests
from sqlalchemy.orm import Session

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from enterprise_core.app import crud, schemas
from enterprise_core.app.database import SessionLocal
from enterprise_core.app.core.orchestrator import orchestrator
from enterprise_core.app.core.execution_loop import execution_loop
from enterprise_core.app.core.communication import comm_bus
from common.tools import tool_registry

redis_conn = redis.Redis.from_url("redis://redis:6379/0", decode_responses=True)
print("=" * 60)
print("  GENi Worker v2.0 — Agentic Task Processor")
print("  Listening for tasks on 'task_queue'...")
print("=" * 60)

# ---------------------------------------------------------------------------
# EVENT EMITTER
# ---------------------------------------------------------------------------
def emit_event(event_type: str, data: dict):
    """Publishes a structured event to the Redis Pub/Sub event bus."""
    event = {
        "event_type": event_type,
        "timestamp": time.time(),
        **data
    }
    redis_conn.publish("events", json.dumps(event))
    print(f"[EVENT] {event_type}: task_id={data.get('task_id', 'N/A')}")

# ---------------------------------------------------------------------------
# OPENCLAW CALLBACK DELIVERY
# ---------------------------------------------------------------------------
def deliver_callback(callback_url: str, task_id: str, result: dict):
    """
    Deliver task results back to OpenClaw via HTTP callback.
    This enables OpenClaw to act as a true executor, receiving results
    asynchronously and presenting them to the user.
    """
    try:
        payload = {
            "task_id": task_id,
            "status": result.get("status", "unknown"),
            "summary": result.get("summary", ""),
            "agent_name": result.get("agent_name", ""),
            "execution_mode": result.get("execution_mode", ""),
            "sub_task_count": len(result.get("sub_task_results", [])),
            "model_used": result.get("model_used", ""),
            "token_usage": result.get("token_usage", 0),
            "estimated_cost": result.get("estimated_cost", 0.0),
            "total_duration_ms": result.get("total_duration_ms", 0),
            "execution_trace": result.get("execution_trace", []),
            "sub_task_results": result.get("sub_task_results", []),
        }
        
        response = requests.post(
            callback_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        print(f"[CALLBACK] Delivered result to {callback_url} — status: {response.status_code}")
        
        emit_event("OPENCLAW_CALLBACK_SENT", {
            "task_id": task_id,
            "callback_url": callback_url,
            "http_status": response.status_code,
        })
    except Exception as e:
        print(f"[CALLBACK] Failed to deliver to {callback_url}: {e}")
        emit_event("OPENCLAW_CALLBACK_FAILED", {
            "task_id": task_id,
            "callback_url": callback_url,
            "error": str(e),
        })

# ---------------------------------------------------------------------------
# MAIN WORKER LOOP
# ---------------------------------------------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def main():
    while True:
        db_gen = get_db()
        db = next(db_gen)
        try:
            _, job_json = redis_conn.blpop("task_queue")
            job = json.loads(job_json)
            
            start_time = time.time()
            task_id = job.get("task_id")
            persona_name = job.get("persona_name", "Auto")
            task_description = job.get("task", "")
            tenant_id = job.get("tenant_id", "default")
            session_id = job.get("session_id", "")
            source = job.get("source", "dashboard")
            use_orchestrator = job.get("use_orchestrator", True)
            callback_url = job.get("callback_url")
            initiator = job.get("initiator", "")

            print(f"\n{'─' * 60}")
            print(f"[TASK] Processing task_id={task_id}")
            print(f"  Persona: {persona_name}")
            print(f"  Source:  {source}")
            print(f"  Task:    {task_description[:100]}...")
            print(f"{'─' * 60}")

            # --- EMIT: TASK_STARTED ---
            emit_event("TASK_STARTED", {
                "task_id": task_id,
                "persona_name": persona_name,
                "tenant_id": tenant_id,
                "source": source,
            })

            try:
                # --- PROCESS TASK VIA ORCHESTRATOR ---
                if use_orchestrator:
                    result = orchestrator.process_task(
                        db=db,
                        task_id=task_id,
                        task_description=task_description,
                        persona_name=persona_name,
                        tenant_id=tenant_id,
                        session_id=session_id,
                        source=source,
                    )
                else:
                    # Legacy: direct execution without orchestrator
                    result = execution_loop.execute(
                        db=db,
                        task_id=task_id,
                        task_description=task_description,
                        persona_name=persona_name,
                        tenant_id=tenant_id,
                    )

                duration_ms = int((time.time() - start_time) * 1000)
                status = result.get("status", "success")

                # --- EMIT: TASK_COMPLETED ---
                emit_event("TASK_COMPLETED", {
                    "task_id": task_id,
                    "status": status,
                    "execution_mode": result.get("execution_mode", "single_agent"),
                    "agent_name": result.get("agent_name", persona_name),
                    "duration_ms": duration_ms,
                    "sub_tasks": len(result.get("sub_task_results", [])),
                })
                
                # --- UPDATE DATABASE ---
                log_update = schemas.TaskLogUpdate(
                    status=status,
                    response_payload=json.dumps(result),
                    duration_ms=duration_ms,
                    primary_model_used=result.get("model_used", ""),
                    token_usage=result.get("token_usage", 0),
                    estimated_cost=result.get("estimated_cost", 0.0),
                )
                crud.update_task_log(db, task_id, log_update)

                # Update agent activity timestamp
                crud.update_agent_activity(db, result.get("agent_name", persona_name))

                print(f"[SUCCESS] Task '{task_id}' completed in {duration_ms}ms")
                print(f"  Mode:     {result.get('execution_mode', 'single_agent')}")
                print(f"  Agent:    {result.get('agent_name', persona_name)}")
                print(f"  SubTasks: {len(result.get('sub_task_results', []))}")
                print(f"  Tokens:   {result.get('token_usage', 0)}")

                # --- DELIVER CALLBACK TO OPENCLAW ---
                if callback_url:
                    deliver_callback(callback_url, task_id, result)

                # --- STORE IN MEMORY (for conversation context) ---
                if session_id:
                    try:
                        # Store user message
                        crud.create_memory(db, schemas.MemoryCreate(
                            agent_name=result.get("agent_name", persona_name),
                            session_id=session_id,
                            role="user",
                            content=task_description,
                        ))
                        # Store agent response
                        crud.create_memory(db, schemas.MemoryCreate(
                            agent_name=result.get("agent_name", persona_name),
                            session_id=session_id,
                            role="agent",
                            content=result.get("summary", result.get("final_answer", "")),
                        ))
                    except Exception as mem_err:
                        print(f"[WARN] Failed to store memory: {mem_err}")

            except Exception as e:
                duration_ms = int((time.time() - start_time) * 1000)
                error_message = str(e)

                # --- EMIT: TASK_FAILED ---
                emit_event("TASK_FAILED", {
                    "task_id": task_id,
                    "error": error_message,
                })

                log_update = schemas.TaskLogUpdate(
                    status='failure',
                    response_payload=json.dumps({"error": error_message}),
                    duration_ms=duration_ms,
                )
                crud.update_task_log(db, task_id, log_update)
                print(f"[FAILURE] Task '{task_id}' failed: {error_message}")

                # Deliver failure callback to OpenClaw
                if callback_url:
                    deliver_callback(callback_url, task_id, {
                        "status": "failure",
                        "summary": f"Task failed: {error_message}",
                        "agent_name": persona_name,
                    })

        except Exception as e:
            print(f"[ERROR] Unexpected error in worker loop: {e}")
            time.sleep(1)
        finally:
            next(db_gen, None)

if __name__ == "__main__":
    main()
