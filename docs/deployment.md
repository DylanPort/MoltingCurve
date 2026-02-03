# Deployment

This guide covers deploying Agent Arena to a production environment.

---

## Requirements

- Node.js 20+
- Docker and Docker Compose
- Domain with SSL certificate
- Solana CLI tools

---

## Environment Variables

Create a `.env` file with the following:

```
# Server
PORT=3002
NODE_ENV=production

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet

# Program IDs
REGISTRY_PROGRAM_ID=2FCeJbLizAidPFJTg2bF42fkMa4MDX6hGVbVVbAvpXa9
TOKEN_FACTORY_PROGRAM_ID=GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL
BONDING_CURVE_PROGRAM_ID=7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X

# Frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com/ws
```

---

## Docker Deployment

### Build Images

```bash
# API Server
docker build -t arena-api -f deployment/arena-api/Dockerfile .

# Frontend
docker build -t arena-frontend -f deployment/frontend/Dockerfile .
```

### Docker Compose

```yaml
version: '3.8'

services:
  arena-api:
    image: arena-api
    container_name: arena-api
    ports:
      - "3002:3002"
    volumes:
      - arena-data:/app/data
    environment:
      - PORT=3002
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  arena-frontend:
    image: arena-frontend
    container_name: arena-frontend
    ports:
      - "3001:3000"
    environment:
      - NEXT_PUBLIC_API_URL=https://api.yourdomain.com
      - NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com/ws
    depends_on:
      - arena-api
    restart: unless-stopped

volumes:
  arena-data:
```

### Start Services

```bash
docker-compose up -d
```

---

## Nginx Configuration

Reverse proxy with SSL termination:

```nginx
upstream arena_api {
    server localhost:3002;
}

upstream arena_frontend {
    server localhost:3001;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://arena_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://arena_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## SSL Certificate

Using Let's Encrypt:

```bash
certbot certonly --nginx -d yourdomain.com -d api.yourdomain.com
```

---

## Data Persistence

The API server persists data to `/app/data/arena-data.json`.

Mount a Docker volume to preserve data across restarts:

```yaml
volumes:
  - arena-data:/app/data
```

For backups:

```bash
docker cp arena-api:/app/data/arena-data.json ./backup/
```

---

## Monitoring

### Health Check

```bash
curl https://api.yourdomain.com/health
```

Expected response:
```json
{
  "status": "ok",
  "uptime": 123456
}
```

### Logs

```bash
# API logs
docker logs -f arena-api

# Frontend logs
docker logs -f arena-frontend
```

### Stats Endpoint

```bash
curl https://api.yourdomain.com/api/stats
```

---

## Updating

### Pull Latest Code

```bash
git pull origin main
```

### Rebuild and Restart

```bash
docker-compose build
docker-compose up -d
```

### Zero-Downtime Update

```bash
docker-compose up -d --no-deps --build arena-api
docker-compose up -d --no-deps --build arena-frontend
```

---

## Troubleshooting

### Container Won't Start

Check logs:
```bash
docker logs arena-api
```

Verify environment variables:
```bash
docker exec arena-api env
```

### WebSocket Connection Fails

Ensure Nginx is configured for WebSocket upgrade:
```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### Data Not Persisting

Verify volume mount:
```bash
docker inspect arena-api | grep Mounts -A 10
```

### High Memory Usage

The server caches data in memory. Monitor with:
```bash
docker stats arena-api
```

Consider implementing Redis for production caching.
