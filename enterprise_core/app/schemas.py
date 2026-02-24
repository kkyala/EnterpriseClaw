from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, date

# ═══════════════════════════════════════════════════════════════════════
# TOOL SCHEMAS
# ═══════════════════════════════════════════════════════════════════════

class ToolBase(BaseModel):
    name: str
    description: Optional[str] = None

class ToolCreate(ToolBase):
    category: str = "general"
    parameters_schema: Optional[str] = None
    version: str = "1.0"

class ToolUpdate(BaseModel):
    description: Optional[str] = None
    category: Optional[str] = None
    parameters_schema: Optional[str] = None
    version: Optional[str] = None
    is_active: Optional[int] = None

class Tool(ToolBase):
    id: int
    category: str = "general"
    parameters_schema: Optional[str] = None
    version: str = "1.0"
    is_active: int = 1
    model_config = ConfigDict(from_attributes=True)

# ═══════════════════════════════════════════════════════════════════════
# SKILL SCHEMAS
# ═══════════════════════════════════════════════════════════════════════

class SkillBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "general"
    proficiency_level: str = "intermediate"

class SkillCreate(SkillBase):
    parameters_schema: Optional[str] = None

class SkillUpdate(BaseModel):
    description: Optional[str] = None
    category: Optional[str] = None
    proficiency_level: Optional[str] = None
    parameters_schema: Optional[str] = None
    is_active: Optional[int] = None

class Skill(SkillBase):
    id: int
    parameters_schema: Optional[str] = None
    is_active: int = 1
    model_config = ConfigDict(from_attributes=True)

# ═══════════════════════════════════════════════════════════════════════
# AGENT GROUP SCHEMAS
# ═══════════════════════════════════════════════════════════════════════

class AgentGroupBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#4a90e2"

class AgentGroupCreate(AgentGroupBase):
    pass

class AgentGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None

class AgentGroup(AgentGroupBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# ═══════════════════════════════════════════════════════════════════════
# AGENT SCHEMAS
# ═══════════════════════════════════════════════════════════════════════

class AgentBase(BaseModel):
    name: str
    description: Optional[str] = None

class AgentCreate(AgentBase):
    tool_names: List[str] = []
    skill_names: List[str] = []
    group_name: Optional[str] = None

class Agent(AgentBase):
    id: int
    tools: List[Tool] = []
    skills: List[Skill] = []
    status: Optional[str] = "online"
    current_model: Optional[str] = None
    avg_latency_ms: Optional[int] = None
    group_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

# ═══════════════════════════════════════════════════════════════════════
# TASK LOG SCHEMAS
# ═══════════════════════════════════════════════════════════════════════

class TaskLogBase(BaseModel):
    task_id: str
    agent_name: str
    business_unit: str
    status: str
    request_payload: str

class TaskLogCreate(TaskLogBase):
    parent_task_id: Optional[str] = None
    depth: int = 0
    delegated_by: Optional[str] = None

class TaskLogUpdate(BaseModel):
    status: str
    response_payload: Optional[str] = None
    duration_ms: Optional[int] = None
    primary_model_used: Optional[str] = None
    fallback_model_used: Optional[str] = None
    token_usage: Optional[int] = None
    estimated_cost: Optional[float] = None

class TaskLog(TaskLogBase):
    id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_ms: Optional[int] = None
    response_payload: Optional[str] = None
    primary_model_used: Optional[str] = None
    fallback_model_used: Optional[str] = None
    token_usage: Optional[int] = None
    estimated_cost: Optional[float] = None
    parent_task_id: Optional[str] = None
    depth: int = 0
    delegated_by: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# ═══════════════════════════════════════════════════════════════════════
# SCHEDULED TASK SCHEMAS
# ═══════════════════════════════════════════════════════════════════════

class ScheduledTaskCreate(BaseModel):
    name: str
    description: Optional[str] = None
    task_description: str
    cron_expression: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    assigned_agents: str = "[]"         # JSON array
    auto_route: int = 1
    required_skills: str = "[]"
    required_tools: str = "[]"
    repeat_count: int = 0
    created_by: str = "system"

class ScheduledTaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    task_description: Optional[str] = None
    cron_expression: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    assigned_agents: Optional[str] = None
    auto_route: Optional[int] = None
    required_skills: Optional[str] = None
    required_tools: Optional[str] = None
    status: Optional[str] = None
    repeat_count: Optional[int] = None

class ScheduledTask(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    task_description: str
    cron_expression: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    last_run_at: Optional[datetime] = None
    last_task_id: Optional[str] = None
    assigned_agents: str = "[]"
    auto_route: int = 1
    required_skills: str = "[]"
    required_tools: str = "[]"
    status: str = "active"
    repeat_count: int = 0
    runs_completed: int = 0
    created_by: str = "system"
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# ═══════════════════════════════════════════════════════════════════════
# WORKFLOW SCHEMAS
# ═══════════════════════════════════════════════════════════════════════

class WorkflowStepCreate(BaseModel):
    step_order: int
    name: str
    step_type: str                      # "agent", "tool", "skill", "condition", "delay"
    config: str = "{}"                  # JSON
    on_success: str = "next"
    on_failure: str = "abort"

class WorkflowStepUpdate(BaseModel):
    step_order: Optional[int] = None
    name: Optional[str] = None
    step_type: Optional[str] = None
    config: Optional[str] = None
    on_success: Optional[str] = None
    on_failure: Optional[str] = None

class WorkflowStep(BaseModel):
    id: int
    workflow_id: int
    step_order: int
    name: str
    step_type: str
    config: str = "{}"
    on_success: str = "next"
    on_failure: str = "abort"
    model_config = ConfigDict(from_attributes=True)

class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    steps: List[WorkflowStepCreate] = []
    created_by: str = "system"

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[int] = None

class Workflow(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: int = 1
    created_by: str = "system"
    created_at: datetime
    updated_at: datetime
    steps: List[WorkflowStep] = []
    model_config = ConfigDict(from_attributes=True)

# ═══════════════════════════════════════════════════════════════════════
# AGENT KNOWLEDGE SCHEMAS
# ═══════════════════════════════════════════════════════════════════════

class AgentKnowledgeCreate(BaseModel):
    agent_name: str
    knowledge_type: str                 # "skill_result", "tool_usage", "pattern", "preference", "fact"
    topic: str
    content: str
    confidence: float = 0.8
    source_task_id: Optional[str] = None

class AgentKnowledge(BaseModel):
    id: int
    agent_name: str
    knowledge_type: str
    topic: str
    content: str
    confidence: float
    source_task_id: Optional[str] = None
    usage_count: int = 0
    last_used_at: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# ═══════════════════════════════════════════════════════════════════════
# AGENT MESSAGE SCHEMAS
# ═══════════════════════════════════════════════════════════════════════

class AgentMessageCreate(BaseModel):
    message_id: str
    session_id: str
    task_id: str
    sender_agent: str
    receiver_agent: str
    message_type: str
    content: str
    metadata_json: Optional[str] = None

class AgentMessage(AgentMessageCreate):
    id: int
    status: str = "pending"
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

# ═══════════════════════════════════════════════════════════════════════
# AGENT STATE SCHEMAS
# ═══════════════════════════════════════════════════════════════════════

class AgentStateCreate(BaseModel):
    task_id: str
    agent_name: str
    max_steps: int = 10

class AgentStateUpdate(BaseModel):
    current_step: Optional[int] = None
    status: Optional[str] = None
    reasoning_trace: Optional[str] = None
    scratchpad: Optional[str] = None

class AgentState(BaseModel):
    id: int
    task_id: str
    agent_name: str
    current_step: int
    max_steps: int
    status: str
    reasoning_trace: str
    scratchpad: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

# ═══════════════════════════════════════════════════════════════════════
# AUTH SCHEMAS
# ═══════════════════════════════════════════════════════════════════════

class RoleBase(BaseModel):
    name: str

class RoleCreate(RoleBase):
    pass

class Role(RoleBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str
    role_name: str

class User(UserBase):
    id: int
    role: Role
    model_config = ConfigDict(from_attributes=True)

# ═══════════════════════════════════════════════════════════════════════
# MEMORY SCHEMAS
# ═══════════════════════════════════════════════════════════════════════

class MemoryBase(BaseModel):
    agent_name: str
    session_id: str
    role: str
    content: str

class MemoryCreate(MemoryBase):
    pass

class Memory(MemoryBase):
    id: int
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

# ═══════════════════════════════════════════════════════════════════════
# ANALYTICS SCHEMAS
# ═══════════════════════════════════════════════════════════════════════

class KPIStats(BaseModel):
    tasks_today: int
    cost_today: float
    success_rate: float

class AgentUsage(BaseModel):
    agent_name: str
    task_count: int

class StatusDistribution(BaseModel):
    status: str
    count: int

class DailyVolume(BaseModel):
    date: date
    task_count: int
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

class AnalyticsData(BaseModel):
    kpis: KPIStats
    agent_usage: List[AgentUsage]
    status_distribution: List[StatusDistribution]
    daily_volume: List[DailyVolume]

# ═══════════════════════════════════════════════════════════════════════
# ORCHESTRATOR SCHEMAS
# ═══════════════════════════════════════════════════════════════════════

class SubTaskPlan(BaseModel):
    sub_task_description: str
    target_agent: str
    priority: int = 1
    depends_on: List[str] = []

class OrchestrationPlan(BaseModel):
    original_task: str
    is_complex: bool
    reasoning: str
    sub_tasks: List[SubTaskPlan] = []
    direct_tool: Optional[str] = None

class OrchestrationResult(BaseModel):
    task_id: str
    status: str
    summary: str
    sub_task_results: List[Dict[str, Any]] = []
    total_duration_ms: int = 0

# ═══════════════════════════════════════════════════════════════════════
# OPENCLAW EXECUTOR SCHEMAS
# ═══════════════════════════════════════════════════════════════════════

class OpenClawCallbackRequest(BaseModel):
    task_id: str
    status: str
    result: Dict[str, Any]
    agent_name: str
    execution_trace: List[Dict[str, Any]] = []

class OpenClawSessionState(BaseModel):
    session_id: str
    task_id: str
    status: str
    messages: List[Dict[str, Any]] = []
