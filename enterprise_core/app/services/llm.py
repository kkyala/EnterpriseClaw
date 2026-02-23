import json

# Mock LLM Client for demonstration - strictly returns structured JSON
class LLMClient:
    def generate_decision(self, prompt: str) -> dict:
        # In a real implementation, this calls OpenAI/Anthropic API
        # For now, we simulate a response based on the prompt content
        
        print(f"--- LLM Prompt ---\n{prompt}\n------------------")
        
        # Mock logic: if prompt contains 'inventory', use inventory tool
        if "inventory" in prompt.lower():
            return {
                "selected_tool": "inventory_check",
                "reasoning": "User asked about inventory compliance, checking current stock levels.",
                "parameters": {"region": "global"}
            }
        # Mock logic: if prompt contains 'report', use report tool
        elif "report" in prompt.lower():
             return {
                "selected_tool": "generate_report",
                "reasoning": "User requested a quarterly report review.",
                "parameters": {"type": "quarterly", "year": 2026}
            }
            
        return {
            "selected_tool": "final_answer",
            "reasoning": "No specific tool needed.",
            "parameters": {"response": "I can help with that."}
        }
