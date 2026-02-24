"""
Agentic Execution Loop (ReAct Pattern)
========================================
Implements the Think → Act → Observe loop for agents.

Each step in the loop:
1. THINK — LLM reasons about the current state and decides what to do
2. ACT   — Execute a tool, delegate to a sub-agent, or produce final answer
3. OBSERVE — Capture the result and feed it back into the next thinking step

The loop continues until:
- The agent produces a 'final_answer'
- Max steps exceeded (safety limit)
- An unrecoverable error occurs
"""

import json
import time
import uuid
from typing import Dict, Any, Optional, List

from sqlalchemy.orm import Session

from enterprise_core.app import crud, schemas
from enterprise_core.app.core.persona import get_persona, Persona, ToolDefinition
from enterprise_core.app.services.llm import llm_client
from common.tools import tool_registry
import redis


class ExecutionStep:
    """Represents one step in the ReAct execution loop."""

    def __init__(
        self,
        step_number: int,
        thought: str = "",
        action: str = "",
        action_detail: str = "",
        observation: str = "",
        duration_ms: int = 0,
    ):
        self.step_number = step_number
        self.thought = thought
        self.action = action
        self.action_detail = action_detail
        self.observation = observation
        self.duration_ms = duration_ms

    def to_dict(self) -> Dict[str, Any]:
        return {
            "step": self.step_number,
            "thought": self.thought,
            "action": self.action,
            "action_detail": self.action_detail,
            "observation": self.observation,
            "duration_ms": self.duration_ms,
        }


class AgenticExecutionLoop:
    """
    ReAct-style execution loop for AI agents.
    
    Flow:
    1. Load persona for the agent
    2. Build initial prompt with task + tool definitions
    3. Loop: Think → Act → Observe
    4. Track all steps in reasoning trace (DB)
    5. Return final result with full execution trace
    """

    def __init__(self, redis_url: str = "redis://redis:6379/0"):
        self.redis_conn = redis.Redis.from_url(redis_url, decode_responses=True)
        self.event_channel = "events"
        print("[ExecLoop] Agentic Execution Loop initialized.")

    def execute(
        self,
        db: Session,
        task_id: str,
        task_description: str,
        persona_name: str,
        tenant_id: str = "default",
        parent_task_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute a task using the ReAct agentic loop.
        
        Returns:
        {
            "status": "success" | "failure",
            "final_answer": str,
            "steps": [ExecutionStep, ...],
            "total_steps": int,
            "total_duration_ms": int,
            "tools_used": [str],
            "model_used": str,
            "token_usage": int,
            "estimated_cost": float,
        }
        """
        start_time = time.time()
        persona = get_persona(persona_name)
        if not persona:
            return self._error_result(f"Persona '{persona_name}' not found")

        # Create agent state for tracking
        try:
            state = schemas.AgentStateCreate(
                task_id=task_id,
                agent_name=persona_name,
                max_steps=persona.max_reasoning_steps,
            )
            crud.create_agent_state(db, state)
        except Exception:
            pass  # State may already exist for retries

        # Build tool definitions from registry
        tool_defs = self._build_tool_definitions(persona)

        # Execution trace
        steps: List[ExecutionStep] = []
        reasoning_history: List[Dict[str, Any]] = []
        tools_used: List[str] = []
        total_tokens = 0
        total_cost = 0.0
        model_used = "unknown"
        final_answer = ""

        self._emit_event("EXEC_LOOP_STARTED", {
            "task_id": task_id,
            "persona_name": persona_name,
            "max_steps": persona.max_reasoning_steps,
        })

        # --- MAIN REACT LOOP ---
        for step_num in range(1, persona.max_reasoning_steps + 1):
            step_start = time.time()

            # Update state
            crud.update_agent_state(db, task_id, schemas.AgentStateUpdate(
                current_step=step_num,
                status="thinking",
            ))

            self._emit_event("EXEC_STEP_THINKING", {
                "task_id": task_id,
                "step": step_num,
                "persona_name": persona_name,
            })

            # 1. THINK — Ask LLM what to do
            prompt = persona.construct_prompt(
                task=task_description,
                tenant_id=tenant_id,
                tool_registry=tool_defs,
                reasoning_history=reasoning_history,
            )

            # Include context from parent task if available
            if context:
                prompt += f"\n\nAdditional context from orchestrator:\n{json.dumps(context, indent=2)}"

            llm_response = llm_client.generate_decision(prompt)
            model_used = llm_response.get("_provider", "mock")
            total_tokens += llm_response.get("_tokens", 0)
            total_cost += llm_response.get("_cost", 0.0)

            thought = llm_response.get("thought", "Processing...")
            action = llm_response.get("action", "final_answer")

            step = ExecutionStep(step_number=step_num, thought=thought, action=action)

            # 2. ACT — Execute the decided action

            if action == "use_tool":
                # --- TOOL EXECUTION ---
                tool_name = llm_response.get("tool_name", "")
                parameters = llm_response.get("parameters", {})
                step.action_detail = f"tool:{tool_name}"
                tools_used.append(tool_name)

                crud.update_agent_state(db, task_id, schemas.AgentStateUpdate(status="acting"))
                self._emit_event("EXEC_STEP_ACTING", {
                    "task_id": task_id,
                    "step": step_num,
                    "tool_name": tool_name,
                })

                try:
                    result = tool_registry.execute(tool_name, parameters)
                    observation = json.dumps(result) if isinstance(result, dict) else str(result)
                    step.observation = observation
                except Exception as e:
                    step.observation = f"ERROR: Tool '{tool_name}' failed: {str(e)}"

            elif action == "delegate":
                # --- DELEGATION TO SUB-AGENT ---
                delegate_to = llm_response.get("delegate_to", "")
                delegate_task = llm_response.get("delegate_task", task_description)
                step.action_detail = f"delegate:{delegate_to}"

                crud.update_agent_state(db, task_id, schemas.AgentStateUpdate(status="delegating"))
                self._emit_event("EXEC_STEP_DELEGATING", {
                    "task_id": task_id,
                    "step": step_num,
                    "delegate_to": delegate_to,
                    "delegate_task": delegate_task,
                })

                # Execute sub-task inline (recursive call)
                sub_task_id = str(uuid.uuid4())
                sub_log = schemas.TaskLogCreate(
                    task_id=sub_task_id,
                    agent_name=delegate_to,
                    business_unit=tenant_id,
                    status="QUEUED",
                    request_payload=json.dumps({"task": delegate_task, "source": "delegation"}),
                    parent_task_id=task_id,
                    depth=(crud.get_task_log_by_id(db, task_id).depth + 1) if crud.get_task_log_by_id(db, task_id) else 1,
                    delegated_by=persona_name,
                )
                crud.create_task_log(db, sub_log)

                # Recursive execution of sub-task
                sub_result = self.execute(
                    db=db,
                    task_id=sub_task_id,
                    task_description=delegate_task,
                    persona_name=delegate_to,
                    tenant_id=tenant_id,
                    parent_task_id=task_id,
                    context=context,
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

                # Add sub-result tokens/cost to this task's totals
                total_tokens += sub_result.get("token_usage", 0)
                total_cost += sub_result.get("estimated_cost", 0.0)

                observation = f"Sub-agent '{delegate_to}' result: {sub_result.get('final_answer', json.dumps(sub_result))}"
                step.observation = observation

            elif action == "final_answer":
                # --- FINAL ANSWER ---
                final_answer = llm_response.get("final_answer", "Task completed.")
                step.action_detail = "final_answer"
                step.observation = final_answer

                crud.update_agent_state(db, task_id, schemas.AgentStateUpdate(status="complete"))
                self._emit_event("EXEC_STEP_FINAL", {
                    "task_id": task_id,
                    "step": step_num,
                    "persona_name": persona_name,
                })

            else:
                step.action_detail = f"unknown_action:{action}"
                step.observation = f"Unknown action '{action}', treating as final answer."
                final_answer = llm_response.get("final_answer", "Task processed.")

            # 3. OBSERVE — Record the step
            step.duration_ms = int((time.time() - step_start) * 1000)
            steps.append(step)

            # Persist reasoning step
            crud.append_reasoning_step(db, task_id, step.to_dict())
            reasoning_history.append(step.to_dict())

            self._emit_event("EXEC_STEP_OBSERVED", {
                "task_id": task_id,
                "step": step_num,
                "action": action,
                "observation": step.observation[:200],
            })

            # Exit if we got a final answer
            if action == "final_answer" or (action not in ["use_tool", "delegate"]):
                break

        # --- LOOP COMPLETE ---
        total_duration_ms = int((time.time() - start_time) * 1000)

        # If we exhausted steps without a final answer, construct one from observations
        if not final_answer:
            observations = [s.observation for s in steps if s.observation]
            final_answer = f"Completed {len(steps)} steps. Results: " + "; ".join(observations[-3:])

        self._emit_event("EXEC_LOOP_COMPLETED", {
            "task_id": task_id,
            "persona_name": persona_name,
            "total_steps": len(steps),
            "total_duration_ms": total_duration_ms,
            "tools_used": tools_used,
        })

        return {
            "status": "success",
            "final_answer": final_answer,
            "steps": [s.to_dict() for s in steps],
            "total_steps": len(steps),
            "total_duration_ms": total_duration_ms,
            "tools_used": tools_used,
            "model_used": model_used,
            "token_usage": total_tokens,
            "estimated_cost": round(total_cost, 6),
        }

    # ------------------------------------------------------------------
    # HELPERS
    # ------------------------------------------------------------------
    def _build_tool_definitions(self, persona: Persona) -> Dict[str, ToolDefinition]:
        """Build tool definitions dict from the persona's tool list."""
        tool_defs = {}
        for tool_name in persona.tools:
            try:
                reg_tool = tool_registry.get_tool_definition(tool_name)
                tool_defs[tool_name] = ToolDefinition(
                    name=reg_tool.name,
                    description=reg_tool.description,
                    parameters=reg_tool.parameters,
                )
            except ValueError:
                pass  # Tool not registered, skip
        return tool_defs

    def _error_result(self, error_msg: str) -> Dict[str, Any]:
        return {
            "status": "failure",
            "final_answer": error_msg,
            "steps": [],
            "total_steps": 0,
            "total_duration_ms": 0,
            "tools_used": [],
            "model_used": "none",
            "token_usage": 0,
            "estimated_cost": 0.0,
        }

    def _emit_event(self, event_type: str, data: dict):
        event = {
            "event_type": event_type,
            "timestamp": time.time(),
            **data,
        }
        self.redis_conn.publish(self.event_channel, json.dumps(event))
        print(f"[ExecLoop] {event_type}: task_id={data.get('task_id', 'N/A')}")


# Singleton
execution_loop = AgenticExecutionLoop()
