#!/bin/bash

echo "=== DEBUG: Mounted Paths and Files ==="
echo ""

echo "📁 Checking /mnt/secrets (Application secrets):"
if [ -d "/mnt/secrets" ]; then
    find /mnt/secrets -type f -exec ls -la {} \; 2>/dev/null || echo "No files found or permission denied"
else
    echo "❌ Directory /mnt/secrets does not exist"
fi
echo ""

echo "📁 Checking /mnt/configs (Configuration files):"
if [ -d "/mnt/configs" ]; then
    find /mnt/configs -type f -exec ls -la {} \; 2>/dev/null || echo "No files found or permission denied"
else
    echo "❌ Directory /mnt/configs does not exist"
fi
echo ""

echo "🔐 Checking /mnt/tls (TLS certificates):"
if [ -d "/mnt/tls" ]; then
    find /mnt/tls -type f -exec ls -la {} \; 2>/dev/null || echo "No files found or permission denied"
else
    echo "❌ Directory /mnt/tls does not exist"
fi
echo ""

echo "🔍 Specifically checking CockroachDB TLS path:"
COCKROACH_TLS_PATH="/mnt/tls/cockroachdb-svc-backend-node"
if [ -d "$COCKROACH_TLS_PATH" ]; then
    echo "✅ Found CockroachDB TLS directory: $COCKROACH_TLS_PATH"
    for file in ca.crt tls.crt tls.key; do
        if [ -f "$COCKROACH_TLS_PATH/$file" ]; then
            echo "  ✅ $file: $(ls -la "$COCKROACH_TLS_PATH/$file")"
        else
            echo "  ❌ $file: NOT FOUND"
        fi
    done
else
    echo "❌ CockroachDB TLS directory not found: $COCKROACH_TLS_PATH"
fi
echo ""

echo "=== Environment Variables (DB related) ==="
echo "DB_SSL: ${DB_SSL:-'not set'}"
echo "DB_HOST: ${DB_HOST:-'not set'}"
echo "DB_PORT: ${DB_PORT:-'not set'}"
echo "NODE_ENV: ${NODE_ENV:-'not set'}"
echo ""

echo "=== End Debug Information ==="
