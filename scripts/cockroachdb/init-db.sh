#!/bin/bash

echo "Initializing CockroachDB..."

# Wait for CockroachDB to be ready
until cockroach sql --insecure --host=cockroachdb:26257 -e "SELECT 1" > /dev/null 2>&1; do
  echo "Waiting for CockroachDB to be ready..."
  sleep 2
done

echo "CockroachDB is ready!"

# Create database and user
cockroach sql --insecure --host=cockroachdb:26257 <<EOF
CREATE DATABASE IF NOT EXISTS illuvium;
CREATE USER IF NOT EXISTS backend_node;
GRANT ALL ON DATABASE illuvium TO backend_node;
EOF

echo "CockroachDB initialization complete!"