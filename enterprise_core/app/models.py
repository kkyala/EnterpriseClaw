from sqlalchemy import Column, Integer, String, Text, Table, ForeignKey, DateTime, Float, JSON
from sqlalchemy.orm import relationship
from .database import Base
import datetime

# ═══════════════════════════════════════════════════════════════════════
# ASSOCIATION TABLES (Many-to-Many)
# ═══════════════════════════════════════════════════════════════════════

agent_tool_association = Table('agent_tool', Base.metadata,
    Column('agent_id', Integer, ForeignKey('agents.id')),
    Column('tool_id', Integer, ForeignKey('tools.id'))
)

agent_skill_association = Table('agent_skill', Base.metadata,
    Column('agent_id', Integer, ForeignKey('agents.id')),
    Column('skill_id', Integer, ForeignKey('skills.id'))
)

# ═══════════════════════════════════════════════════════════════════════
# CORE MODELS
# ═══════════════════════════════════════════════════════════════════════

class AgentGroup(Base):
    """Logical grouping of agents (e.g., 'Operations Team', 'Analytics Squad')."""
    __tablename__ = "agent_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text, nullable=True)
    color = Column(String, default="#4a90e2")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    members = relationship("Agent", back_populates="group")


class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text)

    # Health and Status Monitoring Fields
    status = Column(String, default="online")
    current_model = Column(String, default="google/gemini-2.5-pro")
    avg_latency_ms = Column(Integer, default=250)
    last_activity_timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    # Group membership (optional)
    group_id = Column(Integer, ForeignKey('agent_groups.id'), nullable=True)

    # Relationships
    tools = relationship("Tool", secondary=agent_tool_association, back_populates="agents")
    skills = relationship("Skill", secondary=agent_skill_association, back_populates="agents")
    group = relationship("AgentGroup", back_populates="members")


class Tool(Base):
    __tablename__ = "tools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text)
    category = Column(String, default="general", index=True)       # "data", "comms", "analytics", etc.
    parameters_schema = Column(Text, nullable=True)                 # JSON schema for tool params
    version = Column(String, default="1.0")
    is_active = Column(Integer, default=1)

    agents = relationship("Agent", secondary=agent_tool_association, back_populates="tools")


class Skill(Base):
    """Reusable capabilities that agents can possess (e.g., 'resume_parsing', 'forecasting')."""
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text, nullable=True)
    category = Column(String, default="general", index=True)       # "reasoning", "coding", "analysis", etc.
    proficiency_level = Column(String, default="intermediate")     # "basic", "intermediate", "expert"
    parameters_schema = Column(Text, nullable=True)                # JSON params
    is_active = Column(Integer, default=1)

    agents = relationship("Agent", secondary=agent_skill_association, back_populates="skills")


# ═══════════════════════════════════════════════════════════════════════
# TASK & EXECUTION MODELS
# ═══════════════════════════════════════════════════════════════════════

class TaskLog(Base):
    __tablename__ = "task_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, unique=True, index=True)
    agent_name = Column(String, index=True)
    business_unit = Column(String, index=True)
    status = Column(String, index=True)
    start_time = Column(DateTime, default=datetime.datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    request_payload = Column(Text)
    response_payload = Column(Text, nullable=True)

    # Model Router Visualization Fields
    primary_model_used = Column(String, nullable=True)
    fallback_model_used = Column(String, nullable=True)
    token_usage = Column(Integer, nullable=True)
    estimated_cost = Column(Float, nullable=True)

    # Sub-Task Hierarchy
    parent_task_id = Column(String, ForeignKey('task_logs.task_id'), nullable=True, index=True)
    depth = Column(Integer, default=0)
    delegated_by = Column(String, nullable=True)

    parent_task = relationship("TaskLog", remote_side=[task_id],
                               backref="sub_tasks", foreign_keys=[parent_task_id])


class ScheduledTask(Base):
    """Tasks that are planned for future or recurring execution."""
    __tablename__ = "scheduled_tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    task_description = Column(Text)                                 # The actual task prompt
    cron_expression = Column(String, nullable=True)                 # e.g. "0 9 * * MON" or null for one-shot
    scheduled_at = Column(DateTime, nullable=True)                  # One-shot: exact date/time
    next_run_at = Column(DateTime, nullable=True)
    last_run_at = Column(DateTime, nullable=True)
    last_task_id = Column(String, nullable=True)                    # Links to last TaskLog.task_id
    assigned_agents = Column(Text, default="[]")                    # JSON array of agent names
    auto_route = Column(Integer, default=1)                         # 1 = let orchestrator pick
    required_skills = Column(Text, default="[]")                    # JSON array of skill names
    required_tools = Column(Text, default="[]")                     # JSON array of tool names
    status = Column(String, default="active", index=True)           # "active", "paused", "completed"
    repeat_count = Column(Integer, default=0)                       # 0 = infinite for cron, N = run N times
    runs_completed = Column(Integer, default=0)
    created_by = Column(String, default="system")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ═══════════════════════════════════════════════════════════════════════
# WORKFLOW MODELS
# ═══════════════════════════════════════════════════════════════════════

class Workflow(Base):
    """Reusable multi-step pipelines of agents, tools, and skills."""
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text, nullable=True)
    is_active = Column(Integer, default=1)
    created_by = Column(String, default="system")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    steps = relationship("WorkflowStep", back_populates="workflow", order_by="WorkflowStep.step_order")


class WorkflowStep(Base):
    """Individual step within a workflow pipeline."""
    __tablename__ = "workflow_steps"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey('workflows.id'), index=True)
    step_order = Column(Integer)
    name = Column(String)
    step_type = Column(String)                                      # "agent", "tool", "skill", "condition", "delay"
    config = Column(Text, default="{}")                             # JSON: agent_name, tool_name, params, etc.
    on_success = Column(String, default="next")                     # "next" | "step_N" | "end"
    on_failure = Column(String, default="abort")                    # "retry" | "skip" | "abort"

    workflow = relationship("Workflow", back_populates="steps")


# ═══════════════════════════════════════════════════════════════════════
# COMMUNICATION & OBSERVABILITY
# ═══════════════════════════════════════════════════════════════════════

class AgentMessage(Base):
    """Inter-agent communication messages on the agent communication bus."""
    __tablename__ = "agent_messages"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(String, unique=True, index=True)
    session_id = Column(String, index=True)
    task_id = Column(String, index=True)

    sender_agent = Column(String, index=True)
    receiver_agent = Column(String, index=True)
    message_type = Column(String, index=True)  # "request", "response", "delegate", "result", "broadcast"

    content = Column(Text)
    metadata_json = Column(Text, nullable=True)

    status = Column(String, default="pending")
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


class AgentState(Base):
    """Tracks the execution state of an agent during a multi-step agentic loop."""
    __tablename__ = "agent_states"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, unique=True, index=True)
    agent_name = Column(String, index=True)

    current_step = Column(Integer, default=0)
    max_steps = Column(Integer, default=10)
    status = Column(String, default="thinking")

    reasoning_trace = Column(Text, default="[]")
    scratchpad = Column(Text, default="{}")

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


# ═══════════════════════════════════════════════════════════════════════
# MEMORY & KNOWLEDGE
# ═══════════════════════════════════════════════════════════════════════

class Memory(Base):
    """Session-based conversation memory (chat history)."""
    __tablename__ = "memories"

    id = Column(Integer, primary_key=True, index=True)
    agent_name = Column(String, index=True)
    session_id = Column(String, index=True)
    role = Column(String)  # "user" or "agent"
    content = Column(Text)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


class AgentKnowledge(Base):
    """Long-term agent knowledge and recall — patterns, facts, and learned preferences."""
    __tablename__ = "agent_knowledge"

    id = Column(Integer, primary_key=True, index=True)
    agent_name = Column(String, index=True)
    knowledge_type = Column(String, index=True)     # "skill_result", "tool_usage", "pattern", "preference", "fact"
    topic = Column(String, index=True)               # Searchable topic tag
    content = Column(Text)                           # The knowledge content
    confidence = Column(Float, default=0.8)          # 0.0–1.0
    source_task_id = Column(String, nullable=True)   # Which task generated this
    usage_count = Column(Integer, default=0)          # Times recalled
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ═══════════════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════════════

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role_id = Column(Integer, ForeignKey('roles.id'))

    role = relationship("Role", back_populates="users")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    users = relationship("User", back_populates="role")
