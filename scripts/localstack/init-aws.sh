#!/bin/bash

echo "Initializing LocalStack AWS resources..."

# Configure AWS CLI to use LocalStack endpoint
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-west-2

# Determine the correct endpoint based on where we're running
if [ -f /.dockerenv ]; then
  # Running inside Docker container
  export AWS_ENDPOINT_URL=http://localstack:4566
else
  # Running on host
  export AWS_ENDPOINT_URL=http://localhost:4566
fi

# Function to run AWS commands
awslocal() {
  aws --endpoint-url=$AWS_ENDPOINT_URL "$@"
}

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
until awslocal sqs list-queues > /dev/null 2>&1; do
  sleep 1
done

echo "LocalStack is ready!"

# Create EventBridge Event Bus
echo "Creating EventBridge Event Bus..."
awslocal events create-event-bus \
  --name obelisk-events \
  --region us-west-2 2>/dev/null || echo "Event Bus already exists"

# Create SQS Queue for webhook events
echo "Creating SQS Queue for webhook events..."
awslocal sqs create-queue \
  --queue-name obelisk-webhook-events \
  --region us-west-2 2>/dev/null || echo "Queue already exists"

# Create EventBridge Rule to route events to SQS
echo "Creating EventBridge Rule..."
awslocal events put-rule \
  --name webhook-events-rule \
  --event-bus-name obelisk-events \
  --event-pattern '{"source":["obelisk.backend.node"]}' \
  --state ENABLED \
  --region us-west-2 2>/dev/null || echo "Rule already exists"

# Add SQS as target for the rule
QUEUE_URL=$(awslocal sqs get-queue-url \
  --queue-name obelisk-webhook-events \
  --query 'QueueUrl' \
  --output text \
  --region us-west-2)

QUEUE_ARN=$(awslocal sqs get-queue-attributes \
  --queue-url $QUEUE_URL \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text \
  --region us-west-2)

awslocal events put-targets \
  --rule webhook-events-rule \
  --event-bus-name obelisk-events \
  --targets "Id"="1","Arn"="$QUEUE_ARN" \
  --region us-west-2 2>/dev/null || echo "Target already exists"

# Create Secrets Manager secrets (for development)
echo "Creating development secrets..."

# Database secret
awslocal secretsmanager create-secret \
  --name obelisk-backend-node-db \
  --secret-string '{"host":"postgres","port":5432,"database":"illuvium","username":"backend_node","password":"local_password"}' \
  --region us-west-2 2>/dev/null || echo "DB secret already exists"

# Redis secret
awslocal secretsmanager create-secret \
  --name obelisk-backend-node-redis \
  --secret-string '{"host":"redis","port":6379,"password":""}' \
  --region us-west-2 2>/dev/null || echo "Redis secret already exists"

# Thirdweb secret
awslocal secretsmanager create-secret \
  --name obelisk-backend-node-thirdweb \
  --secret-string '{"secretKey":"dev_thirdweb_key"}' \
  --region us-west-2 2>/dev/null || echo "Thirdweb secret already exists"

# API Keys secret
awslocal secretsmanager create-secret \
  --name obelisk-backend-node-api-keys \
  --secret-string '{"serviceKey":"dev_api_key_123"}' \
  --region us-west-2 2>/dev/null || echo "API Keys secret already exists"

echo "LocalStack initialization complete!"