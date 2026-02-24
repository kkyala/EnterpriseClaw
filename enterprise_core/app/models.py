from sqlalchemy import Column, Integer, String, Text, Table, ForeignKey, DateTime, Float, JSON
from sqlalchemy.orm import relationship
from .database import Base
import datetime

# Association Table for the Many-to-Many relationship between Agent and Tool
agent_tool_association = Table('agent_tool', Base.metadata,
    Column('agent_id', Integer, ForeignKey('agents.id')),
    Column('tool_id', Integer, ForeignKey('tools.id'))
)

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

    # Many-to-Many relationship with Tool
    tools = relationship("Tool", secondary=agent_tool_association, back_populates="agents")

class Tool(Base):
    __tablename__ = "tools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text)

    # Many-to-Many relationship with Agent
    agents = relationship("Agent", secondary=agent_tool_association, back_populates="tools")

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

    # --- Sub-Task Hierarchy ---
    parent_task_id = Column(String, ForeignKey('task_logs.task_id'), nullable=True, index=True)
    depth = Column(Integer, default=0)  # 0 = root task, 1+ = sub-task depth
    delegated_by = Column(String, nullable=True)  # Agent that delegated this sub-task

    # Self-referential relationship for parent/child tasks
    parent_task = relationship("TaskLog", remote_side=[task_id],
                               backref="sub_tasks", foreign_keys=[parent_task_id])

class AgentMessage(Base):
    """Inter-agent communication messages on the agent communication bus."""
    __tablename__ = "agent_messages"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(String, unique=True, index=True)
    session_id = Column(String, index=True)  # Groups messages in a conversation
    task_id = Column(String, index=True)      # Links to the originating task

    sender_agent = Column(String, index=True)
    receiver_agent = Column(String, index=True)
    message_type = Column(String, index=True)  # "request", "response", "delegate", "result", "broadcast"
    
    content = Column(Text)       # The message body (JSON-serialized)
    metadata_json = Column(Text, nullable=True)  # Extra metadata
    
    status = Column(String, default="pending")  # "pending", "delivered", "processed", "failed"
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class AgentState(Base):
    """Tracks the execution state of an agent during a multi-step agentic loop."""
    __tablename__ = "agent_states"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, unique=True, index=True)
    agent_name = Column(String, index=True)
    
    current_step = Column(Integer, default=0)
    max_steps = Column(Integer, default=10)
    status = Column(String, default="thinking")  # "thinking", "acting", "observing", "delegating", "complete", "failed"
    
    # The accumulated reasoning trace (JSON array of step objects)
    reasoning_trace = Column(Text, default="[]")
    # Shared scratchpad for intermediate results
    scratchpad = Column(Text, default="{}")
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

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

class Memory(Base):
    __tablename__ = "memories"

    id = Column(Integer, primary_key=True, index=True)
    agent_name = Column(String, index=True)
    session_id = Column(String, index=True)
    role = Column(String)  # "user" or "agent"
    content = Column(Text)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
