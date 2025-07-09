#!/bin/bash

# Build and push Docker image to ECR
# Usage: ./scripts/build-and-push.sh [version]

set -e

# Configuration
AWS_REGION="${AWS_REGION:-us-west-2}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-831926613707}"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_NAME="obelisk-backend-node"
VERSION=${1:-latest}

echo "🚀 Starting build and push process..."
echo "Registry: $ECR_REGISTRY"
echo "Image: $IMAGE_NAME"
echo "Version: $VERSION"

# Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

# Build the image
echo "🔨 Building Docker image..."
docker build -t $IMAGE_NAME:$VERSION .

# Tag the image
echo "🏷️  Tagging image..."
docker tag $IMAGE_NAME:$VERSION $ECR_REGISTRY/$IMAGE_NAME:$VERSION

# Also tag as latest if not already latest
if [ "$VERSION" != "latest" ]; then
    docker tag $IMAGE_NAME:$VERSION $ECR_REGISTRY/$IMAGE_NAME:latest
fi

# Push the image
echo "📤 Pushing image to ECR..."
docker push $ECR_REGISTRY/$IMAGE_NAME:$VERSION

if [ "$VERSION" != "latest" ]; then
    docker push $ECR_REGISTRY/$IMAGE_NAME:latest
fi

echo "✅ Successfully pushed $ECR_REGISTRY/$IMAGE_NAME:$VERSION"