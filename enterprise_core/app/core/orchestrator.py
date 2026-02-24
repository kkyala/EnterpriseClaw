"""
Agent Orchestrator
===================
Master orchestrator that decomposes complex tasks and coordinates
multiple specialized agents to produce a unified result.

Flow:
1. Receive a task
2. Ask LLM to analyze complexity and decompose into sub-tasks
3. If simple: route directly to a single agent via execution loop
4. If complex: create sub-tasks, delegate to agents, collect results
5. Aggregate and summarize all sub-task results
6. Return unified result
"""

import json
import time
import uuid
from typing import Dict, Any, Optional, List

from sqlalchemy.orm import Session

from enterprise_core.app import crud, schemas
from enterprise_core.app.core.persona import get_persona, get_all_personas
from enterprise_core.app.core.execution_loop import execution_loop
from enterprise_core.app.core.communication import comm_bus
from enterprise_core.app.services.llm import llm_client
import redis


class TaskOrchestrator:
    """
    Master orchestrator for multi-agent task processing.
    
    Responsibilities:
    1. Task Analysis & Decomposition
    2. Agent Selection & Routing
    3. Sub-Task Delegation & Tracking
    4. Result Aggregation & Summarization
    5. Error Handling & Fallbacks
    """

    def __init__(self, redis_url: str = "redis://redis:6379/0"):
        self.redis_conn = redis.Redis.from_url(redis_url, decode_responses=True)
        self.event_channel = "events"
        print("[Orchestrator] Task Orchestrator initialized.")

    def process_task(
        self,
        db: Session,
        task_id: str,
        task_description: str,
        persona_name: str,
        tenant_id: str = "default",
        session_id: str = "",
        source: str = "dashboard",
    ) -> Dict[str, Any]:
        """
        Main entry point for processing a task.
        
        1. If persona_name is a specific agent → route directly
        2. If persona_name is 'Orchestrator' or task is complex → decompose
        3. Otherwise → route to the named agent
        """
        start_time = time.time()
        session_id = session_id or task_id

        self._emit_event("ORCHESTRATOR_STARTED", {
            "task_id": task_id,
            "persona_name": persona_name,
            "source": source,
        })

        # Step 1: Determine routing strategy
        if persona_name == "Orchestrator" or persona_name == "Auto":
            # Auto-routing: analyze task complexity
            result = self._orchestrate_complex(db, task_id, task_description, tenant_id, session_id)
        else:
            # Direct routing to named persona
            persona = get_persona(persona_name)
            if persona and persona.can_delegate:
                # This persona is itself an orchestrator-type
                result = self._orchestrate_complex(db, task_id, task_description, tenant_id, session_id)
            else:
                # Direct single-agent execution
                result = self._execute_single_agent(
                    db, task_id, task_description, persona_name, tenant_id
                )

        total_duration = int((time.time() - start_time) * 1000)
        result["total_duration_ms"] = total_duration

        self._emit_event("ORCHESTRATOR_COMPLETED", {
            "task_id": task_id,
            "status": result.get("status", "unknown"),
            "total_duration_ms": total_duration,
            "sub_tasks_count": len(result.get("sub_task_results", [])),
        })

        return result

    # ------------------------------------------------------------------
    # COMPLEX TASK ORCHESTRATION
    # ------------------------------------------------------------------
    def _orchestrate_complex(
        self,
        db: Session,
        task_id: str,
        task_description: str,
        tenant_id: str,
        session_id: str,
    ) -> Dict[str, Any]:
        """
        Handle a potentially complex task:
        1. Decompose using LLM
        2. If complex: delegate sub-tasks to agents
        3. If simple: route to single agent
        """
        # Get available agents
        all_personas = get_all_personas()
        agent_names = [name for name, p in all_personas.items() if not p.can_delegate]

        self._emit_event("ORCHESTRATOR_ANALYZING", {
            "task_id": task_id,
            "available_agents": agent_names,
        })

        # Ask LLM to decompose
        decomposition = llm_client.decompose_task(task_description, agent_names)

        is_complex = decomposition.get("is_complex", False)
        reasoning = decomposition.get("reasoning", "")
        sub_tasks = decomposition.get("sub_tasks", [])
        direct_agent = decomposition.get("direct_agent", "General Assistant")

        self._emit_event("ORCHESTRATOR_PLAN_READY", {
            "task_id": task_id,
            "is_complex": is_complex,
            "reasoning": reasoning,
            "sub_task_count": len(sub_tasks),
            "direct_agent": direct_agent if not is_complex else None,
        })

        if not is_complex or len(sub_tasks) == 0:
            # Simple task — route to single agent
            return self._execute_single_agent(
                db, task_id, task_description, direct_agent, tenant_id
            )

        # Complex task — orchestrate multiple sub-agents
        return self._execute_multi_agent(
            db, task_id, task_description, sub_tasks, tenant_id, session_id
        )

    # ------------------------------------------------------------------
    # SINGLE AGENT EXECUTION
    # ------------------------------------------------------------------
    def _execute_single_agent(
        self,
        db: Session,
        task_id: str,
        task_description: str,
        persona_name: str,
        tenant_id: str,
    ) -> Dict[str, Any]:
        """Execute a task with a single agent using the agentic loop."""
        self._emit_event("ORCHESTRATOR_SINGLE_AGENT", {
            "task_id": task_id,
            "agent": persona_name,
        })

        result = execution_loop.execute(
            db=db,
            task_id=task_id,
            task_description=task_description,
            persona_name=persona_name,
            tenant_id=tenant_id,
        )

        return {
            "status": result.get("status", "success"),
            "summary": result.get("final_answer", ""),
            "execution_mode": "single_agent",
            "agent_name": persona_name,
            "sub_task_results": [],
            "execution_trace": result.get("steps", []),
            "model_used": result.get("model_used", ""),
            "token_usage": result.get("token_usage", 0),
            "estimated_cost": result.get("estimated_cost", 0.0),
        }

    # ------------------------------------------------------------------
    # MULTI-AGENT ORCHESTRATION
    # ------------------------------------------------------------------
    def _execute_multi_agent(
        self,
        db: Session,
        task_id: str,
        task_description: str,
        sub_tasks: List[Dict[str, Any]],
        tenant_id: str,
        session_id: str,
    ) -> Dict[str, Any]:
        """
        Execute a complex task by delegating sub-tasks to multiple agents.
        
        Currently executes sub-tasks sequentially (can be enhanced to parallel).
        Each sub-task gets its own task_id with parent_task_id tracking.
        """
        self._emit_event("ORCHESTRATOR_MULTI_AGENT", {
            "task_id": task_id,
            "sub_task_count": len(sub_tasks),
            "agents": [st.get("target_agent") for st in sub_tasks],
        })

        sub_task_results = []
        total_tokens = 0
        total_cost = 0.0
        all_models = set()

        # Store shared context for sub-agents
        comm_bus.set_shared_context(task_id, "original_task", task_description)
        comm_bus.set_shared_context(task_id, "tenant_id", tenant_id)

        for i, sub_task_spec in enumerate(sub_tasks):
            sub_task_desc = sub_task_spec.get("sub_task_description", "")
            target_agent = sub_task_spec.get("target_agent", "General Assistant")
            priority = sub_task_spec.get("priority", i + 1)
            sub_task_id = str(uuid.uuid4())

            self._emit_event("ORCHESTRATOR_SUB_TASK_STARTED", {
                "task_id": task_id,
                "sub_task_id": sub_task_id,
                "sub_task_number": i + 1,
                "target_agent": target_agent,
                "description": sub_task_desc[:200],
            })

            # Create sub-task log
            parent_log = crud.get_task_log_by_id(db, task_id)
            parent_depth = parent_log.depth if parent_log else 0

            sub_log = schemas.TaskLogCreate(
                task_id=sub_task_id,
                agent_name=target_agent,
                business_unit=tenant_id,
                status="QUEUED",
                request_payload=json.dumps({
                    "task": sub_task_desc,
                    "source": "orchestrator",
                    "parent_task_id": task_id,
                }),
                parent_task_id=task_id,
                depth=parent_depth + 1,
                delegated_by="Orchestrator",
            )
            crud.create_task_log(db, sub_log)

            # Send delegation message via communication bus
            comm_bus.delegate_task(
                db=db,
                orchestrator_name="Orchestrator",
                target_agent=target_agent,
                sub_task_description=sub_task_desc,
                parent_task_id=task_id,
                context={"priority": priority, "sub_task_number": i + 1},
            )

            # Execute sub-task via the agentic loop
            sub_result = execution_loop.execute(
                db=db,
                task_id=sub_task_id,
                task_description=sub_task_desc,
                persona_name=target_agent,
                tenant_id=tenant_id,
                parent_task_id=task_id,
            )

            # Update sub-task log
            sub_update = schemas.TaskLogUpdate(
                status=sub_result.get("status", "success"),
                response_payload=json.dumps(sub_result),
                duration_ms=sub_result.get("total_duration_ms", 0),
                primary_model_used=sub_result.get("model_used", ""),
                token_usage=sub_result.get("token_usage", 0),
                estimated_cost=sub_result.get("estimated_cost", 0.0),
            )
            crud.update_task_log(db, sub_task_id, sub_update)

            # Report result back via communication bus
            comm_bus.report_result(
                db=db,
                agent_name=target_agent,
                orchestrator_name="Orchestrator",
                task_id=task_id,
                result=sub_result,
                status=sub_result.get("status", "success"),
            )

            # Store sub-result in shared context
            comm_bus.set_shared_context(
                task_id,
                f"sub_result_{i + 1}_{target_agent}",
                sub_result.get("final_answer", ""),
            )

            # Accumulate metrics
            total_tokens += sub_result.get("token_usage", 0)
            total_cost += sub_result.get("estimated_cost", 0.0)
            all_models.add(sub_result.get("model_used", "unknown"))

            sub_task_results.append({
                "sub_task_id": sub_task_id,
                "agent": target_agent,
                "description": sub_task_desc,
                "status": sub_result.get("status", ""),
                "result": sub_result.get("final_answer", ""),
                "steps": sub_result.get("total_steps", 0),
                "duration_ms": sub_result.get("total_duration_ms", 0),
            })

            self._emit_event("ORCHESTRATOR_SUB_TASK_COMPLETED", {
                "task_id": task_id,
                "sub_task_id": sub_task_id,
                "sub_task_number": i + 1,
                "target_agent": target_agent,
                "status": sub_result.get("status", ""),
            })

        # --- AGGREGATE RESULTS ---
        self._emit_event("ORCHESTRATOR_AGGREGATING", {
            "task_id": task_id,
            "sub_task_count": len(sub_task_results),
        })

        # Summarize all sub-task results
        summary = llm_client.summarize_results(task_description, sub_task_results)
        total_tokens += 100  # Rough estimate for summarization

        overall_status = "success" if all(
            r["status"] == "success" for r in sub_task_results
        ) else "partial_success"

        return {
            "status": overall_status,
            "summary": summary,
            "execution_mode": "multi_agent",
            "agent_name": "Orchestrator",
            "sub_task_results": sub_task_results,
            "execution_trace": [],
            "model_used": ", ".join(all_models),
            "token_usage": total_tokens,
            "estimated_cost": round(total_cost, 6),
        }

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
        print(f"[Orchestrator] {event_type}: task_id={data.get('task_id', 'N/A')}")


# Singleton
orchestrator = TaskOrchestrator()
