FROM node:22-slim

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3002

# Start
CMD ["node", "simple-server.js"]
