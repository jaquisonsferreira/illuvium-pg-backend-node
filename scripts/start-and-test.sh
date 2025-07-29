#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Backend Node Development Environment${NC}"
echo "================================================"

# Start services
echo -e "\n${YELLOW}📦 Starting Docker services...${NC}"
docker-compose up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to start Docker services${NC}"
    exit 1
fi

# Function to check if a service is ready
wait_for_service() {
    local service_name=$1
    local check_command=$2
    local max_attempts=30
    local attempt=0
    
    echo -n "⏳ Waiting for $service_name to be ready"
    
    while [ $attempt -lt $max_attempts ]; do
        if eval $check_command > /dev/null 2>&1; then
            echo -e " ${GREEN}✅${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e " ${RED}❌ Timeout${NC}"
    return 1
}

echo -e "\n${YELLOW}⏳ Waiting for services to initialize...${NC}"

# Wait for each service
wait_for_service "CockroachDB" "docker exec backend-cockroachdb cockroach sql --insecure --host=cockroachdb:26257 -e 'SELECT 1'"
wait_for_service "Redis" "docker exec backend-redis redis-cli ping"
wait_for_service "LocalStack" "curl -s http://localhost:4566/_localstack/health | grep -q 'running'"

# Wait for initialization containers
echo -n "⏳ Waiting for CockroachDB initialization"
while docker ps | grep -q cockroachdb-init; do
    echo -n "."
    sleep 2
done
echo -e " ${GREEN}✅${NC}"

echo -n "⏳ Waiting for LocalStack initialization"
while docker ps | grep -q localstack-init && ! docker logs localstack-init 2>&1 | grep -q "Initialization complete!"; do
    echo -n "."
    sleep 2
done
echo -e " ${GREEN}✅${NC}"

# Wait a bit more for backend to start properly
echo -n "⏳ Waiting for Backend API to start"
max_attempts=15
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:4000/api | grep -q "Hello World"; then
        echo -e " ${GREEN}✅${NC}"
        break
    fi
    echo -n "."
    sleep 2
    attempt=$((attempt + 1))
done

if [ $attempt -eq $max_attempts ]; then
    echo -e " ${RED}❌ Timeout${NC}"
    echo -e "\n${RED}❌ Backend API failed to start. Check logs with: docker-compose logs backend-node${NC}"
    exit 1
fi

# Run tests
echo -e "\n${YELLOW}🧪 Running tests...${NC}"
echo "==================="

./scripts/test-local-stack.sh

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ All services are up and running!${NC}"
    echo -e "\n📌 Access points:"
    echo "   - Backend API: http://localhost:4000/api"
    echo "   - CockroachDB Console: http://localhost:8080"
    echo "   - LocalStack: http://localhost:4566"
    echo -e "\n💡 To view logs: ${YELLOW}docker-compose logs -f [service-name]${NC}"
    echo -e "💡 To stop services: ${YELLOW}docker-compose down${NC}"
else
    echo -e "\n${RED}❌ Some tests failed. Check the output above for details.${NC}"
    exit 1
fi