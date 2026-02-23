from pydantic import BaseModel
from typing import Dict, Callable, Any

class ToolDefinition(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any]

class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, ToolDefinition] = {}
        self._tool_implementations: Dict[str, Callable] = {}

    def register(self, name: str, description: str, parameters: Dict[str, Any], implementation: Callable):
        if name in self._tools:
            raise ValueError(f"Tool '{name}' is already registered.")
        
        self._tools[name] = ToolDefinition(name=name, description=description, parameters=parameters)
        self._tool_implementations[name] = implementation
        print(f"Registered tool: {name}")

    def get_tool_definition(self, name: str) -> ToolDefinition:
        if name not in self._tools:
            raise ValueError(f"Tool '{name}' not found.")
        return self._tools[name]

    def get_all_definitions(self) -> Dict[str, ToolDefinition]:
        return self._tools

    def execute(self, name: str, params: Dict[str, Any]) -> Any:
        if name not in self._tool_implementations:
            raise ValueError(f"Tool implementation for '{name}' not found.")
        
        # Simple parameter validation (can be improved with Pydantic models per tool)
        required_params = self._tools[name].parameters.get("required", [])
        for p in required_params:
            if p not in params:
                raise ValueError(f"Missing required parameter '{p}' for tool '{name}'.")

        print(f"Executing tool '{name}' with params: {params}")
        return self._tool_implementations[name](**params)

# --- Example Tool Implementations ---
def inventory_check(business_unit: str) -> Dict[str, Any]:
    # In a real scenario, this would query a database or another service.
    print(f"Performing inventory check for BU: {business_unit}")
    if business_unit.lower() == "global recruitment":
        return {"status": "ok", "stock_level": 1000, "compliance_status": "good"}
    else:
        return {"status": "warning", "stock_level": 50, "compliance_status": "needs_review"}

def review_quarterly_reports(report_type: str) -> Dict[str, Any]:
    # In a real scenario, this would fetch and process a file.
    print(f"Reviewing quarterly reports of type: {report_type}")
    report_path = f"reports/review_the_{report_type}_report.txt"
    # Placeholder for file content
    with open(report_path, "w") as f:
        f.write("Report generated successfully.")
    return {"status": "success", "message": f"Report generated successfully: {report_path}"}


# --- Instantiate and Register Tools ---
tool_registry = ToolRegistry()

# General/Finance Tools
tool_registry.register(
    name="inventory_check",
    description="Checks inventory levels and compliance status.",
    parameters={"type": "object", "properties": {"business_unit": {"type": "string"}}, "required": ["business_unit"]},
    implementation=inventory_check
)
tool_registry.register(
    name="review_quarterly_reports",
    description="Generates and reviews the quarterly financial reports.",
    parameters={"type": "object", "properties": {"report_type": {"type": "string"}}, "required": ["report_type"]},
    implementation=review_quarterly_reports
)
tool_registry.register(
    name="demand_forecasting",
    description="Forecasts product demand based on historical data.",
    parameters={},
    implementation=lambda: {"status": "success", "message": "Demand forecast generated."}
)
tool_registry.register(
    name="financial_forecasting",
    description="Forecasts future financial performance.",
    parameters={},
    implementation=lambda: {"status": "success", "message": "Financial forecast generated."}
)
tool_registry.register(
    name="invoice_processing",
    description="Processes and categorizes invoices.",
    parameters={},
    implementation=lambda: {"status": "success", "message": "Invoices processed."}
)
tool_registry.register(
    name="audit_log_check",
    description="Checks audit logs for anomalies.",
    parameters={},
    implementation=lambda: {"status": "success", "message": "Audit logs checked, no anomalies found."}
)

# Recruitment Tools
tool_registry.register(
    name="resume_analysis",
    description="Analyzes a candidate's resume for key skills.",
    parameters={"type": "object", "properties": {"candidate_name": {"type": "string"}}},
    implementation=lambda candidate_name: {"status": "success", "message": f"Resume for {candidate_name} analyzed."}
)
tool_registry.register(
    name="candidate_ranking",
    description="Ranks candidates based on job requirements.",
    parameters={},
    implementation=lambda: {"status": "success", "message": "Candidates ranked successfully."}
)

# Compliance Tools
tool_registry.register(
    name="email_sender",
    description="Sends an email notification.",
    parameters={"type": "object", "properties": {"recipient": {"type": "string"}, "subject": {"type": "string"}}},
    implementation=lambda recipient, subject: {"status": "success", "message": f"Email sent to {recipient} with subject '{subject}'."}
)
tool_registry.register(
    name="report_generator",
    description="Generates a PDF report.",
    parameters={"type": "object", "properties": {"report_name": {"type": "string"}}},
    implementation=lambda report_name: {"status": "success", "message": f"Report '{report_name}.pdf' generated."}
)

# General Assistant Tools
tool_registry.register(
    name="chat",
    description="General chat function.",
    parameters={},
    implementation=lambda: {"status": "success", "message": "Hello! How can I help you?"}
)
tool_registry.register(
    name="help",
    description="Provides help on available tools.",
    parameters={},
    implementation=lambda: {"status": "success", "message": "You can ask me to perform tasks related to finance, recruitment, and compliance."}
)

