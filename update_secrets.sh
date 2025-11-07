#!/bin/bash
set -eo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Starting deployment to production and staging ===${NC}"

# Function to deploy to a specific environment
deploy_environment() {
    local env_file=$1
    local env_name=$2

    echo -e "${YELLOW}=== Processing ${env_name} environment ===${NC}"

    # Extract SSH_HOST from the env file
    SSH_HOST=$(grep '^SSH_HOST=' "${env_file}" | cut -d '=' -f2)

    if [ -z "$SSH_HOST" ]; then
        echo -e "${RED}Error: SSH_HOST not found in ${env_file}${NC}"
        exit 1
    fi

    echo -e "${GREEN}Found SSH_HOST: ${SSH_HOST}${NC}"

    # Copy the .env file to the remote host
    echo -e "${YELLOW}Copying ${env_file} to ${SSH_HOST}:/home/deploy/tearleads-backend/.env${NC}"
    scp "${env_file}" "deploy@${SSH_HOST}:/home/deploy/tearleads-backend/.env"

    # SSH into the host and run deploy-containers.sh
    echo -e "${YELLOW}Running deploy-containers.sh on ${SSH_HOST}${NC}"
    ssh "deploy@${SSH_HOST}" "cd /home/deploy/tearleads-backend && ./deploy-containers.sh"

    echo -e "${GREEN}=== ${env_name} deployment completed ===${NC}\n"
}

# Deploy to production
deploy_environment ".env-production" "PRODUCTION"

# Deploy to staging
deploy_environment ".env-staging" "STAGING"

echo -e "${GREEN}=== All deployments completed successfully ===${NC}"
