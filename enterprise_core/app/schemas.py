from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime, date

# --- Tool Schemas ---
class ToolBase(BaseModel): name: str; description: Optional[str] = None
class ToolCreate(ToolBase): pass
class Tool(ToolBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# --- Agent Schemas ---
class AgentBase(BaseModel): name: str; description: Optional[str] = None
class AgentCreate(AgentBase): tool_names: List[str] = []
class Agent(AgentBase):
    id: int; tools: List[Tool] = []
    model_config = ConfigDict(from_attributes=True)

# --- TaskLog Schemas ---
class TaskLogBase(BaseModel): task_id: str; agent_name: str; business_unit: str; status: str; request_payload: str
class TaskLogCreate(TaskLogBase): pass
class TaskLogUpdate(BaseModel):
    status: str
    response_payload: Optional[str] = None
    duration_ms: Optional[int] = None
    primary_model_used: Optional[str] = None
    fallback_model_used: Optional[str] = None
    token_usage: Optional[int] = None
    estimated_cost: Optional[float] = None
class TaskLog(TaskLogBase):
    id: int; start_time: datetime; end_time: Optional[datetime] = None
    duration_ms: Optional[int] = None; response_payload: Optional[str] = None
    primary_model_used: Optional[str] = None; fallback_model_used: Optional[str] = None
    token_usage: Optional[int] = None; estimated_cost: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)

# --- Role Schemas ---
class RoleBase(BaseModel): name: str
class RoleCreate(RoleBase): pass
class Role(RoleBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# --- User Schemas ---
class UserBase(BaseModel): username: str
class UserCreate(UserBase): password: str; role_name: str
class User(UserBase):
    id: int; role: Role
    model_config = ConfigDict(from_attributes=True)

# --- Memory Schemas ---
class MemoryBase(BaseModel): agent_name: str; session_id: str; role: str; content: str
class MemoryCreate(MemoryBase): pass
class Memory(MemoryBase):
    id: int; timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Analytics Schemas ---
class KPIStats(BaseModel): tasks_today: int; cost_today: float; success_rate: float
class AgentUsage(BaseModel): agent_name: str; task_count: int
class StatusDistribution(BaseModel): status: str; count: int
class DailyVolume(BaseModel):
    date: date
    task_count: int
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)
class AnalyticsData(BaseModel):
    kpis: KPIStats; agent_usage: List[AgentUsage]
    status_distribution: List[StatusDistribution]; daily_volume: List[DailyVolume]
