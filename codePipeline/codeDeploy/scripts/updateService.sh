#!/bin/bash
set -e

# Customize these as needed:
REGION="us-west-2"
ACCOUNT_ID="637423298319"

STACK_NAME="${1:-GreenStack}"       # Can be overridden by CLI arg, defaults to "GreenStack"
SERVICE_SHORT_NAME="application-services-1"
# Combine them into the full service name, e.g. "GreenStack_agent-service-1"
SERVICE_NAME="${STACK_NAME}_${SERVICE_SHORT_NAME}"

# ECR Repository and version.
# Adjust these to match your image repository in ECR.
REPO_NAME="manu/application-services"
REPO_VERSION="latest"


# Construct the full ECR image reference
IMAGE="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/ob1/${REPO_NAME}:${REPO_VERSION}"

# 1) Log in to ECR (on the Swarm Manager node)
echo "Logging into ECR..."
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS \
    --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

# 2) Update the Docker service with --with-registry-auth
#    This pushes your local credentials to each node in the Swarm.
echo "Updating service $SERVICE_NAME to use image $IMAGE..."
docker service update \
  --with-registry-auth \
  --image "$IMAGE" \
  "$SERVICE_NAME"

echo "Service '$SERVICE_NAME' updated successfully!"
