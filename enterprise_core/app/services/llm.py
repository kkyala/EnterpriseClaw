"""
LLM Service
============
Multi-provider LLM client supporting structured JSON responses.

Supports:
- Google Gemini (primary)
- Anthropic Claude (fallback)
- OpenAI GPT (fallback)
- Mock mode for testing without API keys

The LLM is used for:
1. Intent classification (routing tasks to the right tool)
2. ReAct reasoning (think → act → observe loop)
3. Task decomposition (orchestrator breaking down complex tasks)
4. Result summarization
"""

import json
import os
import re
import random
import time
from typing import Dict, Any, Optional, List

# Attempt to import LLM provider libraries (graceful degradation)
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


class LLMClient:
    """
    Multi-provider LLM client with automatic fallback.
    
    Priority order:
    1. Google Gemini (if GOOGLE_API_KEY set)
    2. OpenAI GPT (if OPENAI_API_KEY set)
    3. Mock mode (always available)
    """

    def __init__(self):
        self.google_api_key = os.getenv("GOOGLE_API_KEY", "")
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        self.default_provider = os.getenv("LLM_PROVIDER", "mock")  # "gemini", "openai", "mock"
        self.total_tokens_used = 0
        self.total_cost = 0.0

        # Initialize providers
        if GEMINI_AVAILABLE and self.google_api_key:
            genai.configure(api_key=self.google_api_key)
            self.default_provider = "gemini"
            print("[LLM] Initialized Google Gemini provider")
        elif OPENAI_AVAILABLE and self.openai_api_key:
            self.openai_client = openai.OpenAI(api_key=self.openai_api_key)
            self.default_provider = "openai"
            print("[LLM] Initialized OpenAI provider")
        else:
            self.default_provider = "mock"
            print("[LLM] Running in MOCK mode (no API keys configured)")

    def generate_decision(
        self,
        prompt: str,
        provider: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Send a prompt to the LLM and get a structured JSON decision.
        
        Returns a dict with at minimum:
        - thought: reasoning
        - action: 'use_tool' | 'delegate' | 'final_answer'
        - (optional) tool_name, parameters, delegate_to, delegate_task, final_answer
        
        Also returns metadata:
        - _provider: which provider was used
        - _tokens: estimated token usage
        - _cost: estimated cost
        - _latency_ms: response time
        """
        selected_provider = provider or self.default_provider
        start_time = time.time()

        try:
            if selected_provider == "gemini" and GEMINI_AVAILABLE and self.google_api_key:
                result = self._call_gemini(prompt)
            elif selected_provider == "openai" and OPENAI_AVAILABLE and self.openai_api_key:
                result = self._call_openai(prompt)
            else:
                result = self._call_mock(prompt)
        except Exception as e:
            print(f"[LLM] Error with provider '{selected_provider}': {e}")
            # Fallback to mock
            print(f"[LLM] Falling back to mock provider")
            result = self._call_mock(prompt)
            selected_provider = "mock (fallback)"

        latency_ms = int((time.time() - start_time) * 1000)
        tokens = result.pop("_tokens", random.randint(200, 1500))
        cost = round(tokens * 0.00003, 4)

        result["_provider"] = selected_provider
        result["_tokens"] = tokens
        result["_cost"] = cost
        result["_latency_ms"] = latency_ms

        self.total_tokens_used += tokens
        self.total_cost += cost

        return result

    def decompose_task(self, task: str, available_agents: List[str]) -> Dict[str, Any]:
        """
        Ask the LLM to decompose a complex task into sub-tasks for different agents.
        Used by the Orchestrator.
        """
        prompt = f"""You are a Task Orchestrator. Analyze the following task and determine 
if it is complex enough to require multiple agents, or if a single agent can handle it.

Available specialized agents: {json.dumps(available_agents)}

Task: {task}

Respond with JSON:
{{
  "is_complex": true/false,
  "reasoning": "why this is or isn't complex",
  "sub_tasks": [
    {{
      "sub_task_description": "specific sub-task",
      "target_agent": "agent name from the available list",
      "priority": 1
    }}
  ],
  "direct_agent": "agent name (if not complex, route to this single agent)"
}}
"""
        return self.generate_decision(prompt)

    def summarize_results(self, task: str, results: List[Dict[str, Any]]) -> str:
        """Summarize multiple sub-task results into a cohesive response."""
        prompt = f"""Summarize these results from multiple agents into a cohesive response.

Original task: {task}

Results:
{json.dumps(results, indent=2)}

Provide a clear, concise summary that addresses the original task.
Respond with JSON: {{"summary": "your summary here"}}
"""
        result = self.generate_decision(prompt)
        return result.get("summary", result.get("final_answer", json.dumps(results)))

    # ------------------------------------------------------------------
    # PROVIDER IMPLEMENTATIONS
    # ------------------------------------------------------------------
    def _call_gemini(self, prompt: str) -> Dict[str, Any]:
        """Call Google Gemini API."""
        model = genai.GenerativeModel("gemini-2.5-pro")
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        return self._parse_json_response(response.text)

    def _call_openai(self, prompt: str) -> Dict[str, Any]:
        """Call OpenAI API."""
        response = self.openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a JSON-only response agent. Always respond with valid JSON."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        return self._parse_json_response(response.choices[0].message.content)

    def _call_mock(self, prompt: str) -> Dict[str, Any]:
        """
        Intelligent mock LLM for testing without API keys.
        Uses keyword analysis to produce realistic structured responses.
        """
        prompt_lower = prompt.lower()

        # --- Task Decomposition Mock ---
        if "task orchestrator" in prompt_lower or "decompose" in prompt_lower:
            return self._mock_decomposition(prompt_lower)

        # --- Summarization Mock ---
        if "summarize" in prompt_lower:
            return {
                "summary": "Task completed successfully. All sub-tasks have been processed by their respective agents.",
                "_tokens": random.randint(100, 300),
            }

        # --- ReAct Decision Mock ---
        return self._mock_react_decision(prompt_lower)

    def _mock_decomposition(self, prompt_lower: str) -> Dict[str, Any]:
        """Mock task decomposition logic."""
        # Check for multi-domain tasks
        domains_found = []
        domain_map = {
            "recruitment": ("Recruitment Agent", "Handle recruitment-related aspects"),
            "hiring": ("Recruitment Agent", "Handle hiring-related aspects"),
            "resume": ("Recruitment Agent", "Analyze resumes"),
            "candidate": ("Recruitment Agent", "Evaluate candidates"),
            "inventory": ("Manufacturing Optimization Agent", "Check inventory levels"),
            "manufacturing": ("Manufacturing Optimization Agent", "Optimize manufacturing processes"),
            "supply": ("Manufacturing Optimization Agent", "Analyze supply chain"),
            "forecast": ("Finance Automation Agent", "Generate financial forecasts"),
            "finance": ("Finance Automation Agent", "Handle financial analysis"),
            "invoice": ("Finance Automation Agent", "Process invoices"),
            "audit": ("Finance Automation Agent", "Perform audit checks"),
            "compliance": ("Compliance Officer", "Review compliance requirements"),
            "report": ("Compliance Officer", "Generate compliance reports"),
            "email": ("Compliance Officer", "Send email notifications"),
        }

        for keyword, (agent, desc) in domain_map.items():
            if keyword in prompt_lower and agent not in [d[0] for d in domains_found]:
                domains_found.append((agent, f"{desc} for this task"))

        if len(domains_found) >= 2:
            return {
                "is_complex": True,
                "reasoning": f"Task spans {len(domains_found)} domains requiring different specialized agents.",
                "sub_tasks": [
                    {"sub_task_description": desc, "target_agent": agent, "priority": i + 1}
                    for i, (agent, desc) in enumerate(domains_found)
                ],
                "_tokens": random.randint(300, 800),
            }
        elif len(domains_found) == 1:
            return {
                "is_complex": False,
                "reasoning": "Task can be handled by a single specialized agent.",
                "direct_agent": domains_found[0][0],
                "sub_tasks": [],
                "_tokens": random.randint(200, 400),
            }
        else:
            return {
                "is_complex": False,
                "reasoning": "General task, routing to General Assistant.",
                "direct_agent": "General Assistant",
                "sub_tasks": [],
                "_tokens": random.randint(100, 300),
            }

    def _mock_react_decision(self, prompt_lower: str) -> Dict[str, Any]:
        """Mock ReAct-style decision logic."""
        # Tool selection based on keywords
        tool_keywords = {
            "inventory": ("inventory_check", {"business_unit": "Global Operations"}),
            "stock": ("inventory_check", {"business_unit": "Global Operations"}),
            "demand": ("demand_forecasting", {}),
            "forecast": ("financial_forecasting", {}),
            "invoice": ("invoice_processing", {}),
            "audit": ("audit_log_check", {}),
            "resume": ("resume_analysis", {"candidate_name": "Candidate"}),
            "candidate": ("candidate_ranking", {}),
            "email": ("email_sender", {"recipient": "admin@enterprise.com", "subject": "Notification"}),
            "report": ("report_generator", {"report_name": "Enterprise Report"}),
        }

        for keyword, (tool_name, params) in tool_keywords.items():
            if keyword in prompt_lower:
                return {
                    "thought": f"The task involves '{keyword}', which maps to the '{tool_name}' tool.",
                    "action": "use_tool",
                    "tool_name": tool_name,
                    "parameters": params,
                    "_tokens": random.randint(200, 600),
                }

        # Check if there's reasoning history suggesting we should give final answer
        if "observation:" in prompt_lower or "step 1:" in prompt_lower:
            return {
                "thought": "I have gathered enough information from previous steps. Time to provide the final answer.",
                "action": "final_answer",
                "final_answer": "Task has been processed successfully based on the gathered information.",
                "_tokens": random.randint(150, 400),
            }

        # Default: general chat
        return {
            "thought": "This is a general query. I'll provide a helpful response.",
            "action": "final_answer",
            "final_answer": "I can help you with enterprise tasks including recruitment, manufacturing, finance, and compliance. Please specify what you need!",
            "_tokens": random.randint(100, 300),
        }

    # ------------------------------------------------------------------
    # HELPERS
    # ------------------------------------------------------------------
    def _parse_json_response(self, text: str) -> Dict[str, Any]:
        """Parse JSON from LLM response, handling markdown code blocks."""
        text = text.strip()
        # Strip markdown code blocks if present
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {
                "thought": "Failed to parse LLM response as JSON.",
                "action": "final_answer",
                "final_answer": text,
            }

    def get_usage_stats(self) -> Dict[str, Any]:
        return {
            "total_tokens": self.total_tokens_used,
            "total_cost": self.total_cost,
            "provider": self.default_provider,
        }


# Singleton
llm_client = LLMClient()
