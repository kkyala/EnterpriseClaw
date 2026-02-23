import asyncio
import json
import uuid
import random
from typing import List

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
app = FastAPI(title="GENi", version="1.0.0", description="AI Automation Operating System")

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

# --- Idempotent Database Seeding ---
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
                crud.create_tool(db, schemas.ToolCreate(name=name, description=definition.description))
        
        # Seed Agents
        if not crud.get_agents(db):
            print("Seeding Agents...")
            agents_to_seed = [ schemas.AgentCreate(**data) for data in [
                {"name":"Recruitment Agent", "description":"Expert in hiring, candidate screening, resume parsing", "tool_names":["resume_analysis", "candidate_ranking"]},
                {"name":"Manufacturing Optimization Agent", "description":"Expert in inventory, supply chain, production planning", "tool_names":["inventory_check", "demand_forecasting"]},
                {"name":"General Assistant", "description":"Handles general queries and routing help", "tool_names":["chat", "help"]},
                {"name":"Finance Automation Agent", "description":"Expert in forecasting, auditing, and invoice processing", "tool_names":["financial_forecasting", "invoice_processing", "audit_log_check"]},
                {"name":"Compliance Officer", "description":"Reviews documents for policy violations", "tool_names":["email_sender", "report_generator"]},
            ]]
            for agent in agents_to_seed: crud.create_agent(db, agent)
    finally:
        db.close()

# ---------------------------------------------------------------------------
# SECURITY
# ---------------------------------------------------------------------------
def get_current_user(x_username: str = Header("analyst_user"), db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, username=x_username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ---------------------------------------------------------------------------
# REQUEST MODELS
# ---------------------------------------------------------------------------
class TaskRequest(BaseModel):
    task: str
    tenant_id: str = "default"
    persona_name: str = "General Assistant"
    session_id: str = ""
    source: str = "dashboard"  # chat | dashboard | api | webhook

class WebhookRequest(BaseModel):
    task: str
    tenant_id: str
    persona_name: str = "General Assistant"
    source: str = "webhook"
    initiator: str = "openclaw"

# ---------------------------------------------------------------------------
# STATIC FILE SERVING
# ---------------------------------------------------------------------------
@app.get("/", response_class=FileResponse)
async def root():
    return "app/static/react-ui/index.html"

# ---------------------------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# TASK SUBMISSION (Dashboard / API)
# ---------------------------------------------------------------------------
@app.post("/api/tasks", status_code=202)
async def create_task(task_request: TaskRequest, db: Session = Depends(get_db)):
    task_id = str(uuid.uuid4())
    
    # Create task log entry
    log_entry = schemas.TaskLogCreate(
        task_id=task_id,
        agent_name=task_request.persona_name,
        business_unit=task_request.tenant_id,
        status="QUEUED",
        request_payload=json.dumps({"task": task_request.task, "source": task_request.source})
    )
    crud.create_task_log(db, log_entry)
    
    # Enqueue task for async processing
    task_payload = {
        "task_id": task_id,
        "task": task_request.task,
        "persona_name": task_request.persona_name,
        "tenant_id": task_request.tenant_id,
        "session_id": task_request.session_id,
        "source": task_request.source
    }
    redis_conn.rpush('task_queue', json.dumps(task_payload))
    
    # Emit TASK_QUEUED event
    redis_conn.publish("events", json.dumps({
        "event_type": "TASK_QUEUED",
        "task_id": task_id,
        "persona_name": task_request.persona_name
    }))
    
    return {"task_id": task_id, "status": "QUEUED"}

# ---------------------------------------------------------------------------
# WEBHOOK ENDPOINT (OpenClaw → Enterprise Core)
# ---------------------------------------------------------------------------
@app.post("/v1/openclaw/webhook", status_code=202)
async def openclaw_webhook(request: WebhookRequest, db: Session = Depends(get_db)):
    """
    Webhook endpoint for OpenClaw CLI integration.
    OpenClaw forwards chat-based requests here for processing by the Enterprise Core.
    """
    task_id = str(uuid.uuid4())
    
    log_entry = schemas.TaskLogCreate(
        task_id=task_id,
        agent_name=request.persona_name,
        business_unit=request.tenant_id,
        status="QUEUED",
        request_payload=json.dumps({
            "task": request.task,
            "source": request.source,
            "initiator": request.initiator
        })
    )
    crud.create_task_log(db, log_entry)
    
    task_payload = {
        "task_id": task_id,
        "task": request.task,
        "persona_name": request.persona_name,
        "tenant_id": request.tenant_id,
        "source": request.source
    }
    redis_conn.rpush('task_queue', json.dumps(task_payload))
    
    redis_conn.publish("events", json.dumps({
        "event_type": "TASK_QUEUED",
        "task_id": task_id,
        "source": "webhook"
    }))
    
    return {"task_id": task_id, "status": "QUEUED", "message": "Task enqueued for processing"}

# ---------------------------------------------------------------------------
# WEBSOCKET EVENT STREAM (Real-Time Observability)
# ---------------------------------------------------------------------------
@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    """
    WebSocket endpoint for real-time event streaming.
    Subscribes to the Redis Pub/Sub 'events' channel and forwards all events to the client.
    """
    await websocket.accept()
    
    # Use aioredis for async pub/sub
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
