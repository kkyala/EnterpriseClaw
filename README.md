# GENi — Global Enterprise Neural - intelligence

**AI Automation Operating System**

GENi is an enterprise-grade AI automation platform that enables organizations to deploy, manage, and orchestrate AI agents for business process automation across healthcare, banking, retail, and more.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   React UI   │────▶│  FastAPI Core │────▶│    Worker     │
│  (Dashboard) │     │  (API + WS)  │     │ (Task Engine) │
└──────────────┘     └──────┬───────┘     └──────┬───────┘
                            │                     │
                     ┌──────┴───────┐      ┌──────┴───────┐
                     │  PostgreSQL  │      │    Redis      │
                     │  (Data Store)│      │ (Queue + Pub) │
                     └──────────────┘      └──────────────┘
```

## Features

- **AI Workforce Management** — Create, configure, and deploy AI agents with custom personas
- **Event-Driven Architecture** — Async task processing with Redis queue and Pub/Sub
- **Real-Time Dashboard** — Live KPIs, charts, agent accomplishments
- **Task Results Viewer** — Detailed task input/output with agent responses
- **Execution Logs** — Full audit trail with expandable request/response details
- **WebSocket Events** — Real-time system event streaming
- **Webhook Integration** — `/v1/openclaw/webhook` for external system integration
- **Multi-Tenant** — Tenant isolation across all layers
- **Theme Support** — Dark and light mode
- **Agent Templates** — Pre-built persona templates for quick deployment

## Tech Stack

- **Frontend:** React 17 + Material-UI 5 + Chart.js
- **Backend:** Python / FastAPI / Uvicorn
- **Database:** PostgreSQL 13
- **Queue/Events:** Redis 7
- **Infrastructure:** Docker Compose

## Quick Start

```bash
# Clone the repository
git clone https://github.com/kkyala/EnterpriseClaw.git
cd EnterpriseClaw

# Start all services
docker-compose up -d --build

# Access the application
open http://localhost:8000
```

## Default Users

| Username | Role | Password |
|----------|------|----------|
| admin_user | Admin | pw |
| analyst_user | Analyst | pw |
| viewer_user | Viewer | pw |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | GENi Dashboard |
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create new agent |
| POST | `/api/tasks` | Submit a task |
| GET | `/api/task-logs` | Get execution logs |
| GET | `/api/analytics` | Dashboard analytics |
| POST | `/v1/openclaw/webhook` | Webhook integration |
| WS | `/ws/events` | Real-time event stream |

## Roadmap

- [ ] YAML-based persona definitions
- [ ] LLM-powered intent classification (GPT, Claude, Gemini)
- [ ] Multi-LLM provider with automatic fallback
- [ ] Industry vertical templates (Healthcare, Banking, Retail)
- [ ] Full RBAC with custom roles and audit trails
- [ ] Kubernetes deployment manifests
- [ ] SaaS multi-tenant with billing
- [ ] Enterprise SSO (SAML, OAuth)

## License

Proprietary — All rights reserved.

---

**GENi** — Global Enterprise Neural Intelligence
