"""
Persona System
===============
Defines AI agent personas with system prompts, tool bindings, and capabilities.
Personas can be loaded from code or (in future) from YAML definitions.

Each persona defines:
- Identity (name, role, description)
- Capabilities (what the agent can do)
- Tool bindings (which tools the agent has access to)
- System prompt template (how the agent thinks and responds)
- Sub-agent awareness (can this agent delegate?)
"""

from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import json


class ToolDefinition(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any] = {}


class Persona(BaseModel):
    name: str
    role: str
    description: str = ""
    capabilities: List[str] = []
    tools: List[str] = []
    can_delegate: bool = False  # Whether this agent can delegate to sub-agents
    delegation_targets: List[str] = []  # Agents this persona can delegate to
    max_reasoning_steps: int = 5

    system_prompt_template: str = """You are {name}, a {role}.
Your capabilities are: {capabilities}.
You are operating in the context of tenant: {tenant_id}.

{delegation_instructions}

Available Tools:
{tool_definitions}

Task: {task}

Previous reasoning steps:
{reasoning_history}

You must respond with a JSON object strictly following this schema:
{{
  "thought": "string (your reasoning about what to do next)",
  "action": "string (one of: 'use_tool', 'delegate', 'final_answer')",
  "tool_name": "string (name of the tool to use, required if action='use_tool')",
  "delegate_to": "string (agent name, required if action='delegate')",
  "delegate_task": "string (sub-task description, required if action='delegate')",
  "parameters": {{ ... }},
  "final_answer": "string (your final response, required if action='final_answer')"
}}
"""

    def construct_prompt(
        self,
        task: str,
        tenant_id: str,
        tool_registry: Dict[str, ToolDefinition],
        reasoning_history: List[Dict[str, Any]] = None,
    ) -> str:
        """Build the full system prompt for the LLM."""
        # Resolve tool definitions
        available_tools = [tool_registry[t] for t in self.tools if t in tool_registry]
        tool_desc_str = json.dumps([t.dict() for t in available_tools], indent=2)

        # Build delegation instructions if applicable
        delegation_instructions = ""
        if self.can_delegate and self.delegation_targets:
            delegation_instructions = (
                f"You can delegate sub-tasks to these specialized agents: "
                f"{', '.join(self.delegation_targets)}.\n"
                f"Use action='delegate' when a sub-task falls outside your expertise "
                f"or when parallel specialization would be more efficient."
            )

        # Build reasoning history string
        history_str = "None (this is the first step)"
        if reasoning_history:
            history_lines = []
            for i, step in enumerate(reasoning_history):
                thought = step.get("thought", "")
                action = step.get("action", "")
                observation = step.get("observation", "")
                history_lines.append(
                    f"Step {i + 1}: Thought: {thought} | Action: {action} | Observation: {observation}"
                )
            history_str = "\n".join(history_lines)

        return self.system_prompt_template.format(
            name=self.name,
            role=self.role,
            capabilities=", ".join(self.capabilities),
            tenant_id=tenant_id,
            delegation_instructions=delegation_instructions,
            tool_definitions=tool_desc_str,
            task=task,
            reasoning_history=history_str,
        )


# ---------------------------------------------------------------------------
# PERSONA REGISTRY — All built-in personas
# ---------------------------------------------------------------------------
PERSONA_REGISTRY: Dict[str, Persona] = {}


def _register_personas():
    """Register all built-in personas."""
    personas = [
        Persona(
            name="Orchestrator",
            role="Master Task Orchestrator",
            description="Decomposes complex tasks into sub-tasks and delegates to specialized agents.",
            capabilities=[
                "task decomposition",
                "multi-agent coordination",
                "result aggregation",
                "workflow planning",
            ],
            tools=["chat"],
            can_delegate=True,
            delegation_targets=[
                "Recruitment Agent",
                "Manufacturing Optimization Agent",
                "Finance Automation Agent",
                "Compliance Officer",
                "General Assistant",
            ],
            max_reasoning_steps=10,
        ),
        Persona(
            name="Recruitment Agent",
            role="Enterprise Recruitment Specialist",
            description="Expert in hiring, candidate screening, resume parsing, and talent acquisition.",
            capabilities=[
                "resume analysis",
                "candidate ranking",
                "interview scheduling",
                "talent pipeline management",
            ],
            tools=["resume_analysis", "candidate_ranking"],
            can_delegate=False,
            max_reasoning_steps=5,
        ),
        Persona(
            name="Manufacturing Optimization Agent",
            role="Manufacturing & Supply Chain Expert",
            description="Expert in inventory management, supply chain optimization, and production planning.",
            capabilities=[
                "inventory auditing",
                "demand forecasting",
                "supply chain optimization",
                "production scheduling",
            ],
            tools=["inventory_check", "demand_forecasting"],
            can_delegate=False,
            max_reasoning_steps=5,
        ),
        Persona(
            name="Manufacturing Agent",
            role="Manufacturing & Supply Chain Expert",
            description="Expert in inventory management, supply chain optimization, and production planning.",
            capabilities=[
                "inventory auditing",
                "demand forecasting",
                "supply chain optimization",
            ],
            tools=["inventory_check", "demand_forecasting"],
            can_delegate=False,
            max_reasoning_steps=5,
        ),
        Persona(
            name="Finance Automation Agent",
            role="Enterprise Finance Specialist",
            description="Expert in financial forecasting, auditing, invoice processing, and compliance.",
            capabilities=[
                "financial forecasting",
                "invoice processing",
                "audit log analysis",
                "cost optimization",
            ],
            tools=["financial_forecasting", "invoice_processing", "audit_log_check"],
            can_delegate=False,
            max_reasoning_steps=5,
        ),
        Persona(
            name="Finance Agent",
            role="Enterprise Finance Specialist",
            description="Expert in financial forecasting, auditing, and invoice processing.",
            capabilities=[
                "financial forecasting",
                "invoice processing",
                "audit log analysis",
            ],
            tools=["financial_forecasting", "invoice_processing", "audit_log_check"],
            can_delegate=False,
            max_reasoning_steps=5,
        ),
        Persona(
            name="Compliance Officer",
            role="Enterprise Compliance Officer",
            description="Reviews documents for policy violations and generates compliance reports.",
            capabilities=[
                "policy review",
                "compliance reporting",
                "email notifications",
                "document auditing",
            ],
            tools=["email_sender", "report_generator"],
            can_delegate=False,
            max_reasoning_steps=5,
        ),
        Persona(
            name="General Assistant",
            role="General Purpose AI Assistant",
            description="Handles general queries, provides help, and routes users to specialized agents.",
            capabilities=[
                "general conversation",
                "tool guidance",
                "task routing assistance",
            ],
            tools=["chat", "help"],
            can_delegate=False,
            max_reasoning_steps=3,
        ),
    ]

    for p in personas:
        PERSONA_REGISTRY[p.name] = p


# Initialize on import
_register_personas()


def get_persona(name: str) -> Optional[Persona]:
    """Get a persona by name. Falls back to General Assistant."""
    return PERSONA_REGISTRY.get(name, PERSONA_REGISTRY.get("General Assistant"))


def get_all_personas() -> Dict[str, Persona]:
    """Get all registered personas."""
    return PERSONA_REGISTRY


def register_persona(persona: Persona):
    """Register a new persona dynamically."""
    PERSONA_REGISTRY[persona.name] = persona
    print(f"[Persona] Registered persona: {persona.name}")
