#!/bin/bash

echo "🔍 Testing Local Development Stack"
echo "=================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check service
check_service() {
    local service_name=$1
    local check_command=$2
    
    echo -n "Checking $service_name... "
    if eval $check_command > /dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        return 1
    fi
}

# Check all services
echo ""
echo "1. Checking Docker containers:"
echo "------------------------------"
docker-compose ps

echo ""
echo "2. Checking service connectivity:"
echo "---------------------------------"

# Check CockroachDB
check_service "CockroachDB" "docker exec backend-cockroachdb cockroach sql --insecure -e 'SELECT 1'"

# Check Redis
check_service "Redis" "docker exec backend-redis redis-cli ping"

# Check LocalStack
check_service "LocalStack" "curl -s http://localhost:4566/_localstack/health | grep -q 'running'"

# Check Backend API
check_service "Backend API" "curl -s http://localhost:4000/api | grep -q 'Hello World'"

echo ""
echo "3. Checking AWS services in LocalStack:"
echo "---------------------------------------"

# Check SQS
check_service "SQS Queue" "AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url=http://localhost:4566 --region us-west-2 sqs list-queues | grep -q 'obelisk-webhook-events'"

# Check Secrets Manager
check_service "Secrets Manager" "AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url=http://localhost:4566 --region us-west-2 secretsmanager list-secrets | grep -q 'obelisk-backend-node-db'"

# Check EventBridge
check_service "EventBridge" "AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url=http://localhost:4566 --region us-west-2 events list-event-buses | grep -q 'obelisk-events'"

echo ""
echo "4. Testing EventBridge to SQS integration:"
echo "------------------------------------------"

# Send test event
echo -n "Sending test event to EventBridge... "
EVENT_ID=$(AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url=http://localhost:4566 --region us-west-2 events put-events \
    --entries '[{"Source":"obelisk.backend.node","DetailType":"Test Event","Detail":"{\"message\":\"Test from script\"}","EventBusName":"obelisk-events"}]' \
    --query 'Entries[0].EventId' --output text)

if [ -n "$EVENT_ID" ]; then
    echo -e "${GREEN}✅ Event sent (ID: $EVENT_ID)${NC}"
    
    # Check if message arrived in SQS
    sleep 2
    echo -n "Checking SQS for message... "
    MESSAGE=$(AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url=http://localhost:4566 --region us-west-2 sqs receive-message \
        --queue-url http://sqs.us-west-2.localhost.localstack.cloud:4566/000000000000/obelisk-webhook-events \
        --max-number-of-messages 1 --wait-time-seconds 2)
    
    if echo "$MESSAGE" | grep -q "Test from script"; then
        echo -e "${GREEN}✅ Message received in SQS${NC}"
        
        # Delete the message
        RECEIPT_HANDLE=$(echo "$MESSAGE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data['Messages'][0]['ReceiptHandle'])" 2>/dev/null)
        if [ -n "$RECEIPT_HANDLE" ]; then
            AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url=http://localhost:4566 --region us-west-2 sqs delete-message \
                --queue-url http://sqs.us-west-2.localhost.localstack.cloud:4566/000000000000/obelisk-webhook-events \
                --receipt-handle "$RECEIPT_HANDLE" 2>/dev/null
        fi
    else
        echo -e "${RED}❌ Message not found in SQS${NC}"
    fi
else
    echo -e "${RED}❌ Failed to send event${NC}"
fi

echo ""
echo "5. Database connectivity test:"
echo "------------------------------"

# Test database connection from backend
echo -n "Testing database connection from backend... "
docker exec backend-cockroachdb cockroach sql --insecure -e "SELECT COUNT(*) FROM illuvium.information_schema.tables;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database accessible${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
fi

echo ""
echo "=================================="
echo "🎉 Local stack test completed!"
echo "=================================="
echo ""
echo "Access points:"
echo "- Backend API: http://localhost:4000/api"
echo "- CockroachDB Console: http://localhost:8080"
echo "- LocalStack: http://localhost:4566"
echo ""