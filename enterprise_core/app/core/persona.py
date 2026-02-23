from pydantic import BaseModel
from typing import List, Dict, Optional
import yaml
import json

class ToolDefinition(BaseModel):
    name: str
    description: str
    parameters: Dict

class Persona(BaseModel):
    name: str
    role: str
    capabilities: List[str]
    tools: List[str]
    system_prompt_template: str = """
You are {name}, a {role}.
Your capabilities are: {capabilities}.
You are operating in the context of tenant: {tenant_id}.

Available Tools:
{tool_definitions}

Task: {task}

You must respond with a JSON object strictly following this schema:
{{
  "selected_tool": "string (name of the tool to use, or 'final_answer' if done)",
  "reasoning": "string (why you chose this tool)",
  "parameters": {{ ... }} (dictionary of parameters for the tool)
}}
"""

    def construct_prompt(self, task: str, tenant_id: str, tool_registry: Dict[str, ToolDefinition]) -> str:
        # Resolve tool definitions
        available_tools = [tool_registry[t] for t in self.tools if t in tool_registry]
        tool_desc_str = json.dumps([t.dict() for t in available_tools], indent=2)
        
        return self.system_prompt_template.format(
            name=self.name,
            role=self.role,
            capabilities=", ".join(self.capabilities),
            tenant_id=tenant_id,
            tool_definitions=tool_desc_str,
            task=task
        )
