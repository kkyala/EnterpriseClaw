from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas
import datetime
import random
import json
from datetime import timedelta

# --- Tool CRUD ---
def get_tool_by_name(db: Session, name: str):
    return db.query(models.Tool).filter(models.Tool.name == name).first()

def get_all_tools(db: Session):
    return db.query(models.Tool).all()

def create_tool(db: Session, tool: schemas.ToolCreate):
    db_tool = models.Tool(name=tool.name, description=tool.description)
    db.add(db_tool)
    db.commit()
    db.refresh(db_tool)
    return db_tool

# --- Agent CRUD ---
def get_agent_by_name(db: Session, name: str):
    return db.query(models.Agent).filter(models.Agent.name == name).first()

def get_agents(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Agent).offset(skip).limit(limit).all()

def create_agent(db: Session, agent: schemas.AgentCreate):
    db_agent = models.Agent(name=agent.name, description=agent.description)
    for tool_name in agent.tool_names:
        tool = get_tool_by_name(db, name=tool_name)
        if tool:
            db_agent.tools.append(tool)
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    return db_agent

def update_agent_activity(db: Session, agent_name: str):
    db_agent = get_agent_by_name(db, name=agent_name)
    if db_agent:
        db_agent.last_activity_timestamp = datetime.datetime.utcnow()
        db.commit()
        db.refresh(db_agent)
    return db_agent

# --- TaskLog CRUD ---
def create_task_log(db: Session, log: schemas.TaskLogCreate):
    db_log = models.TaskLog(**log.dict())
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

def update_task_log(db: Session, task_id: str, update_data: schemas.TaskLogUpdate):
    db_log = db.query(models.TaskLog).filter(models.TaskLog.task_id == task_id).first()
    if db_log:
        for key, value in update_data.dict(exclude_unset=True).items():
            setattr(db_log, key, value)
        db_log.end_time = datetime.datetime.utcnow()
        db.commit()
        db.refresh(db_log)
    return db_log

def get_task_logs(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.TaskLog).order_by(models.TaskLog.start_time.desc()).offset(skip).limit(limit).all()

def get_task_log_by_id(db: Session, task_id: str):
    return db.query(models.TaskLog).filter(models.TaskLog.task_id == task_id).first()

def get_sub_tasks(db: Session, parent_task_id: str):
    """Get all sub-tasks for a given parent task."""
    return db.query(models.TaskLog).filter(
        models.TaskLog.parent_task_id == parent_task_id
    ).order_by(models.TaskLog.start_time.asc()).all()

def get_task_tree(db: Session, root_task_id: str):
    """Get the full task tree starting from a root task (recursive)."""
    root = get_task_log_by_id(db, root_task_id)
    if not root:
        return None
    
    def _build_tree(task):
        children = get_sub_tasks(db, task.task_id)
        return {
            "task_id": task.task_id,
            "agent_name": task.agent_name,
            "status": task.status,
            "depth": task.depth,
            "delegated_by": task.delegated_by,
            "duration_ms": task.duration_ms,
            "sub_tasks": [_build_tree(c) for c in children]
        }
    
    return _build_tree(root)

# --- AgentMessage CRUD ---
def create_agent_message(db: Session, msg: schemas.AgentMessageCreate):
    db_msg = models.AgentMessage(**msg.dict())
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)
    return db_msg

def get_messages_for_agent(db: Session, agent_name: str, limit: int = 50):
    """Get messages sent TO a specific agent."""
    return db.query(models.AgentMessage).filter(
        models.AgentMessage.receiver_agent == agent_name,
        models.AgentMessage.status == "pending"
    ).order_by(models.AgentMessage.timestamp.asc()).limit(limit).all()

def get_messages_for_task(db: Session, task_id: str):
    """Get all messages related to a task."""
    return db.query(models.AgentMessage).filter(
        models.AgentMessage.task_id == task_id
    ).order_by(models.AgentMessage.timestamp.asc()).all()

def update_message_status(db: Session, message_id: str, status: str):
    db_msg = db.query(models.AgentMessage).filter(
        models.AgentMessage.message_id == message_id
    ).first()
    if db_msg:
        db_msg.status = status
        db.commit()
        db.refresh(db_msg)
    return db_msg

# --- AgentState CRUD ---
def create_agent_state(db: Session, state: schemas.AgentStateCreate):
    db_state = models.AgentState(**state.dict())
    db.add(db_state)
    db.commit()
    db.refresh(db_state)
    return db_state

def get_agent_state(db: Session, task_id: str):
    return db.query(models.AgentState).filter(
        models.AgentState.task_id == task_id
    ).first()

def update_agent_state(db: Session, task_id: str, update_data: schemas.AgentStateUpdate):
    db_state = db.query(models.AgentState).filter(
        models.AgentState.task_id == task_id
    ).first()
    if db_state:
        for key, value in update_data.dict(exclude_unset=True).items():
            setattr(db_state, key, value)
        db_state.updated_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(db_state)
    return db_state

def append_reasoning_step(db: Session, task_id: str, step: dict):
    """Append a step to the reasoning trace of an agent state."""
    db_state = get_agent_state(db, task_id)
    if db_state:
        trace = json.loads(db_state.reasoning_trace or "[]")
        trace.append(step)
        db_state.reasoning_trace = json.dumps(trace)
        db_state.current_step = len(trace)
        db_state.updated_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(db_state)
    return db_state

# --- Analytics CRUD ---
def get_analytics_kpis(db: Session):
    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tasks_today = db.query(models.TaskLog).filter(models.TaskLog.start_time >= today_start).count()
    cost_today = db.query(func.sum(models.TaskLog.estimated_cost)).filter(
        models.TaskLog.start_time >= today_start
    ).scalar() or 0
    successful_tasks = db.query(models.TaskLog).filter(models.TaskLog.status == 'success').count()
    total_tasks = db.query(models.TaskLog).count()
    success_rate = (successful_tasks / total_tasks * 100) if total_tasks > 0 else 0
    return {"tasks_today": tasks_today, "cost_today": cost_today, "success_rate": success_rate}

def get_agent_usage_stats(db: Session):
    return db.query(
        models.TaskLog.agent_name,
        func.count(models.TaskLog.id).label('task_count')
    ).group_by(models.TaskLog.agent_name).order_by(func.count(models.TaskLog.id).desc()).all()

def get_status_distribution(db: Session):
    return db.query(
        models.TaskLog.status,
        func.count(models.TaskLog.id).label('count')
    ).group_by(models.TaskLog.status).all()

def get_daily_task_volume(db: Session, days: int = 7):
    date_limit = datetime.datetime.utcnow() - timedelta(days=days)
    return db.query(
        func.date(models.TaskLog.start_time).label('date'),
        func.count(models.TaskLog.id).label('task_count')
    ).filter(
        models.TaskLog.start_time >= date_limit
    ).group_by(
        func.date(models.TaskLog.start_time)
    ).order_by(
        func.date(models.TaskLog.start_time)
    ).all()

# --- Role CRUD ---
def get_role_by_name(db: Session, name: str):
    return db.query(models.Role).filter(models.Role.name == name).first()

def create_role(db: Session, role: schemas.RoleCreate):
    db_role = models.Role(name=role.name)
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

# --- User CRUD ---
def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = user.password + "_hashed"
    role = get_role_by_name(db, name=user.role_name)
    if not role:
        raise ValueError(f"Role '{user.role_name}' does not exist.")
    db_user = models.User(username=user.username, hashed_password=hashed_password, role_id=role.id)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- Memory CRUD ---
def create_memory(db: Session, memory: schemas.MemoryCreate):
    db_memory = models.Memory(**memory.dict())
    db.add(db_memory)
    db.commit()
    db.refresh(db_memory)
    return db_memory

def get_memories_by_agent(db: Session, agent_name: str, skip: int = 0, limit: int = 100):
    return db.query(models.Memory).filter(
        models.Memory.agent_name == agent_name
    ).order_by(models.Memory.timestamp.desc()).offset(skip).limit(limit).all()
