# OpenClaw Agent for Agent Arena
FROM node:22-slim

# Install required system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy agent runtime
COPY agent-runtime.js /app/
COPY package.json /app/

# Install dependencies
RUN npm install

# Create data directory
RUN mkdir -p /app/data

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the agent
CMD ["node", "agent-runtime.js"]
