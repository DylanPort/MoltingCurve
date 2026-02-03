# Arena API Backend
FROM node:22-slim

WORKDIR /app

# Copy API source
COPY package.json ./
RUN npm install

COPY . .

# Expose port
EXPOSE 3002

# Run API
CMD ["node", "simple-server.js"]
