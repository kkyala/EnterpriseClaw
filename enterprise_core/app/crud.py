from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas
import datetime
import random
import json
from datetime import timedelta

# ═══════════════════════════════════════════════════════════════════════
# TOOL CRUD
# ═══════════════════════════════════════════════════════════════════════

def get_tool_by_name(db: Session, name: str):
    return db.query(models.Tool).filter(models.Tool.name == name).first()

def get_all_tools(db: Session):
    return db.query(models.Tool).all()

def create_tool(db: Session, tool: schemas.ToolCreate):
    db_tool = models.Tool(
        name=tool.name, description=tool.description,
        category=tool.category, parameters_schema=tool.parameters_schema,
        version=tool.version
    )
    db.add(db_tool)
    db.commit()
    db.refresh(db_tool)
    return db_tool

def update_tool(db: Session, tool_id: int, update_data: schemas.ToolUpdate):
    db_tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
    if db_tool:
        for key, value in update_data.dict(exclude_unset=True).items():
            setattr(db_tool, key, value)
        db.commit()
        db.refresh(db_tool)
    return db_tool

def delete_tool(db: Session, tool_id: int):
    db_tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
    if db_tool:
        db.delete(db_tool)
        db.commit()
    return db_tool

# ═══════════════════════════════════════════════════════════════════════
# SKILL CRUD
# ═══════════════════════════════════════════════════════════════════════

def get_skill_by_name(db: Session, name: str):
    return db.query(models.Skill).filter(models.Skill.name == name).first()

def get_all_skills(db: Session):
    return db.query(models.Skill).all()

def create_skill(db: Session, skill: schemas.SkillCreate):
    db_skill = models.Skill(
        name=skill.name, description=skill.description,
        category=skill.category, proficiency_level=skill.proficiency_level,
        parameters_schema=skill.parameters_schema
    )
    db.add(db_skill)
    db.commit()
    db.refresh(db_skill)
    return db_skill

def update_skill(db: Session, skill_id: int, update_data: schemas.SkillUpdate):
    db_skill = db.query(models.Skill).filter(models.Skill.id == skill_id).first()
    if db_skill:
        for key, value in update_data.dict(exclude_unset=True).items():
            setattr(db_skill, key, value)
        db.commit()
        db.refresh(db_skill)
    return db_skill

def delete_skill(db: Session, skill_id: int):
    db_skill = db.query(models.Skill).filter(models.Skill.id == skill_id).first()
    if db_skill:
        db.delete(db_skill)
        db.commit()
    return db_skill

# ═══════════════════════════════════════════════════════════════════════
# AGENT GROUP CRUD
# ═══════════════════════════════════════════════════════════════════════

def get_group_by_name(db: Session, name: str):
    return db.query(models.AgentGroup).filter(models.AgentGroup.name == name).first()

def get_all_groups(db: Session):
    return db.query(models.AgentGroup).all()

def create_group(db: Session, group: schemas.AgentGroupCreate):
    db_group = models.AgentGroup(name=group.name, description=group.description, color=group.color)
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group

def update_group(db: Session, group_id: int, update_data: schemas.AgentGroupUpdate):
    db_group = db.query(models.AgentGroup).filter(models.AgentGroup.id == group_id).first()
    if db_group:
        for key, value in update_data.dict(exclude_unset=True).items():
            setattr(db_group, key, value)
        db.commit()
        db.refresh(db_group)
    return db_group

def delete_group(db: Session, group_id: int):
    db_group = db.query(models.AgentGroup).filter(models.AgentGroup.id == group_id).first()
    if db_group:
        db.delete(db_group)
        db.commit()
    return db_group

def add_agent_to_group(db: Session, group_id: int, agent_name: str):
    db_agent = get_agent_by_name(db, agent_name)
    if db_agent:
        db_agent.group_id = group_id
        db.commit()
        db.refresh(db_agent)
    return db_agent

def remove_agent_from_group(db: Session, agent_name: str):
    db_agent = get_agent_by_name(db, agent_name)
    if db_agent:
        db_agent.group_id = None
        db.commit()
        db.refresh(db_agent)
    return db_agent

# ═══════════════════════════════════════════════════════════════════════
# AGENT CRUD
# ═══════════════════════════════════════════════════════════════════════

def get_agent_by_name(db: Session, name: str):
    return db.query(models.Agent).filter(models.Agent.name == name).first()

def get_agents(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Agent).offset(skip).limit(limit).all()

def create_agent(db: Session, agent: schemas.AgentCreate):
    db_agent = models.Agent(name=agent.name, description=agent.description)
    # Assign tools
    for tool_name in agent.tool_names:
        tool = get_tool_by_name(db, name=tool_name)
        if tool:
            db_agent.tools.append(tool)
    # Assign skills
    for skill_name in agent.skill_names:
        skill = get_skill_by_name(db, name=skill_name)
        if skill:
            db_agent.skills.append(skill)
    # Assign group
    if agent.group_name:
        group = get_group_by_name(db, agent.group_name)
        if group:
            db_agent.group_id = group.id
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

def assign_skills_to_agent(db: Session, agent_name: str, skill_names: list):
    db_agent = get_agent_by_name(db, agent_name)
    if not db_agent:
        return None
    for skill_name in skill_names:
        skill = get_skill_by_name(db, skill_name)
        if skill and skill not in db_agent.skills:
            db_agent.skills.append(skill)
    db.commit()
    db.refresh(db_agent)
    return db_agent

def remove_skill_from_agent(db: Session, agent_name: str, skill_name: str):
    db_agent = get_agent_by_name(db, agent_name)
    if not db_agent:
        return None
    skill = get_skill_by_name(db, skill_name)
    if skill and skill in db_agent.skills:
        db_agent.skills.remove(skill)
    db.commit()
    db.refresh(db_agent)
    return db_agent

# ═══════════════════════════════════════════════════════════════════════
# TASK LOG CRUD
# ═══════════════════════════════════════════════════════════════════════

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
    return db.query(models.TaskLog).filter(
        models.TaskLog.parent_task_id == parent_task_id
    ).order_by(models.TaskLog.start_time.asc()).all()

def get_task_tree(db: Session, root_task_id: str):
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

# ═══════════════════════════════════════════════════════════════════════
# SCHEDULED TASK CRUD
# ═══════════════════════════════════════════════════════════════════════

def create_scheduled_task(db: Session, task: schemas.ScheduledTaskCreate):
    db_task = models.ScheduledTask(**task.dict())
    # Set next_run_at based on scheduled_at or now
    if task.scheduled_at:
        db_task.next_run_at = task.scheduled_at
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def get_all_scheduled_tasks(db: Session):
    return db.query(models.ScheduledTask).order_by(models.ScheduledTask.created_at.desc()).all()

def get_scheduled_task_by_id(db: Session, task_id: int):
    return db.query(models.ScheduledTask).filter(models.ScheduledTask.id == task_id).first()

def update_scheduled_task(db: Session, task_id: int, update_data: schemas.ScheduledTaskUpdate):
    db_task = db.query(models.ScheduledTask).filter(models.ScheduledTask.id == task_id).first()
    if db_task:
        for key, value in update_data.dict(exclude_unset=True).items():
            setattr(db_task, key, value)
        db.commit()
        db.refresh(db_task)
    return db_task

def delete_scheduled_task(db: Session, task_id: int):
    db_task = db.query(models.ScheduledTask).filter(models.ScheduledTask.id == task_id).first()
    if db_task:
        db.delete(db_task)
        db.commit()
    return db_task

def get_due_scheduled_tasks(db: Session):
    now = datetime.datetime.utcnow()
    return db.query(models.ScheduledTask).filter(
        models.ScheduledTask.status == "active",
        models.ScheduledTask.next_run_at <= now
    ).all()

# ═══════════════════════════════════════════════════════════════════════
# WORKFLOW CRUD
# ═══════════════════════════════════════════════════════════════════════

def create_workflow(db: Session, workflow: schemas.WorkflowCreate):
    db_wf = models.Workflow(
        name=workflow.name,
        description=workflow.description,
        created_by=workflow.created_by
    )
    db.add(db_wf)
    db.commit()
    db.refresh(db_wf)
    # Create steps
    for step_data in workflow.steps:
        db_step = models.WorkflowStep(
            workflow_id=db_wf.id,
            step_order=step_data.step_order,
            name=step_data.name,
            step_type=step_data.step_type,
            config=step_data.config,
            on_success=step_data.on_success,
            on_failure=step_data.on_failure
        )
        db.add(db_step)
    db.commit()
    db.refresh(db_wf)
    return db_wf

def get_all_workflows(db: Session):
    return db.query(models.Workflow).order_by(models.Workflow.created_at.desc()).all()

def get_workflow_by_id(db: Session, workflow_id: int):
    return db.query(models.Workflow).filter(models.Workflow.id == workflow_id).first()

def get_workflow_by_name(db: Session, name: str):
    return db.query(models.Workflow).filter(models.Workflow.name == name).first()

def update_workflow(db: Session, workflow_id: int, update_data: schemas.WorkflowUpdate):
    db_wf = db.query(models.Workflow).filter(models.Workflow.id == workflow_id).first()
    if db_wf:
        for key, value in update_data.dict(exclude_unset=True).items():
            setattr(db_wf, key, value)
        db_wf.updated_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(db_wf)
    return db_wf

def delete_workflow(db: Session, workflow_id: int):
    db_wf = db.query(models.Workflow).filter(models.Workflow.id == workflow_id).first()
    if db_wf:
        # Delete steps first
        db.query(models.WorkflowStep).filter(models.WorkflowStep.workflow_id == workflow_id).delete()
        db.delete(db_wf)
        db.commit()
    return db_wf

def add_workflow_step(db: Session, workflow_id: int, step: schemas.WorkflowStepCreate):
    db_step = models.WorkflowStep(
        workflow_id=workflow_id,
        step_order=step.step_order,
        name=step.name,
        step_type=step.step_type,
        config=step.config,
        on_success=step.on_success,
        on_failure=step.on_failure
    )
    db.add(db_step)
    db.commit()
    db.refresh(db_step)
    return db_step

def update_workflow_step(db: Session, step_id: int, update_data: schemas.WorkflowStepUpdate):
    db_step = db.query(models.WorkflowStep).filter(models.WorkflowStep.id == step_id).first()
    if db_step:
        for key, value in update_data.dict(exclude_unset=True).items():
            setattr(db_step, key, value)
        db.commit()
        db.refresh(db_step)
    return db_step

def delete_workflow_step(db: Session, step_id: int):
    db_step = db.query(models.WorkflowStep).filter(models.WorkflowStep.id == step_id).first()
    if db_step:
        db.delete(db_step)
        db.commit()
    return db_step

# ═══════════════════════════════════════════════════════════════════════
# AGENT KNOWLEDGE CRUD
# ═══════════════════════════════════════════════════════════════════════

def create_knowledge(db: Session, knowledge: schemas.AgentKnowledgeCreate):
    db_k = models.AgentKnowledge(**knowledge.dict())
    db.add(db_k)
    db.commit()
    db.refresh(db_k)
    return db_k

def get_knowledge_for_agent(db: Session, agent_name: str, limit: int = 50):
    return db.query(models.AgentKnowledge).filter(
        models.AgentKnowledge.agent_name == agent_name
    ).order_by(models.AgentKnowledge.created_at.desc()).limit(limit).all()

def search_knowledge(db: Session, agent_name: str, query: str, limit: int = 20):
    return db.query(models.AgentKnowledge).filter(
        models.AgentKnowledge.agent_name == agent_name,
        models.AgentKnowledge.topic.ilike(f"%{query}%")
    ).order_by(models.AgentKnowledge.usage_count.desc()).limit(limit).all()

def increment_knowledge_usage(db: Session, knowledge_id: int):
    db_k = db.query(models.AgentKnowledge).filter(models.AgentKnowledge.id == knowledge_id).first()
    if db_k:
        db_k.usage_count += 1
        db_k.last_used_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(db_k)
    return db_k

def get_top_knowledge(db: Session, agent_name: str, limit: int = 10):
    return db.query(models.AgentKnowledge).filter(
        models.AgentKnowledge.agent_name == agent_name
    ).order_by(models.AgentKnowledge.usage_count.desc()).limit(limit).all()

def delete_knowledge(db: Session, knowledge_id: int):
    db_k = db.query(models.AgentKnowledge).filter(models.AgentKnowledge.id == knowledge_id).first()
    if db_k:
        db.delete(db_k)
        db.commit()
    return db_k

# ═══════════════════════════════════════════════════════════════════════
# AGENT MESSAGE CRUD
# ═══════════════════════════════════════════════════════════════════════

def create_agent_message(db: Session, msg: schemas.AgentMessageCreate):
    db_msg = models.AgentMessage(**msg.dict())
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)
    return db_msg

def get_messages_for_agent(db: Session, agent_name: str, limit: int = 50):
    return db.query(models.AgentMessage).filter(
        models.AgentMessage.receiver_agent == agent_name,
        models.AgentMessage.status == "pending"
    ).order_by(models.AgentMessage.timestamp.asc()).limit(limit).all()

def get_messages_for_task(db: Session, task_id: str):
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

# ═══════════════════════════════════════════════════════════════════════
# AGENT STATE CRUD
# ═══════════════════════════════════════════════════════════════════════

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

# ═══════════════════════════════════════════════════════════════════════
# ANALYTICS CRUD
# ═══════════════════════════════════════════════════════════════════════

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

# ═══════════════════════════════════════════════════════════════════════
# AUTH CRUD
# ═══════════════════════════════════════════════════════════════════════

def get_role_by_name(db: Session, name: str):
    return db.query(models.Role).filter(models.Role.name == name).first()

def create_role(db: Session, role: schemas.RoleCreate):
    db_role = models.Role(name=role.name)
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

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

# ═══════════════════════════════════════════════════════════════════════
# MEMORY CRUD
# ═══════════════════════════════════════════════════════════════════════

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
