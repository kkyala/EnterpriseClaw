from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas
import datetime
import random
from datetime import timedelta

# --- Tool CRUD ---
def get_tool_by_name(db: Session, name: str): return db.query(models.Tool).filter(models.Tool.name == name).first()
def get_all_tools(db: Session): return db.query(models.Tool).all()
def create_tool(db: Session, tool: schemas.ToolCreate):
    db_tool = models.Tool(name=tool.name, description=tool.description)
    db.add(db_tool); db.commit(); db.refresh(db_tool)
    return db_tool

# --- Agent CRUD ---
def get_agent_by_name(db: Session, name: str): return db.query(models.Agent).filter(models.Agent.name == name).first()
def get_agents(db: Session, skip: int = 0, limit: int = 100): return db.query(models.Agent).offset(skip).limit(limit).all()
def create_agent(db: Session, agent: schemas.AgentCreate):
    db_agent = models.Agent(name=agent.name, description=agent.description)
    for tool_name in agent.tool_names:
        tool = get_tool_by_name(db, name=tool_name)
        if tool: db_agent.tools.append(tool)
    db.add(db_agent); db.commit(); db.refresh(db_agent)
    return db_agent
def update_agent_activity(db: Session, agent_name: str):
    db_agent = get_agent_by_name(db, name=agent_name)
    if db_agent: db_agent.last_activity_timestamp = datetime.datetime.utcnow(); db.commit(); db.refresh(db_agent)
    return db_agent

# --- TaskLog CRUD ---
def create_task_log(db: Session, log: schemas.TaskLogCreate):
    db_log = models.TaskLog(**log.dict()); db.add(db_log); db.commit(); db.refresh(db_log)
    return db_log
def update_task_log(db: Session, task_id: str, update_data: schemas.TaskLogUpdate):
    db_log = db.query(models.TaskLog).filter(models.TaskLog.task_id == task_id).first()
    if db_log:
        for key, value in update_data.dict(exclude_unset=True).items(): setattr(db_log, key, value)
        db_log.end_time = datetime.datetime.utcnow()
        db.commit(); db.refresh(db_log)
    return db_log
def get_task_logs(db: Session, skip: int = 0, limit: int = 100): return db.query(models.TaskLog).order_by(models.TaskLog.start_time.desc()).offset(skip).limit(limit).all()

# --- Analytics CRUD ---
def get_analytics_kpis(db: Session):
    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tasks_today = db.query(models.TaskLog).filter(models.TaskLog.start_time >= today_start).count()
    cost_today = db.query(func.sum(models.TaskLog.estimated_cost)).filter(models.TaskLog.start_time >= today_start).scalar() or 0
    successful_tasks = db.query(models.TaskLog).filter(models.TaskLog.status == 'success').count()
    total_tasks = db.query(models.TaskLog).count()
    success_rate = (successful_tasks / total_tasks * 100) if total_tasks > 0 else 0
    return {"tasks_today": tasks_today, "cost_today": cost_today, "success_rate": success_rate}
def get_agent_usage_stats(db: Session): return db.query(models.TaskLog.agent_name, func.count(models.TaskLog.id).label('task_count')).group_by(models.TaskLog.agent_name).order_by(func.count(models.TaskLog.id).desc()).all()
def get_status_distribution(db: Session): return db.query(models.TaskLog.status, func.count(models.TaskLog.id).label('count')).group_by(models.TaskLog.status).all()
def get_daily_task_volume(db: Session, days: int = 7):
    date_limit = datetime.datetime.utcnow() - timedelta(days=days)
    return db.query(func.date(models.TaskLog.start_time).label('date'), func.count(models.TaskLog.id).label('task_count')).filter(models.TaskLog.start_time >= date_limit).group_by(func.date(models.TaskLog.start_time)).order_by(func.date(models.TaskLog.start_time)).all()

# --- Role CRUD ---
def get_role_by_name(db: Session, name: str): return db.query(models.Role).filter(models.Role.name == name).first()
def create_role(db: Session, role: schemas.RoleCreate):
    db_role = models.Role(name=role.name); db.add(db_role); db.commit(); db.refresh(db_role)
    return db_role

# --- User CRUD ---
def get_user_by_username(db: Session, username: str): return db.query(models.User).filter(models.User.username == username).first()
def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = user.password + "_hashed"
    role = get_role_by_name(db, name=user.role_name)
    if not role: raise ValueError(f"Role '{user.role_name}' does not exist.")
    db_user = models.User(username=user.username, hashed_password=hashed_password, role_id=role.id)
    db.add(db_user); db.commit(); db.refresh(db_user)
    return db_user

# --- Memory CRUD ---
def create_memory(db: Session, memory: schemas.MemoryCreate):
    db_memory = models.Memory(**memory.dict()); db.add(db_memory); db.commit(); db.refresh(db_memory)
    return db_memory
def get_memories_by_agent(db: Session, agent_name: str, skip: int = 0, limit: int = 100): return db.query(models.Memory).filter(models.Memory.agent_name == agent_name).order_by(models.Memory.timestamp.desc()).offset(skip).limit(limit).all()
