import redis
import json
import time
import sys
import os
import random
from sqlalchemy.orm import Session

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from enterprise_core.app import crud, schemas
from enterprise_core.app.database import SessionLocal
from common.tools import tool_registry

redis_conn = redis.Redis.from_url("redis://redis:6379/0", decode_responses=True)
print("Worker started. Listening for tasks on 'task_queue'...")

# ---------------------------------------------------------------------------
# PERSONA → TOOL ROUTING ENGINE
# ---------------------------------------------------------------------------
# Maps persona (agent) names to their available tools.
# In a production system, this would be loaded from YAML persona definitions
# and enhanced with LLM-based intent classification.
PERSONA_TOOL_MAP = {
    "Recruitment Agent": ["resume_analysis", "candidate_ranking"],
    "Manufacturing Optimization Agent": ["inventory_check", "demand_forecasting"],
    "Manufacturing Agent": ["inventory_check", "demand_forecasting"],
    "Finance Automation Agent": ["financial_forecasting", "invoice_processing", "audit_log_check"],
    "Finance Agent": ["financial_forecasting", "invoice_processing", "audit_log_check"],
    "Compliance Officer": ["email_sender", "report_generator"],
    "General Assistant": ["chat", "help"],
}

# Keyword-based intent routing (placeholder for LLM-based selection)
KEYWORD_TOOL_MAP = {
    "inventory": "inventory_check",
    "stock": "inventory_check",
    "supply": "inventory_check",
    "forecast": "financial_forecasting",
    "demand": "demand_forecasting",
    "invoice": "invoice_processing",
    "audit": "audit_log_check",
    "resume": "resume_analysis",
    "candidate": "candidate_ranking",
    "hire": "candidate_ranking",
    "recruit": "resume_analysis",
    "email": "email_sender",
    "send": "email_sender",
    "report": "report_generator",
    "generate": "report_generator",
    "help": "help",
}

def route_task(task_description: str, persona_name: str) -> dict:
    """
    Routes a natural language task to a specific tool.
    Returns: { "tool_name": str, "parameters": dict, "reasoning": str }
    """
    task_lower = task_description.lower()
    
    # Step 1: Try keyword matching against the task description
    for keyword, tool_name in KEYWORD_TOOL_MAP.items():
        if keyword in task_lower:
            # Validate that this tool is appropriate for the persona
            persona_tools = PERSONA_TOOL_MAP.get(persona_name, [])
            if persona_tools and tool_name in persona_tools:
                return {
                    "tool_name": tool_name,
                    "parameters": _build_params(tool_name, task_description),
                    "reasoning": f"Matched keyword '{keyword}' to tool '{tool_name}' (persona-validated)"
                }
            elif not persona_tools:
                # Unknown persona, allow anyway
                return {
                    "tool_name": tool_name,
                    "parameters": _build_params(tool_name, task_description),
                    "reasoning": f"Matched keyword '{keyword}' to tool '{tool_name}'"
                }
    
    # Step 2: Fall back to the first tool available for this persona
    persona_tools = PERSONA_TOOL_MAP.get(persona_name, ["chat"])
    fallback_tool = persona_tools[0] if persona_tools else "chat"
    return {
        "tool_name": fallback_tool,
        "parameters": _build_params(fallback_tool, task_description),
        "reasoning": f"No keyword match; defaulting to persona's primary tool '{fallback_tool}'"
    }

def _build_params(tool_name: str, task_description: str) -> dict:
    """
    Builds the correct parameters for a given tool based on its registration.
    Inspects the tool registry to determine what parameters are required.
    """
    try:
        tool_def = tool_registry.get_tool_definition(tool_name)
        required = tool_def.parameters.get("required", [])
        properties = tool_def.parameters.get("properties", {})
        
        params = {}
        for param_name in properties:
            # Use smart defaults based on common parameter names
            if param_name == "business_unit":
                params[param_name] = "Global Operations"
            elif param_name == "report_type":
                params[param_name] = "quarterly_summary"
            elif param_name == "candidate_name":
                params[param_name] = "Candidate from task"
            elif param_name == "recipient":
                params[param_name] = "admin@enterprise.com"
            elif param_name == "subject":
                params[param_name] = task_description[:100]
            elif param_name == "report_name":
                params[param_name] = "Enterprise Report"
            else:
                params[param_name] = task_description[:200]
        
        return params
    except Exception:
        return {}

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
            persona_name = job.get("persona_name", "General Assistant")
            task_description = job.get("task", "")
            tenant_id = job.get("tenant_id", "default")

            # --- EMIT: TASK_STARTED ---
            emit_event("TASK_STARTED", {
                "task_id": task_id,
                "persona_name": persona_name,
                "tenant_id": tenant_id
            })

            # --- ROUTE TASK TO TOOL ---
            routing_result = route_task(task_description, persona_name)
            tool_name = routing_result["tool_name"]
            parameters = routing_result["parameters"]
            reasoning = routing_result["reasoning"]

            print(f"[ROUTER] Task '{task_id}' -> Tool '{tool_name}' | Reason: {reasoning}")

            try:
                # --- EXECUTE TOOL ---
                result = tool_registry.execute(tool_name, parameters)
                duration_ms = int((time.time() - start_time) * 1000)
                
                # Simulate model usage metadata
                primary_model = random.choice(["google/gemini-3-pro", "anthropic/claude-4", "openai/gpt-5"])
                token_usage = random.randint(200, 2000)
                estimated_cost = round(token_usage * 0.00003, 4)

                # --- EMIT: TOOL_EXECUTED ---
                emit_event("TOOL_EXECUTED", {
                    "task_id": task_id,
                    "tool_name": tool_name,
                    "duration_ms": duration_ms
                })

                # --- EMIT: TASK_COMPLETED ---
                emit_event("TASK_COMPLETED", {
                    "task_id": task_id,
                    "status": "success",
                    "tool_name": tool_name,
                    "result": result
                })
                
                # --- UPDATE DATABASE ---
                log_update = schemas.TaskLogUpdate(
                    status='success',
                    response_payload=json.dumps(result),
                    duration_ms=duration_ms,
                    primary_model_used=primary_model,
                    token_usage=token_usage,
                    estimated_cost=estimated_cost
                )
                crud.update_task_log(db, task_id, log_update)
                print(f"[SUCCESS] Task '{task_id}' completed in {duration_ms}ms via '{tool_name}'")

            except Exception as e:
                duration_ms = int((time.time() - start_time) * 1000)
                error_message = str(e)

                # --- EMIT: TASK_FAILED ---
                emit_event("TASK_FAILED", {
                    "task_id": task_id,
                    "tool_name": tool_name,
                    "error": error_message
                })

                log_update = schemas.TaskLogUpdate(
                    status='failure',
                    response_payload=json.dumps({"error": error_message, "tool": tool_name, "reasoning": reasoning}),
                    duration_ms=duration_ms
                )
                crud.update_task_log(db, task_id, log_update)
                print(f"[FAILURE] Task '{task_id}' failed: {error_message}")

        except Exception as e:
            print(f"[ERROR] Unexpected error in worker loop: {e}")
            time.sleep(1)
        finally:
            next(db_gen, None)

if __name__ == "__main__":
    main()
