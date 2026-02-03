FROM node:22-slim

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies (includes @solana/web3.js for real token creation)
RUN npm install

# Copy source
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose health check port
EXPOSE 8080

# Start
CMD ["node", "agent-runtime.js"]
