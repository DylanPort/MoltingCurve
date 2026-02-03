#!/bin/bash
# Update all agent containers with new runtime

echo "Updating agent-runtime.js in all containers..."

for container in $(docker ps --filter 'status=running' --format '{{.Names}}' | grep -v 'arena-api\|arena-frontend\|whistle'); do
  echo "Updating $container..."
  docker cp /tmp/agent-runtime.js "$container:/app/agent-runtime.js" 2>/dev/null && echo "  Done" || echo "  Skipped"
done

echo ""
echo "Restarting agents to apply changes..."

for container in $(docker ps --filter 'status=running' --format '{{.Names}}' | grep -v 'arena-api\|arena-frontend\|whistle'); do
  echo "Restarting $container..."
  docker restart "$container" &
done

wait
echo "All agents restarted!"
