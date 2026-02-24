import asyncio
import json
import uuid
import random
from typing import List, Optional

import aioredis
import redis
from fastapi import Depends, FastAPI, HTTPException, Header, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .database import SessionLocal, engine, get_db
from common.tools import tool_registry

# --- Initial Setup ---
models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="GENi", version="3.0.0", description="AI Automation Operating System — Agentic Edition")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
redis_conn = redis.Redis.from_url("redis://redis:6379/0", decode_responses=True)

# ═══════════════════════════════════════════════════════════════════════
# STARTUP SEEDING
# ═══════════════════════════════════════════════════════════════════════
@app.on_event("startup")
async def on_startup():
    db = SessionLocal()
    try:
        print("Checking database seeding...")
        # Seed Roles
        if not crud.get_role_by_name(db, "Admin"):
            print("Seeding Roles and Users...")
            for role_name in ["Admin", "Analyst", "Viewer"]:
                crud.create_role(db, schemas.RoleCreate(name=role_name))
            crud.create_user(db, schemas.UserCreate(username="admin_user", password="pw", role_name="Admin"))
            crud.create_user(db, schemas.UserCreate(username="analyst_user", password="pw", role_name="Analyst"))
            crud.create_user(db, schemas.UserCreate(username="viewer_user", password="pw", role_name="Viewer"))

        # Seed Tools
        if not crud.get_all_tools(db):
            print("Seeding Tools...")
            for name, definition in tool_registry.get_all_definitions().items():
                crud.create_tool(db, schemas.ToolCreate(name=name, description=definition.description, category="core"))

        # Seed Skills
        if not crud.get_all_skills(db):
            print("Seeding Skills...")
            skills_seed = [
                {"name": "resume_parsing", "description": "Parse and extract structured data from resumes/CVs", "category": "analysis", "proficiency_level": "expert"},
                {"name": "candidate_ranking", "description": "Rank candidates based on job requirements using scoring algorithms", "category": "reasoning", "proficiency_level": "expert"},
                {"name": "demand_forecasting", "description": "Predict future demand using historical data and ML models", "category": "analysis", "proficiency_level": "expert"},
                {"name": "inventory_optimization", "description": "Optimize inventory levels to minimize cost and stockouts", "category": "analysis", "proficiency_level": "intermediate"},
                {"name": "financial_analysis", "description": "Analyze financial data, ratios, and generate reports", "category": "analysis", "proficiency_level": "expert"},
                {"name": "compliance_review", "description": "Review documents for regulatory and policy compliance", "category": "reasoning", "proficiency_level": "expert"},
                {"name": "report_generation", "description": "Generate structured reports from data and analysis results", "category": "communication", "proficiency_level": "intermediate"},
                {"name": "data_extraction", "description": "Extract structured data from unstructured text or documents", "category": "analysis", "proficiency_level": "intermediate"},
                {"name": "email_composition", "description": "Compose professional emails with appropriate tone and format", "category": "communication", "proficiency_level": "basic"},
                {"name": "task_decomposition", "description": "Break down complex tasks into manageable sub-tasks", "category": "reasoning", "proficiency_level": "expert"},
            ]
            for s in skills_seed:
                crud.create_skill(db, schemas.SkillCreate(**s))

        # Seed Agent Groups
        if not crud.get_all_groups(db):
            print("Seeding Agent Groups...")
            groups_seed = [
                {"name": "Operations", "description": "Agents focused on business operations and logistics", "color": "#4a90e2"},
                {"name": "HR & Recruiting", "description": "Agents specialized in human resources and talent acquisition", "color": "#2ecc71"},
                {"name": "Finance", "description": "Agents handling financial analysis, auditing, and forecasting", "color": "#f39c12"},
                {"name": "Compliance", "description": "Agents focused on regulatory compliance and policy review", "color": "#9b59b6"},
                {"name": "General", "description": "Multi-purpose agents and orchestrators", "color": "#1abc9c"},
            ]
            for g in groups_seed:
                crud.create_group(db, schemas.AgentGroupCreate(**g))

        # Seed Agents (with skills and group assignments)
        if not crud.get_agents(db):
            print("Seeding Agents...")
            agents_to_seed = [
                {"name": "Orchestrator", "description": "Master agent that decomposes tasks and coordinates sub-agents", "tool_names": ["chat"], "skill_names": ["task_decomposition"], "group_name": "General"},
                {"name": "Recruitment Agent", "description": "Expert in hiring, candidate screening, resume parsing", "tool_names": ["resume_analysis", "candidate_ranking"], "skill_names": ["resume_parsing", "candidate_ranking"], "group_name": "HR & Recruiting"},
                {"name": "Manufacturing Optimization Agent", "description": "Expert in inventory, supply chain, production planning", "tool_names": ["inventory_check", "demand_forecasting"], "skill_names": ["demand_forecasting", "inventory_optimization"], "group_name": "Operations"},
                {"name": "General Assistant", "description": "Handles general queries and routing help", "tool_names": ["chat", "help"], "skill_names": ["report_generation", "email_composition"], "group_name": "General"},
                {"name": "Finance Automation Agent", "description": "Expert in forecasting, auditing, and invoice processing", "tool_names": ["financial_forecasting", "invoice_processing", "audit_log_check"], "skill_names": ["financial_analysis", "report_generation"], "group_name": "Finance"},
                {"name": "Compliance Officer", "description": "Reviews documents for policy violations", "tool_names": ["email_sender", "report_generator"], "skill_names": ["compliance_review", "data_extraction"], "group_name": "Compliance"},
                {"name": "Test Data Agent", "description": "Generates synthetic test data for QA environments", "tool_names": ["chat"], "skill_names": ["data_extraction"], "group_name": "Operations"},
                {"name": "Supply Chain Agent", "description": "Monitors and optimizes supply chain operations", "tool_names": ["inventory_check", "demand_forecasting"], "skill_names": ["demand_forecasting", "inventory_optimization"], "group_name": "Operations"},
                {"name": "HR & Recruitment Agent", "description": "Manages employee onboarding, benefits, and HR queries", "tool_names": ["chat", "email_sender"], "skill_names": ["email_composition", "report_generation"], "group_name": "HR & Recruiting"},
            ]
            for data in agents_to_seed:
                crud.create_agent(db, schemas.AgentCreate(**data))

        # Seed Workflows
        if not crud.get_all_workflows(db):
            print("Seeding Workflows...")
            wf1 = schemas.WorkflowCreate(
                name="Candidate Screening Pipeline",
                description="End-to-end candidate screening: parse resume → rank → generate report",
                steps=[
                    schemas.WorkflowStepCreate(step_order=1, name="Parse Resume", step_type="agent", config=json.dumps({"agent_name": "Recruitment Agent", "task": "Parse the candidate resume and extract key information"})),
                    schemas.WorkflowStepCreate(step_order=2, name="Rank Candidate", step_type="skill", config=json.dumps({"skill_name": "candidate_ranking", "agent_name": "Recruitment Agent"})),
                    schemas.WorkflowStepCreate(step_order=3, name="Generate Report", step_type="agent", config=json.dumps({"agent_name": "General Assistant", "task": "Generate a summary report of the candidate evaluation"})),
                ],
                created_by="system"
            )
            crud.create_workflow(db, wf1)

            wf2 = schemas.WorkflowCreate(
                name="Financial Audit Pipeline",
                description="Comprehensive financial audit: check logs → analyze → compliance review → report",
                steps=[
                    schemas.WorkflowStepCreate(step_order=1, name="Check Audit Logs", step_type="tool", config=json.dumps({"tool_name": "audit_log_check", "agent_name": "Finance Automation Agent"})),
                    schemas.WorkflowStepCreate(step_order=2, name="Financial Analysis", step_type="skill", config=json.dumps({"skill_name": "financial_analysis", "agent_name": "Finance Automation Agent"})),
                    schemas.WorkflowStepCreate(step_order=3, name="Compliance Review", step_type="agent", config=json.dumps({"agent_name": "Compliance Officer", "task": "Review the financial analysis for compliance violations"})),
                    schemas.WorkflowStepCreate(step_order=4, name="Generate Audit Report", step_type="agent", config=json.dumps({"agent_name": "General Assistant", "task": "Generate the final audit report"})),
                ],
                created_by="system"
            )
            crud.create_workflow(db, wf2)

            wf3 = schemas.WorkflowCreate(
                name="Inventory Rebalance",
                description="Check inventory → forecast demand → optimize → notify stakeholders",
                steps=[
                    schemas.WorkflowStepCreate(step_order=1, name="Check Inventory", step_type="tool", config=json.dumps({"tool_name": "inventory_check", "agent_name": "Manufacturing Optimization Agent"})),
                    schemas.WorkflowStepCreate(step_order=2, name="Forecast Demand", step_type="skill", config=json.dumps({"skill_name": "demand_forecasting", "agent_name": "Manufacturing Optimization Agent"})),
                    schemas.WorkflowStepCreate(step_order=3, name="Optimize Levels", step_type="skill", config=json.dumps({"skill_name": "inventory_optimization", "agent_name": "Supply Chain Agent"})),
                ],
                created_by="system"
            )
            crud.create_workflow(db, wf3)

        # Seed Agent Knowledge
        if not crud.get_knowledge_for_agent(db, "Recruitment Agent", limit=1):
            print("Seeding Agent Knowledge...")
            knowledge_seed = [
                {"agent_name": "Recruitment Agent", "knowledge_type": "pattern", "topic": "resume_formats", "content": "PDF and DOCX resumes parse best. LinkedIn exports require special handling for skills section.", "confidence": 0.92},
                {"agent_name": "Recruitment Agent", "knowledge_type": "preference", "topic": "ranking_weights", "content": "Experience weight: 0.35, Skills match: 0.30, Education: 0.20, Certifications: 0.15", "confidence": 0.88},
                {"agent_name": "Finance Automation Agent", "knowledge_type": "fact", "topic": "quarterly_deadlines", "content": "Q1: Mar 31, Q2: Jun 30, Q3: Sep 30, Q4: Dec 31. Reports due 15 days after quarter end.", "confidence": 0.95},
                {"agent_name": "Finance Automation Agent", "knowledge_type": "tool_usage", "topic": "invoice_processing", "content": "Invoice OCR works best with high-DPI scans. Amount extraction accuracy: 97.3% on clean scans.", "confidence": 0.85},
                {"agent_name": "Compliance Officer", "knowledge_type": "pattern", "topic": "common_violations", "content": "Top 3 violations: 1) Missing approval signatures (34%), 2) Expired certifications (28%), 3) Budget overspend (22%)", "confidence": 0.90},
                {"agent_name": "Manufacturing Optimization Agent", "knowledge_type": "skill_result", "topic": "demand_accuracy", "content": "7-day demand forecasts have 89% accuracy. 30-day forecasts drop to 72%. Best model: ARIMA with seasonal decomposition.", "confidence": 0.87},
                {"agent_name": "General Assistant", "knowledge_type": "preference", "topic": "report_format", "content": "Users prefer executive summary first, then details. Tables over paragraphs for numeric data. Max 3 pages for summaries.", "confidence": 0.80},
                {"agent_name": "Orchestrator", "knowledge_type": "pattern", "topic": "task_routing", "content": "Tasks mentioning 'resume' or 'candidate' → Recruitment Agent. 'Invoice', 'forecast', 'audit' → Finance. 'Inventory', 'supply' → Manufacturing.", "confidence": 0.93},
            ]
            for k in knowledge_seed:
                crud.create_knowledge(db, schemas.AgentKnowledgeCreate(**k))

    finally:
        db.close()

# ═══════════════════════════════════════════════════════════════════════
# SECURITY
# ═══════════════════════════════════════════════════════════════════════
def get_current_user(x_username: str = Header("analyst_user"), db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, username=x_username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ═══════════════════════════════════════════════════════════════════════
# REQUEST MODELS
# ═══════════════════════════════════════════════════════════════════════
class TaskRequest(BaseModel):
    task: str
    tenant_id: str = "default"
    persona_name: str = "Auto"
    agent_names: List[str] = []  # Multi-agent support
    session_id: str = ""
    source: str = "dashboard"

class WebhookRequest(BaseModel):
    task: str
    tenant_id: str
    persona_name: str = "Auto"
    source: str = "webhook"
    initiator: str = "openclaw"
    callback_url: Optional[str] = None
    session_id: Optional[str] = None

# ═══════════════════════════════════════════════════════════════════════
# STATIC FILE SERVING
# ═══════════════════════════════════════════════════════════════════════
@app.get("/", response_class=FileResponse)
async def root():
    return "app/static/react-ui/index.html"

# ═══════════════════════════════════════════════════════════════════════
# CORE API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════
@app.get("/api/user-info", response_model=schemas.User)
def get_user_info(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.get("/api/agents", response_model=List[schemas.Agent])
def get_agents(db: Session = Depends(get_db)):
    return crud.get_agents(db)

@app.post("/api/agents", response_model=schemas.Agent, status_code=201)
def create_agent(agent: schemas.AgentCreate, db: Session = Depends(get_db)):
    existing = crud.get_agent_by_name(db, name=agent.name)
    if existing:
        raise HTTPException(status_code=409, detail=f"Agent '{agent.name}' already exists")
    return crud.create_agent(db, agent)

@app.get("/api/tools")
def get_tools(db: Session = Depends(get_db)):
    return crud.get_all_tools(db)

@app.post("/api/tools", status_code=201)
def create_tool_endpoint(tool: schemas.ToolCreate, db: Session = Depends(get_db)):
    existing = crud.get_tool_by_name(db, tool.name)
    if existing:
        raise HTTPException(status_code=409, detail=f"Tool '{tool.name}' already exists")
    return crud.create_tool(db, tool)

@app.put("/api/tools/{tool_id}")
def update_tool_endpoint(tool_id: int, update: schemas.ToolUpdate, db: Session = Depends(get_db)):
    result = crud.update_tool(db, tool_id, update)
    if not result:
        raise HTTPException(status_code=404, detail="Tool not found")
    return result

@app.get("/api/task-logs", response_model=List[schemas.TaskLog])
def get_task_logs(db: Session = Depends(get_db)):
    return crud.get_task_logs(db, limit=100)

@app.get("/api/analytics", response_model=schemas.AnalyticsData)
def get_analytics(db: Session = Depends(get_db)):
    return {
        "kpis": crud.get_analytics_kpis(db),
        "agent_usage": crud.get_agent_usage_stats(db),
        "status_distribution": crud.get_status_distribution(db),
        "daily_volume": crud.get_daily_task_volume(db)
    }

@app.get("/api/memories/{agent_name}", response_model=List[schemas.Memory])
def get_memories(agent_name: str, db: Session = Depends(get_db)):
    return crud.get_memories_by_agent(db, agent_name=agent_name, limit=50)

# ═══════════════════════════════════════════════════════════════════════
# SKILLS API
# ═══════════════════════════════════════════════════════════════════════
@app.get("/api/skills")
def get_skills(db: Session = Depends(get_db)):
    skills = crud.get_all_skills(db)
    return [
        {
            "id": s.id, "name": s.name, "description": s.description,
            "category": s.category, "proficiency_level": s.proficiency_level,
            "is_active": s.is_active, "agent_count": len(s.agents),
            "agents": [a.name for a in s.agents],
        }
        for s in skills
    ]

@app.post("/api/skills", status_code=201)
def create_skill_endpoint(skill: schemas.SkillCreate, db: Session = Depends(get_db)):
    existing = crud.get_skill_by_name(db, skill.name)
    if existing:
        raise HTTPException(status_code=409, detail=f"Skill '{skill.name}' already exists")
    return crud.create_skill(db, skill)

@app.put("/api/skills/{skill_id}")
def update_skill_endpoint(skill_id: int, update: schemas.SkillUpdate, db: Session = Depends(get_db)):
    result = crud.update_skill(db, skill_id, update)
    if not result:
        raise HTTPException(status_code=404, detail="Skill not found")
    return result

@app.delete("/api/skills/{skill_id}")
def delete_skill_endpoint(skill_id: int, db: Session = Depends(get_db)):
    result = crud.delete_skill(db, skill_id)
    if not result:
        raise HTTPException(status_code=404, detail="Skill not found")
    return {"deleted": True}

@app.post("/api/agents/{agent_name}/skills")
def assign_skills_endpoint(agent_name: str, skill_names: List[str], db: Session = Depends(get_db)):
    result = crud.assign_skills_to_agent(db, agent_name, skill_names)
    if not result:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"agent": agent_name, "skills": [s.name for s in result.skills]}

@app.delete("/api/agents/{agent_name}/skills/{skill_name}")
def remove_skill_endpoint(agent_name: str, skill_name: str, db: Session = Depends(get_db)):
    result = crud.remove_skill_from_agent(db, agent_name, skill_name)
    if not result:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"agent": agent_name, "skills": [s.name for s in result.skills]}

# ═══════════════════════════════════════════════════════════════════════
# AGENT GROUPS API
# ═══════════════════════════════════════════════════════════════════════
@app.get("/api/agent-groups")
def get_groups(db: Session = Depends(get_db)):
    groups = crud.get_all_groups(db)
    return [
        {
            "id": g.id, "name": g.name, "description": g.description,
            "color": g.color, "member_count": len(g.members),
            "members": [{"name": a.name, "status": a.status} for a in g.members],
            "created_at": g.created_at.isoformat() if g.created_at else None,
        }
        for g in groups
    ]

@app.post("/api/agent-groups", status_code=201)
def create_group_endpoint(group: schemas.AgentGroupCreate, db: Session = Depends(get_db)):
    existing = crud.get_group_by_name(db, group.name)
    if existing:
        raise HTTPException(status_code=409, detail=f"Group '{group.name}' already exists")
    return crud.create_group(db, group)

@app.put("/api/agent-groups/{group_id}")
def update_group_endpoint(group_id: int, update: schemas.AgentGroupUpdate, db: Session = Depends(get_db)):
    result = crud.update_group(db, group_id, update)
    if not result:
        raise HTTPException(status_code=404, detail="Group not found")
    return result

@app.delete("/api/agent-groups/{group_id}")
def delete_group_endpoint(group_id: int, db: Session = Depends(get_db)):
    result = crud.delete_group(db, group_id)
    if not result:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"deleted": True}

@app.post("/api/agent-groups/{group_id}/members")
def add_member_endpoint(group_id: int, agent_name: str, db: Session = Depends(get_db)):
    result = crud.add_agent_to_group(db, group_id, agent_name)
    if not result:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"agent": agent_name, "group_id": group_id}

@app.delete("/api/agent-groups/{group_id}/members/{agent_name}")
def remove_member_endpoint(group_id: int, agent_name: str, db: Session = Depends(get_db)):
    result = crud.remove_agent_from_group(db, agent_name)
    if not result:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"agent": agent_name, "removed_from_group": True}

# ═══════════════════════════════════════════════════════════════════════
# SCHEDULED TASKS API
# ═══════════════════════════════════════════════════════════════════════
@app.get("/api/scheduled-tasks")
def get_scheduled_tasks(db: Session = Depends(get_db)):
    tasks = crud.get_all_scheduled_tasks(db)
    return [
        {
            "id": t.id, "name": t.name, "description": t.description,
            "task_description": t.task_description,
            "cron_expression": t.cron_expression, "scheduled_at": t.scheduled_at.isoformat() if t.scheduled_at else None,
            "next_run_at": t.next_run_at.isoformat() if t.next_run_at else None,
            "last_run_at": t.last_run_at.isoformat() if t.last_run_at else None,
            "last_task_id": t.last_task_id,
            "assigned_agents": json.loads(t.assigned_agents or "[]"),
            "auto_route": t.auto_route, "required_skills": json.loads(t.required_skills or "[]"),
            "required_tools": json.loads(t.required_tools or "[]"),
            "status": t.status, "repeat_count": t.repeat_count, "runs_completed": t.runs_completed,
            "created_by": t.created_by, "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tasks
    ]

@app.post("/api/scheduled-tasks", status_code=201)
def create_scheduled_task_endpoint(task: schemas.ScheduledTaskCreate, db: Session = Depends(get_db)):
    return crud.create_scheduled_task(db, task)

@app.put("/api/scheduled-tasks/{task_id}")
def update_scheduled_task_endpoint(task_id: int, update: schemas.ScheduledTaskUpdate, db: Session = Depends(get_db)):
    result = crud.update_scheduled_task(db, task_id, update)
    if not result:
        raise HTTPException(status_code=404, detail="Scheduled task not found")
    return result

@app.delete("/api/scheduled-tasks/{task_id}")
def delete_scheduled_task_endpoint(task_id: int, db: Session = Depends(get_db)):
    result = crud.delete_scheduled_task(db, task_id)
    if not result:
        raise HTTPException(status_code=404, detail="Scheduled task not found")
    return {"deleted": True}

# ═══════════════════════════════════════════════════════════════════════
# WORKFLOWS API
# ═══════════════════════════════════════════════════════════════════════
@app.get("/api/workflows")
def get_workflows(db: Session = Depends(get_db)):
    workflows = crud.get_all_workflows(db)
    return [
        {
            "id": w.id, "name": w.name, "description": w.description,
            "is_active": w.is_active, "created_by": w.created_by,
            "created_at": w.created_at.isoformat() if w.created_at else None,
            "updated_at": w.updated_at.isoformat() if w.updated_at else None,
            "step_count": len(w.steps),
            "steps": [
                {
                    "id": s.id, "step_order": s.step_order, "name": s.name,
                    "step_type": s.step_type, "config": json.loads(s.config or "{}"),
                    "on_success": s.on_success, "on_failure": s.on_failure,
                }
                for s in w.steps
            ],
        }
        for w in workflows
    ]

@app.post("/api/workflows", status_code=201)
def create_workflow_endpoint(workflow: schemas.WorkflowCreate, db: Session = Depends(get_db)):
    existing = crud.get_workflow_by_name(db, workflow.name)
    if existing:
        raise HTTPException(status_code=409, detail=f"Workflow '{workflow.name}' already exists")
    return crud.create_workflow(db, workflow)

@app.put("/api/workflows/{workflow_id}")
def update_workflow_endpoint(workflow_id: int, update: schemas.WorkflowUpdate, db: Session = Depends(get_db)):
    result = crud.update_workflow(db, workflow_id, update)
    if not result:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return result

@app.delete("/api/workflows/{workflow_id}")
def delete_workflow_endpoint(workflow_id: int, db: Session = Depends(get_db)):
    result = crud.delete_workflow(db, workflow_id)
    if not result:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"deleted": True}

@app.post("/api/workflows/{workflow_id}/steps", status_code=201)
def add_step_endpoint(workflow_id: int, step: schemas.WorkflowStepCreate, db: Session = Depends(get_db)):
    wf = crud.get_workflow_by_id(db, workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return crud.add_workflow_step(db, workflow_id, step)

@app.put("/api/workflow-steps/{step_id}")
def update_step_endpoint(step_id: int, update: schemas.WorkflowStepUpdate, db: Session = Depends(get_db)):
    result = crud.update_workflow_step(db, step_id, update)
    if not result:
        raise HTTPException(status_code=404, detail="Step not found")
    return result

@app.delete("/api/workflow-steps/{step_id}")
def delete_step_endpoint(step_id: int, db: Session = Depends(get_db)):
    result = crud.delete_workflow_step(db, step_id)
    if not result:
        raise HTTPException(status_code=404, detail="Step not found")
    return {"deleted": True}

@app.post("/api/workflows/{workflow_id}/run", status_code=202)
async def run_workflow_endpoint(workflow_id: int, db: Session = Depends(get_db)):
    """Execute a workflow by creating tasks for each step."""
    wf = crud.get_workflow_by_id(db, workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    parent_task_id = str(uuid.uuid4())
    log_entry = schemas.TaskLogCreate(
        task_id=parent_task_id,
        agent_name="Orchestrator",
        business_unit="workflow",
        status="QUEUED",
        request_payload=json.dumps({"workflow_id": wf.id, "workflow_name": wf.name})
    )
    crud.create_task_log(db, log_entry)

    task_payload = {
        "task_id": parent_task_id,
        "task": f"Execute workflow: {wf.name}",
        "persona_name": "Orchestrator",
        "tenant_id": "workflow",
        "source": "workflow",
        "use_orchestrator": True,
        "workflow_id": wf.id,
    }
    redis_conn.rpush('task_queue', json.dumps(task_payload))

    redis_conn.publish("events", json.dumps({
        "event_type": "WORKFLOW_STARTED",
        "task_id": parent_task_id,
        "workflow_name": wf.name,
        "step_count": len(wf.steps),
    }))

    return {"task_id": parent_task_id, "workflow": wf.name, "status": "QUEUED", "steps": len(wf.steps)}

# ═══════════════════════════════════════════════════════════════════════
# AGENT KNOWLEDGE API
# ═══════════════════════════════════════════════════════════════════════
@app.get("/api/agent-knowledge/{agent_name}")
def get_agent_knowledge(agent_name: str, q: Optional[str] = None, db: Session = Depends(get_db)):
    if q:
        items = crud.search_knowledge(db, agent_name, q)
    else:
        items = crud.get_knowledge_for_agent(db, agent_name)
    return [
        {
            "id": k.id, "agent_name": k.agent_name,
            "knowledge_type": k.knowledge_type, "topic": k.topic,
            "content": k.content, "confidence": k.confidence,
            "source_task_id": k.source_task_id, "usage_count": k.usage_count,
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
            "created_at": k.created_at.isoformat() if k.created_at else None,
        }
        for k in items
    ]

@app.post("/api/agent-knowledge", status_code=201)
def create_knowledge_endpoint(knowledge: schemas.AgentKnowledgeCreate, db: Session = Depends(get_db)):
    return crud.create_knowledge(db, knowledge)

@app.delete("/api/agent-knowledge/{knowledge_id}")
def delete_knowledge_endpoint(knowledge_id: int, db: Session = Depends(get_db)):
    result = crud.delete_knowledge(db, knowledge_id)
    if not result:
        raise HTTPException(status_code=404, detail="Knowledge entry not found")
    return {"deleted": True}

# ═══════════════════════════════════════════════════════════════════════
# TASK SUBMISSION (Dashboard / API) — with Multi-Agent Support
# ═══════════════════════════════════════════════════════════════════════
@app.post("/api/tasks", status_code=202)
async def create_task(task_request: TaskRequest, db: Session = Depends(get_db)):
    task_id = str(uuid.uuid4())

    # Determine agent name(s)
    agent_display = task_request.persona_name
    if task_request.agent_names and len(task_request.agent_names) > 0:
        agent_display = ", ".join(task_request.agent_names)

    log_entry = schemas.TaskLogCreate(
        task_id=task_id,
        agent_name=agent_display,
        business_unit=task_request.tenant_id,
        status="QUEUED",
        request_payload=json.dumps({
            "task": task_request.task,
            "source": task_request.source,
            "agent_names": task_request.agent_names,
        })
    )
    crud.create_task_log(db, log_entry)

    task_payload = {
        "task_id": task_id,
        "task": task_request.task,
        "persona_name": task_request.persona_name,
        "agent_names": task_request.agent_names,
        "tenant_id": task_request.tenant_id,
        "session_id": task_request.session_id,
        "source": task_request.source,
        "use_orchestrator": True,
    }
    redis_conn.rpush('task_queue', json.dumps(task_payload))

    redis_conn.publish("events", json.dumps({
        "event_type": "TASK_QUEUED",
        "task_id": task_id,
        "persona_name": agent_display,
        "agent_names": task_request.agent_names,
    }))

    return {"task_id": task_id, "status": "QUEUED", "agents": agent_display}

# ═══════════════════════════════════════════════════════════════════════
# WEBHOOK ENDPOINT (OpenClaw → Enterprise Core)
# ═══════════════════════════════════════════════════════════════════════
@app.post("/v1/openclaw/webhook", status_code=202)
async def openclaw_webhook(request: WebhookRequest, db: Session = Depends(get_db)):
    """
    Webhook endpoint for OpenClaw CLI integration.
    """
    task_id = str(uuid.uuid4())
    session_id = request.session_id or str(uuid.uuid4())

    log_entry = schemas.TaskLogCreate(
        task_id=task_id,
        agent_name=request.persona_name,
        business_unit=request.tenant_id,
        status="QUEUED",
        request_payload=json.dumps({
            "task": request.task,
            "source": request.source,
            "initiator": request.initiator,
            "callback_url": request.callback_url,
            "session_id": session_id,
        })
    )
    crud.create_task_log(db, log_entry)

    task_payload = {
        "task_id": task_id,
        "task": request.task,
        "persona_name": request.persona_name,
        "tenant_id": request.tenant_id,
        "source": request.source,
        "session_id": session_id,
        "use_orchestrator": True,
        "callback_url": request.callback_url,
        "initiator": request.initiator,
    }
    redis_conn.rpush('task_queue', json.dumps(task_payload))

    redis_conn.publish("events", json.dumps({
        "event_type": "TASK_QUEUED",
        "task_id": task_id,
        "source": "webhook",
        "initiator": request.initiator,
        "session_id": session_id,
    }))

    return {
        "task_id": task_id,
        "session_id": session_id,
        "status": "QUEUED",
        "message": "Task enqueued for agentic processing",
    }

# ═══════════════════════════════════════════════════════════════════════
# OPENCLAW EXECUTOR APIs (Bidirectional Communication)
# ═══════════════════════════════════════════════════════════════════════
@app.get("/v1/openclaw/task/{task_id}/status")
async def openclaw_task_status(task_id: str, db: Session = Depends(get_db)):
    """Poll endpoint for OpenClaw to check task status and get results."""
    task_log = crud.get_task_log_by_id(db, task_id)
    if not task_log:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")

    agent_state = crud.get_agent_state(db, task_id)

    response = {
        "task_id": task_id,
        "status": task_log.status,
        "agent_name": task_log.agent_name,
        "started_at": task_log.start_time.isoformat() if task_log.start_time else None,
        "completed_at": task_log.end_time.isoformat() if task_log.end_time else None,
        "duration_ms": task_log.duration_ms,
    }

    if agent_state:
        response["execution_state"] = {
            "current_step": agent_state.current_step,
            "max_steps": agent_state.max_steps,
            "loop_status": agent_state.status,
            "reasoning_trace": json.loads(agent_state.reasoning_trace or "[]"),
        }

    if task_log.status in ("success", "failure", "partial_success"):
        response["result"] = json.loads(task_log.response_payload) if task_log.response_payload else None
        response["model_used"] = task_log.primary_model_used
        response["token_usage"] = task_log.token_usage
        response["estimated_cost"] = task_log.estimated_cost

    sub_tasks = crud.get_sub_tasks(db, task_id)
    if sub_tasks:
        response["sub_tasks"] = [
            {
                "sub_task_id": st.task_id,
                "agent_name": st.agent_name,
                "status": st.status,
                "delegated_by": st.delegated_by,
                "duration_ms": st.duration_ms,
            }
            for st in sub_tasks
        ]

    return response

@app.get("/v1/openclaw/task/{task_id}/tree")
async def openclaw_task_tree(task_id: str, db: Session = Depends(get_db)):
    tree = crud.get_task_tree(db, task_id)
    if not tree:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")
    return tree

@app.get("/v1/openclaw/task/{task_id}/messages")
async def openclaw_task_messages(task_id: str, db: Session = Depends(get_db)):
    messages = crud.get_messages_for_task(db, task_id)
    return [
        {
            "message_id": m.message_id,
            "sender": m.sender_agent,
            "receiver": m.receiver_agent,
            "type": m.message_type,
            "content": json.loads(m.content) if m.content else None,
            "status": m.status,
            "timestamp": m.timestamp.isoformat(),
        }
        for m in messages
    ]

@app.get("/v1/openclaw/session/{session_id}/history")
async def openclaw_session_history(session_id: str, db: Session = Depends(get_db)):
    all_logs = crud.get_task_logs(db, limit=500)
    session_tasks = []
    for log in all_logs:
        try:
            payload = json.loads(log.request_payload) if log.request_payload else {}
            if payload.get("session_id") == session_id:
                session_tasks.append({
                    "task_id": log.task_id,
                    "agent_name": log.agent_name,
                    "status": log.status,
                    "request": payload.get("task", ""),
                    "response": json.loads(log.response_payload).get("summary", "") if log.response_payload else None,
                    "timestamp": log.start_time.isoformat() if log.start_time else None,
                })
        except (json.JSONDecodeError, AttributeError):
            continue

    return {
        "session_id": session_id,
        "task_count": len(session_tasks),
        "tasks": session_tasks,
    }

# ═══════════════════════════════════════════════════════════════════════
# OBSERVABILITY ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════
@app.get("/api/agent-states")
def get_active_agent_states(db: Session = Depends(get_db)):
    """Get all active agent execution states for the observability dashboard."""
    from sqlalchemy import not_
    active_states = db.query(models.AgentState).filter(
        not_(models.AgentState.status.in_(["complete", "failed"]))
    ).all()
    return [
        {
            "task_id": s.task_id,
            "agent_name": s.agent_name,
            "current_step": s.current_step,
            "max_steps": s.max_steps,
            "status": s.status,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in active_states
    ]

@app.get("/api/agent-messages/{task_id}")
def get_agent_messages(task_id: str, db: Session = Depends(get_db)):
    """Get inter-agent messages for a specific task."""
    messages = crud.get_messages_for_task(db, task_id)
    return [
        {
            "message_id": m.message_id,
            "sender": m.sender_agent,
            "receiver": m.receiver_agent,
            "type": m.message_type,
            "content": m.content,
            "status": m.status,
            "timestamp": m.timestamp.isoformat() if m.timestamp else None,
        }
        for m in messages
    ]

@app.get("/api/task-tree/{task_id}")
def get_task_tree(task_id: str, db: Session = Depends(get_db)):
    """Get task hierarchy tree for visualization."""
    tree = crud.get_task_tree(db, task_id)
    if not tree:
        raise HTTPException(status_code=404, detail="Task not found")
    return tree

# ═══════════════════════════════════════════════════════════════════════
# WEBSOCKET EVENT STREAM (Real-Time Observability)
# ═══════════════════════════════════════════════════════════════════════
@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    """
    WebSocket endpoint for real-time event streaming.
    Subscribes to the Redis Pub/Sub 'events' channel and forwards all events to the client.
    """
    await websocket.accept()

    try:
        aredis = aioredis.from_url("redis://redis:6379/0", decode_responses=True)
        pubsub = aredis.pubsub()
        await pubsub.subscribe("events")

        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message["type"] == "message":
                await websocket.send_text(message["data"])
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if pubsub:
            await pubsub.unsubscribe("events")
