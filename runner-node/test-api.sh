#!/bin/bash

# JPEL Runner Test Script
# This script tests the basic functionality of the JPEL Runner API

API_BASE="http://localhost:3000"
PROCESS_FILE="../design/process.json"

echo "🧪 Testing JPEL Runner API"
echo "=========================="

# Test 1: Health check
echo "1. Health check..."
curl -s "$API_BASE/health" | jq '.'
echo ""

# Test 2: Load process definition
echo "2. Loading process definition..."
LOAD_RESPONSE=$(curl -s -X POST "$API_BASE/api/processes" \
  -H "Content-Type: application/json" \
  -d @"$PROCESS_FILE")
echo "$LOAD_RESPONSE" | jq '.'
echo ""

# Test 3: Get loaded processes
echo "3. Getting loaded processes..."
curl -s "$API_BASE/api/processes" | jq '.'
echo ""

# Test 4: Create process instance
echo "4. Creating process instance..."
INSTANCE_RESPONSE=$(curl -s -X POST "$API_BASE/api/processes/mic-build/instances")
echo "$INSTANCE_RESPONSE" | jq '.'

# Extract instance ID for further tests
INSTANCE_ID=$(echo "$INSTANCE_RESPONSE" | jq -r '.data.instanceId')
echo "Instance ID: $INSTANCE_ID"
echo ""

# Test 5: Get current human task
echo "5. Getting current human task..."
curl -s "$API_BASE/api/instances/$INSTANCE_ID/current-task" | jq '.'
echo ""

# Test 6: Submit human task data
echo "6. Submitting human task data (buildType: TC)..."
SUBMIT_RESPONSE=$(curl -s -X POST "$API_BASE/api/instances/$INSTANCE_ID/activities/askBuildType/submit" \
  -H "Content-Type: application/json" \
  -d '{"buildType": "TC"}')
echo "$SUBMIT_RESPONSE" | jq '.'
echo ""

# Test 7: Get instance status
echo "7. Getting instance status..."
curl -s "$API_BASE/api/instances/$INSTANCE_ID" | jq '.data | {instanceId, status, currentActivity}'
echo ""

echo "✅ Test completed!"
echo "Note: Install jq for better JSON formatting: npm install -g jq"