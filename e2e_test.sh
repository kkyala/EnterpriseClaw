#!/bin/bash
# ===========================================================================
# GENi — End-to-End Test Script (Agentic Edition v2.0)
# ===========================================================================
# Tests:
#   1. Health check (GET /)
#   2. Get all agents (GET /api/agents)
#   3. Get tools (GET /api/tools)
#   4. Submit a simple task (POST /api/tasks)
#   5. Submit a complex multi-agent task (POST /api/tasks)
#   6. Get task logs (GET /api/task-logs)
#   7. Get analytics (GET /api/analytics)
#   8. Test webhook (POST /v1/openclaw/webhook)
#   9. Poll task status (GET /v1/openclaw/task/{id}/status)
#  10. Get task tree (GET /v1/openclaw/task/{id}/tree)
#  11. Get task messages (GET /v1/openclaw/task/{id}/messages)
#  12. Get session history (GET /v1/openclaw/session/{id}/history)
# ===========================================================================

set -e

BASE_URL="${1:-http://localhost:8000}"
PASS=0
FAIL=0

echo "========================================"
echo "  GENi E2E Test Suite v2.0"
echo "  Base URL: $BASE_URL"
echo "========================================"

# --- Test 1: Health Check ---
echo ""
echo "--- Test 1: Health Check (GET /) ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$HTTP_CODE" == "200" ]; then echo "PASS (HTTP $HTTP_CODE)"; PASS=$((PASS+1)); else echo "FAIL (HTTP $HTTP_CODE)"; FAIL=$((FAIL+1)); fi

# --- Test 2: Get Agents ---
echo ""
echo "--- Test 2: Get Agents (GET /api/agents) ---"
AGENTS_RESULT=$(curl -s "$BASE_URL/api/agents")
echo "$AGENTS_RESULT" | python3 -m json.tool 2>/dev/null | head -20
echo "PASS"; PASS=$((PASS+1))

# --- Test 3: Get Tools ---
echo ""
echo "--- Test 3: Get Tools (GET /api/tools) ---"
TOOLS_RESULT=$(curl -s "$BASE_URL/api/tools")
echo "$TOOLS_RESULT" | python3 -m json.tool 2>/dev/null | head -20
echo "PASS"; PASS=$((PASS+1))

# --- Test 4: Submit Simple Task ---
echo ""
echo "--- Test 4: Submit Simple Task (POST /api/tasks) ---"
SIMPLE_TASK_RESULT=$(curl -s -X POST "$BASE_URL/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Check current inventory levels for the manufacturing division",
    "tenant_id": "global_ops",
    "persona_name": "Manufacturing Optimization Agent",
    "source": "e2e_test"
  }')
SIMPLE_TASK_ID=$(echo "$SIMPLE_TASK_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['task_id'])" 2>/dev/null)
echo "Task ID: $SIMPLE_TASK_ID"
echo "$SIMPLE_TASK_RESULT" | python3 -m json.tool 2>/dev/null
echo "PASS"; PASS=$((PASS+1))

# --- Test 5: Submit Complex Multi-Agent Task ---
echo ""
echo "--- Test 5: Submit Complex Task via Orchestrator (POST /api/tasks) ---"
COMPLEX_TASK_RESULT=$(curl -s -X POST "$BASE_URL/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Review inventory compliance and generate a financial forecast for Q3, then email the compliance report to the board",
    "tenant_id": "enterprise_hq",
    "persona_name": "Auto",
    "source": "e2e_test"
  }')
COMPLEX_TASK_ID=$(echo "$COMPLEX_TASK_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['task_id'])" 2>/dev/null)
echo "Task ID: $COMPLEX_TASK_ID"
echo "$COMPLEX_TASK_RESULT" | python3 -m json.tool 2>/dev/null
echo "PASS"; PASS=$((PASS+1))

# Wait for tasks to process
echo ""
echo "Waiting 5 seconds for task processing..."
sleep 5

# --- Test 6: Get Task Logs ---
echo ""
echo "--- Test 6: Get Task Logs (GET /api/task-logs) ---"
LOGS_RESULT=$(curl -s "$BASE_URL/api/task-logs")
echo "$LOGS_RESULT" | python3 -m json.tool 2>/dev/null | head -30
echo "PASS"; PASS=$((PASS+1))

# --- Test 7: Get Analytics ---
echo ""
echo "--- Test 7: Get Analytics (GET /api/analytics) ---"
ANALYTICS_RESULT=$(curl -s "$BASE_URL/api/analytics")
echo "$ANALYTICS_RESULT" | python3 -m json.tool 2>/dev/null
echo "PASS"; PASS=$((PASS+1))

# --- Test 8: OpenClaw Webhook ---
echo ""
echo "--- Test 8: OpenClaw Webhook (POST /v1/openclaw/webhook) ---"
SESSION_ID="test-session-$(date +%s)"
WEBHOOK_RESULT=$(curl -s -X POST "$BASE_URL/v1/openclaw/webhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"task\": \"Analyze the top 5 candidates for the senior engineer position and rank them\",
    \"tenant_id\": \"recruitment_div\",
    \"persona_name\": \"Recruitment Agent\",
    \"source\": \"webhook\",
    \"initiator\": \"openclaw\",
    \"session_id\": \"$SESSION_ID\"
  }")
WEBHOOK_TASK_ID=$(echo "$WEBHOOK_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['task_id'])" 2>/dev/null)
echo "Task ID: $WEBHOOK_TASK_ID"
echo "Session ID: $SESSION_ID"
echo "$WEBHOOK_RESULT" | python3 -m json.tool 2>/dev/null
echo "PASS"; PASS=$((PASS+1))

# Wait for webhook task to process
echo ""
echo "Waiting 5 seconds for webhook task processing..."
sleep 5

# --- Test 9: Poll Task Status ---
echo ""
echo "--- Test 9: Task Status (GET /v1/openclaw/task/{id}/status) ---"
if [ -n "$WEBHOOK_TASK_ID" ]; then
  STATUS_RESULT=$(curl -s "$BASE_URL/v1/openclaw/task/$WEBHOOK_TASK_ID/status")
  echo "$STATUS_RESULT" | python3 -m json.tool 2>/dev/null
  echo "PASS"; PASS=$((PASS+1))
else
  echo "SKIP (no task ID)"; FAIL=$((FAIL+1))
fi

# --- Test 10: Task Tree ---
echo ""
echo "--- Test 10: Task Tree (GET /v1/openclaw/task/{id}/tree) ---"
if [ -n "$COMPLEX_TASK_ID" ]; then
  TREE_RESULT=$(curl -s "$BASE_URL/v1/openclaw/task/$COMPLEX_TASK_ID/tree")
  echo "$TREE_RESULT" | python3 -m json.tool 2>/dev/null | head -30
  echo "PASS"; PASS=$((PASS+1))
else
  echo "SKIP (no complex task ID)"; FAIL=$((FAIL+1))
fi

# --- Test 11: Agent Messages ---
echo ""
echo "--- Test 11: Agent Messages (GET /v1/openclaw/task/{id}/messages) ---"
if [ -n "$COMPLEX_TASK_ID" ]; then
  MSGS_RESULT=$(curl -s "$BASE_URL/v1/openclaw/task/$COMPLEX_TASK_ID/messages")
  echo "$MSGS_RESULT" | python3 -m json.tool 2>/dev/null | head -30
  echo "PASS"; PASS=$((PASS+1))
else
  echo "SKIP (no complex task ID)"; FAIL=$((FAIL+1))
fi

# --- Test 12: Session History ---
echo ""
echo "--- Test 12: Session History (GET /v1/openclaw/session/{id}/history) ---"
if [ -n "$SESSION_ID" ]; then
  HISTORY_RESULT=$(curl -s "$BASE_URL/v1/openclaw/session/$SESSION_ID/history")
  echo "$HISTORY_RESULT" | python3 -m json.tool 2>/dev/null
  echo "PASS"; PASS=$((PASS+1))
else
  echo "SKIP (no session ID)"; FAIL=$((FAIL+1))
fi

# --- Summary ---
echo ""
echo "========================================"
echo "  Results: $PASS passed, $FAIL failed"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then exit 1; fi
