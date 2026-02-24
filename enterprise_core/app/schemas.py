from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, date

# --- Tool Schemas ---
class ToolBase(BaseModel):
    name: str
    description: Optional[str] = None

class ToolCreate(ToolBase):
    pass

class Tool(ToolBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# --- Agent Schemas ---
class AgentBase(BaseModel):
    name: str
    description: Optional[str] = None

class AgentCreate(AgentBase):
    tool_names: List[str] = []

class Agent(AgentBase):
    id: int
    tools: List[Tool] = []
    status: Optional[str] = "online"
    current_model: Optional[str] = None
    avg_latency_ms: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

# --- TaskLog Schemas ---
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

# --- Agent Message Schemas (Inter-Agent Communication) ---
class AgentMessageCreate(BaseModel):
    message_id: str
    session_id: str
    task_id: str
    sender_agent: str
    receiver_agent: str
    message_type: str  # "request", "response", "delegate", "result", "broadcast"
    content: str
    metadata_json: Optional[str] = None

class AgentMessage(AgentMessageCreate):
    id: int
    status: str = "pending"
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Agent State Schemas (Execution Loop Tracking) ---
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

# --- Role Schemas ---
class RoleBase(BaseModel):
    name: str

class RoleCreate(RoleBase):
    pass

class Role(RoleBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# --- User Schemas ---
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str
    role_name: str

class User(UserBase):
    id: int
    role: Role
    model_config = ConfigDict(from_attributes=True)

# --- Memory Schemas ---
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

# --- Analytics Schemas ---
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

# --- Orchestrator Schemas ---
class SubTaskPlan(BaseModel):
    """A planned sub-task from the orchestrator's decomposition."""
    sub_task_description: str
    target_agent: str
    priority: int = 1
    depends_on: List[str] = []  # task_ids this depends on

class OrchestrationPlan(BaseModel):
    """The orchestrator's plan for decomposing a complex task."""
    original_task: str
    is_complex: bool
    reasoning: str
    sub_tasks: List[SubTaskPlan] = []
    direct_tool: Optional[str] = None  # If not complex, route directly

class OrchestrationResult(BaseModel):
    """Final result after orchestration completes."""
    task_id: str
    status: str
    summary: str
    sub_task_results: List[Dict[str, Any]] = []
    total_duration_ms: int = 0

# --- OpenClaw Executor Schemas ---
class OpenClawCallbackRequest(BaseModel):
    """Request to send results back to OpenClaw."""
    task_id: str
    status: str
    result: Dict[str, Any]
    agent_name: str
    execution_trace: List[Dict[str, Any]] = []

class OpenClawSessionState(BaseModel):
    """Tracks an active OpenClaw conversation session."""
    session_id: str
    task_id: str
    status: str  # "active", "waiting", "complete"
    messages: List[Dict[str, Any]] = []
