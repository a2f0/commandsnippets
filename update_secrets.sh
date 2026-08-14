#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

if ! command -v sops >/dev/null 2>&1; then
    echo "Error: sops is required to deploy secrets." >&2
    exit 1
fi

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Starting deployment to production and staging ===${NC}"

# Function to deploy to a specific environment
deploy_environment() {
    local encrypted_env_file=$1
    local env_name=$2
    local ssh_host

    echo -e "${YELLOW}=== Processing ${env_name} environment ===${NC}"

    ssh_host=$(sops exec-env "$encrypted_env_file" 'printf %s "$SSH_HOST"')

    if [ -z "$ssh_host" ]; then
        echo -e "${RED}Error: SSH_HOST not found in ${encrypted_env_file}${NC}"
        exit 1
    fi

    echo -e "${GREEN}Found SSH_HOST: ${ssh_host}${NC}"

    # SOPS removes the temporary plaintext file after scp exits.
    echo -e "${YELLOW}Copying decrypted secrets to ${ssh_host}:/home/deploy/tearleads-backend/.env${NC}"
    SOPS_DEPLOY_DESTINATION="deploy@${ssh_host}:/home/deploy/tearleads-backend/.env" \
        sops exec-file --no-fifo --filename .env "$encrypted_env_file" \
        'scp {} "$SOPS_DEPLOY_DESTINATION"'

    # SSH into the host and run deploy-containers.sh
    echo -e "${YELLOW}Running deploy-containers.sh on ${ssh_host}${NC}"
    ssh "deploy@${ssh_host}" "cd /home/deploy/tearleads-backend && ./deploy-containers.sh"

    echo -e "${GREEN}=== ${env_name} deployment completed ===${NC}\n"
}

# Deploy to staging
deploy_environment ".env-staging.sops.env" "STAGING"

# Deploy to production
deploy_environment ".env-production.sops.env" "PRODUCTION"

echo -e "${GREEN}=== All deployments completed successfully ===${NC}"
