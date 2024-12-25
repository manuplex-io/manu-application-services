#!/bin/bash

# Perform health check by checking if the response contains "status":"ok"
if curl -s https://os.manuplex.io/services/health | grep -q '"status":"ok"'; then
  echo "Health check passed."
  exit 0  # Exit with 0 to indicate success
else
  echo "Health check failed."
  exit 1  # Exit with 1 to indicate failure
fi