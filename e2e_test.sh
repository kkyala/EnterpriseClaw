#!/bin/bash
# ===========================================================================
# Enterprise Claw - Happy Path End-to-End Test
# ===========================================================================
# This script tests the full lifecycle of a task:
#   1. Health check (GET /)
#   2. Fetch agents (GET /api/agents)
#   3. Fetch user info (GET /api/user-info)
#   4. Submit a task (POST /api/tasks)
#   5. Wait for worker to process
#   6. Verify task status in logs (GET /api/task-logs)
#   7. Verify analytics updated (GET /api/analytics)
#   8. Test webhook endpoint (POST /v1/openclaw/webhook)
# ===========================================================================

BASE_URL="${1:-http://localhost:8000}"
PASS=0
FAIL=0

green() { echo -e "\033[32m✓ PASS: $1\033[0m"; PASS=$((PASS + 1)); }
red()   { echo -e "\033[31m✗ FAIL: $1\033[0m"; FAIL=$((FAIL + 1)); }

echo "============================================="
echo " Enterprise Claw - E2E Happy Path Test"
echo " Target: $BASE_URL"
echo "============================================="
echo ""

# --- Test 1: Health Check ---
echo "--- Test 1: Health Check (GET /) ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$STATUS" -eq 200 ]; then green "Root endpoint returns 200"; else red "Root endpoint returned $STATUS"; fi

# --- Test 2: Fetch Agents ---
echo "--- Test 2: Fetch Agents (GET /api/agents) ---"
AGENTS=$(curl -s "$BASE_URL/api/agents")
AGENT_COUNT=$(echo "$AGENTS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
if [ "$AGENT_COUNT" -gt 0 ]; then green "Found $AGENT_COUNT agents"; else red "No agents found"; fi

# --- Test 3: Fetch User Info ---
echo "--- Test 3: User Info (GET /api/user-info) ---"
USER_INFO=$(curl -s -H "x-username: admin_user" "$BASE_URL/api/user-info")
USERNAME=$(echo "$USER_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('username',''))" 2>/dev/null)
if [ "$USERNAME" = "admin_user" ]; then green "User info returned admin_user"; else red "User info failed: $USERNAME"; fi

# --- Test 4: Submit Task (Dashboard) ---
echo "--- Test 4: Submit Task (POST /api/tasks) ---"
TASK_RESULT=$(curl -s -X POST "$BASE_URL/api/tasks" \
    -H "Content-Type: application/json" \
    -H "x-username: analyst_user" \
    -d '{
        "task": "Check inventory levels for all warehouses",
        "tenant_id": "acme_corp",
        "persona_name": "Manufacturing Optimization Agent",
        "session_id": "e2e_test",
        "source": "api"
    }')
TASK_ID=$(echo "$TASK_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('task_id',''))" 2>/dev/null)
if [ -n "$TASK_ID" ] && [ "$TASK_ID" != "" ]; then green "Task created: $TASK_ID"; else red "Task creation failed: $TASK_RESULT"; fi

# --- Test 5: Wait for Worker ---
echo "--- Test 5: Waiting 3 seconds for worker to process... ---"
sleep 3

# --- Test 6: Verify Task in Logs ---
echo "--- Test 6: Verify Task in Logs (GET /api/task-logs) ---"
LOGS=$(curl -s "$BASE_URL/api/task-logs")
TASK_STATUS=$(echo "$LOGS" | python3 -c "
import sys, json
logs = json.load(sys.stdin)
for log in logs:
    if log.get('task_id') == '$TASK_ID':
        print(log.get('status', 'UNKNOWN'))
        break
else:
    print('NOT_FOUND')
" 2>/dev/null)
if [ "$TASK_STATUS" = "success" ]; then
    green "Task $TASK_ID completed with status: success"
elif [ "$TASK_STATUS" = "QUEUED" ] || [ "$TASK_STATUS" = "PENDING" ]; then
    red "Task $TASK_ID still pending (worker may be slow)"
else
    red "Task $TASK_ID status: $TASK_STATUS"
fi

# --- Test 7: Verify Analytics ---
echo "--- Test 7: Verify Analytics (GET /api/analytics) ---"
ANALYTICS=$(curl -s "$BASE_URL/api/analytics")
TASKS_TODAY=$(echo "$ANALYTICS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('kpis',{}).get('tasks_today',0))" 2>/dev/null)
if [ "$TASKS_TODAY" -gt 0 ]; then green "Analytics reports $TASKS_TODAY tasks today"; else red "Analytics reports 0 tasks today"; fi

# --- Test 8: Test Webhook ---
echo "--- Test 8: Webhook (POST /v1/openclaw/webhook) ---"
WEBHOOK_RESULT=$(curl -s -X POST "$BASE_URL/v1/openclaw/webhook" \
    -H "Content-Type: application/json" \
    -d '{
        "task": "Generate quarterly compliance report",
        "tenant_id": "acme_corp",
        "persona_name": "Compliance Officer",
        "source": "webhook",
        "initiator": "openclaw"
    }')
WEBHOOK_STATUS=$(echo "$WEBHOOK_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
if [ "$WEBHOOK_STATUS" = "QUEUED" ]; then green "Webhook task queued successfully"; else red "Webhook failed: $WEBHOOK_RESULT"; fi

# --- Summary ---
echo ""
echo "============================================="
echo " TEST RESULTS: $PASS passed, $FAIL failed"
echo "============================================="

if [ "$FAIL" -gt 0 ]; then exit 1; else exit 0; fi
