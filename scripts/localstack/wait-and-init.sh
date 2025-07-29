#!/bin/sh

echo "Waiting for LocalStack to be ready..."

# Wait for LocalStack health endpoint
until curl -f http://localstack:4566/_localstack/health > /dev/null 2>&1; do
  echo "LocalStack is not ready yet..."
  sleep 2
done

echo "LocalStack is ready! Initializing AWS resources..."

# Execute the initialization script
sh /scripts/init-aws.sh

echo "Initialization complete!"

# Keep container running for logs
tail -f /dev/null