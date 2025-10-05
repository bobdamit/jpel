#!/bin/bash

# Test script to verify the approval workflow re-run fix

echo "Starting JPEL server..."
cd /c/code/jpel/runner-node
npm start &
SERVER_PID=$!
sleep 5

echo "Creating approval workflow instance..."
INSTANCE_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/processes/approval-workflow/instances")
INSTANCE_ID=$(echo "$INSTANCE_RESPONSE" | grep -o '"instanceId":"[^"]*"' | cut -d'"' -f4)
echo "Created instance: $INSTANCE_ID"

echo "Getting current task..."
curl -s "http://localhost:3000/api/instances/$INSTANCE_ID/current-task"

echo "Submitting first task..."
curl -s -X POST "http://localhost:3000/api/instances/$INSTANCE_ID/activities/submitDocument/submit" \
  -H "Content-Type: application/json" \
  -d '{"documentTitle":"Test Document","documentType":"policy"}'

echo "Getting current task..."
curl -s "http://localhost:3000/api/instances/$INSTANCE_ID/current-task"

echo "Submitting second task..."
curl -s -X POST "http://localhost:3000/api/instances/$INSTANCE_ID/activities/reviewDocument/submit" \
  -H "Content-Type: application/json" \
  -d '{"approverDecision":"approved"}'

echo "Instance completed. Now re-running..."
RERUN_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/instances/$INSTANCE_ID/rerun")
NEW_INSTANCE_ID=$(echo "$RERUN_RESPONSE" | grep -o '"instanceId":"[^"]*"' | cut -d'"' -f4)
echo "Re-run created instance: $NEW_INSTANCE_ID"

echo "Getting current task for re-run instance..."
curl -s "http://localhost:3000/api/instances/$NEW_INSTANCE_ID/current-task"

echo "Stopping server..."
kill $SERVER_PID

echo "Test completed."