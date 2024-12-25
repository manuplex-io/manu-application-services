#!/bin/bash

set -e

# Check the health check status
if [ -f /tmp/health_check_status ]; then
  STATUS=$(cat /tmp/health_check_status)
  if [ "$STATUS" == "success" ]; then
    echo "Health check passed, skipping rollback."
    exit 0  # Skip rollback
  fi
fi


# Customize these as needed:
REGION="us-west-2"
ACCOUNT_ID="637423298319"

STACK_NAME="${1:-GreenStack}"       # Can be overridden by CLI arg, defaults to "GreenStack"
SERVICE_SHORT_NAME="application-services-1"
# Combine them into the full service name, e.g. "GreenStack_agent-service-1"
SERVICE_NAME="${STACK_NAME}_${SERVICE_SHORT_NAME}"

# ECR Repository and version.

# We'll get the image tag from the CodePipeline artifact
# IMAGE_TAG=$1   # Accept the image tag as a parameter
PREVIOUS_IMAGE_TAG=$(cat /home/ec2-user/codeDeploy/previous_image_tag.txt || echo "")

if [ -z "$PREVIOUS_IMAGE_TAG" ]; then
  echo "Error: IMAGE_TAG is required"
  exit 1
fi

# Adjust these to match your image repository in ECR.
REPO_NAME="manu/application-services"
# REPO_VERSION="latest"


# Construct the full ECR image reference
# IMAGE="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}:${REPO_VERSION}"
IMAGE="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}:${PREVIOUS_IMAGE_TAG}"

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

exit 1
