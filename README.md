# GENi — Global Enterprise Neural - intelligence

**AI Automation Operating System — Agentic Edition v2.0**

GENi is an enterprise-grade AI automation platform that enables organizations to deploy, manage, and orchestrate AI agents for business process automation. Built with a true **agentic architecture** featuring multi-agent orchestration, inter-agent communication, and ReAct-style execution loops.

## Architecture

```
                            ┌──────────────────┐
                            │    OpenClaw CLI   │
                            │   (Executor Hub)  │
                            └────────┬─────────┘
                                     │ webhook + callback
                                     ▼
┌──────────────┐     ┌───────────────────────────┐     ┌──────────────────┐
│   React UI   │────▶│      FastAPI Core          │────▶│   Background     │
│  (Dashboard) │     │  (API + WebSocket + Auth)  │     │    Worker        │
└──────────────┘     └─────────────┬──────────────┘     └────────┬─────────┘
                                   │                              │
                            ┌──────┴───────┐            ┌────────┴──────────┐
                            │  PostgreSQL  │            │    Orchestrator    │
                            │  (Data Store)│            │  (Task Decomposer)│
                            └──────────────┘            └────────┬──────────┘
                                                                 │
                                                    ┌────────────┼───────────────┐
                                                    │            │               │
                                              ┌─────▼────┐ ┌────▼─────┐ ┌───────▼──────┐
                                              │ Agent A   │ │ Agent B  │ │  Agent C     │
                                              │ (ReAct)   │ │ (ReAct)  │ │  (ReAct)     │
                                              └─────┬─────┘ └────┬─────┘ └───────┬──────┘
                                                    │            │               │
                                              ┌─────▼────────────▼───────────────▼──────┐
                                              │     Communication Bus (Redis Pub/Sub)    │
                                              │   Direct Messages • Delegation • Results │
                                              └─────────────────────────────────────────--┘
```

## Key Features

### 🤖 Agentic Architecture
- **Orchestrator Agent** — Decomposes complex tasks into sub-tasks and delegates to specialized agents
- **ReAct Execution Loop** — Think → Act → Observe cycle for each agent with LLM-driven reasoning
- **Sub-Agent Delegation** — Agents can recursively delegate to other agents with full task hierarchy tracking
- **Inter-Agent Communication Bus** — Redis-backed messaging with direct, delegation, result, and broadcast channels

### 🔗 OpenClaw Integration (Executor)
- **Bidirectional Communication** — OpenClaw sends tasks via webhook, receives results via callback URL
- **Task Status Polling** — Real-time status + execution state (step-by-step reasoning trace)
- **Task Tree Visualization** — Full parent → child orchestration hierarchy
- **Session Management** — Multi-turn conversations with conversation history
- **Agent Message Trace** — View all inter-agent messages for any task

### 📊 Enterprise Features
- **Real-Time Dashboard** — Live KPIs, charts, agent accomplishments
- **Multi-LLM Support** — Google Gemini, OpenAI, Anthropic with automatic fallback
- **Execution Observability** — WebSocket event stream with 20+ event types
- **Task Results Viewer** — Detailed task input/output with agent reasoning traces
- **Multi-Tenant** — Tenant isolation across all layers
- **RBAC** — Role-based access control

## Tech Stack

- **Frontend:** React 17 + Material-UI 5 + Chart.js
- **Backend:** Python / FastAPI / Uvicorn
- **Database:** PostgreSQL 13
- **Queue/Events:** Redis 7 (Queue + Pub/Sub + Communication Bus)
- **LLM Providers:** Google Gemini / OpenAI / Mock mode
- **Infrastructure:** Docker Compose

## Quick Start

```bash
# Clone the repository
git clone https://github.com/kkyala/EnterpriseClaw.git
cd EnterpriseClaw

# (Optional) Set LLM API keys for real AI reasoning
export GOOGLE_API_KEY=your-gemini-key
export OPENAI_API_KEY=your-openai-key

# Start all services
docker-compose up -d --build

# Access the application
open http://localhost:8000
```

> **Note:** Without API keys, the system runs in **Mock mode** with intelligent keyword-based routing. All agentic features (orchestration, delegation, ReAct loops) work in mock mode.

## Default Users

| Username | Role | Password |
|----------|------|----------|
| admin_user | Admin | pw |
| analyst_user | Analyst | pw |
| viewer_user | Viewer | pw |

## API Endpoints

### Core APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | GENi Dashboard |
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create new agent |
| POST | `/api/tasks` | Submit a task (auto-routed via Orchestrator) |
| GET | `/api/task-logs` | Get execution logs |
| GET | `/api/analytics` | Dashboard analytics |
| GET | `/api/memories/{agent}` | Agent conversation memory |
| WS | `/ws/events` | Real-time event stream |

### OpenClaw Executor APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/openclaw/webhook` | Submit task from OpenClaw |
| GET | `/v1/openclaw/task/{id}/status` | Poll task status + execution state |
| GET | `/v1/openclaw/task/{id}/tree` | Full task orchestration tree |
| GET | `/v1/openclaw/task/{id}/messages` | Inter-agent message trace |
| GET | `/v1/openclaw/session/{id}/history` | Multi-turn conversation history |

### Observability APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agent-states` | Active agent execution states |
| GET | `/api/agent-messages/{task_id}` | Agent messages for a task |
| GET | `/api/task-tree/{task_id}` | Task hierarchy visualization |

## Architecture Components

### 1. Orchestrator (`core/orchestrator.py`)
Receives tasks, uses LLM to analyze complexity, decomposes complex tasks into sub-tasks, and delegates to specialized agents. Aggregates results into a unified response.

### 2. Execution Loop (`core/execution_loop.py`)
ReAct-style loop: Think → Act → Observe. Each agent runs through this loop, making LLM-driven decisions at each step. Supports tool execution, sub-agent delegation, and final answer generation.

### 3. Communication Bus (`core/communication.py`)
Redis-backed inter-agent messaging. Supports direct messages, delegation requests, result reporting, broadcasts, shared task context, and wait-for-result with timeout.

### 4. Persona System (`core/persona.py`)
Defines agent identities, capabilities, tool bindings, and system prompt templates. The Orchestrator persona can delegate to all other agents.

### 5. LLM Service (`services/llm.py`)
Multi-provider LLM client with Google Gemini, OpenAI, and intelligent mock mode. Handles structured JSON responses, task decomposition, and result summarization.

## Event Types (WebSocket)

| Event | Description |
|-------|-------------|
| `TASK_QUEUED` | Task added to processing queue |
| `TASK_STARTED` | Worker picked up the task |
| `TASK_COMPLETED` | Task finished successfully |
| `TASK_FAILED` | Task failed with error |
| `ORCHESTRATOR_STARTED` | Orchestrator began processing |
| `ORCHESTRATOR_ANALYZING` | Analyzing task complexity |
| `ORCHESTRATOR_PLAN_READY` | Decomposition plan created |
| `ORCHESTRATOR_SUB_TASK_STARTED` | Sub-task delegated |
| `ORCHESTRATOR_SUB_TASK_COMPLETED` | Sub-task finished |
| `ORCHESTRATOR_AGGREGATING` | Aggregating sub-results |
| `ORCHESTRATOR_COMPLETED` | Full orchestration complete |
| `EXEC_LOOP_STARTED` | Agent execution loop started |
| `EXEC_STEP_THINKING` | Agent is reasoning (Think) |
| `EXEC_STEP_ACTING` | Agent is executing (Act) |
| `EXEC_STEP_DELEGATING` | Agent is delegating |
| `EXEC_STEP_OBSERVED` | Step observation recorded |
| `EXEC_STEP_FINAL` | Agent produced final answer |
| `EXEC_LOOP_COMPLETED` | Execution loop finished |
| `AGENT_MESSAGE_SENT` | Inter-agent message sent |
| `AGENT_BROADCAST` | Agent broadcast message |
| `OPENCLAW_CALLBACK_SENT` | Result sent to OpenClaw |

## License

Proprietary — All rights reserved.

---

**GENi** — Global Enterprise Neural Intelligence
