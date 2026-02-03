import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { redisSub, CHANNELS } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import type { WSEvent } from '@arena/shared';

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  agentId?: string;
  subscriptions: Set<string>;
}

let wss: WebSocketServer;
const clients = new Map<string, ExtendedWebSocket>();

export function createWebSocketServer(server: Server): WebSocketServer {
  wss = new WebSocketServer({ 
    server,
    path: '/ws',
  });

  // Setup Redis subscription
  setupRedisSubscription();

  wss.on('connection', (ws: ExtendedWebSocket, req) => {
    ws.isAlive = true;
    ws.subscriptions = new Set();

    // Parse token from query string
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (token) {
      // TODO: Validate token and get agentId
      ws.agentId = token.slice(0, 20); // Simplified
      clients.set(ws.agentId, ws);
    }

    logger.debug(`WebSocket connected: ${ws.agentId || 'anonymous'}`);

    // Handle pong
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(ws, message);
      } catch (error) {
        logger.error('WebSocket message error:', error);
      }
    });

    // Handle close
    ws.on('close', () => {
      if (ws.agentId) {
        clients.delete(ws.agentId);
        logger.debug(`WebSocket disconnected: ${ws.agentId}`);
      }
    });

    // Send welcome message
    send(ws, { type: 'connected', data: { timestamp: new Date().toISOString() } });
  });

  // Heartbeat interval
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const extWs = ws as ExtendedWebSocket;
      if (!extWs.isAlive) {
        return ws.terminate();
      }
      extWs.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}

function handleMessage(ws: ExtendedWebSocket, message: { type: string; data?: unknown }) {
  switch (message.type) {
    case 'ping':
      send(ws, { type: 'pong', data: { timestamp: Date.now() } });
      break;

    case 'subscribe_token':
      if (message.data && typeof message.data === 'object' && 'address' in message.data) {
        ws.subscriptions.add(`token:${(message.data as { address: string }).address}`);
      }
      break;

    case 'unsubscribe_token':
      if (message.data && typeof message.data === 'object' && 'address' in message.data) {
        ws.subscriptions.delete(`token:${(message.data as { address: string }).address}`);
      }
      break;

    case 'heartbeat':
      // Agent is still active
      break;

    default:
      logger.debug(`Unknown WebSocket message type: ${message.type}`);
  }
}

function setupRedisSubscription() {
  // Subscribe to all channels
  Object.values(CHANNELS).forEach((channel) => {
    redisSub.subscribe(channel);
  });

  redisSub.on('message', (channel, message) => {
    try {
      const event = JSON.parse(message) as WSEvent;
      broadcastEvent(event, channel);
    } catch (error) {
      logger.error('Redis message parse error:', error);
    }
  });
}

function broadcastEvent(event: WSEvent, channel: string) {
  const data = JSON.stringify(event);
  let count = 0;

  wss.clients.forEach((client) => {
    const ws = client as ExtendedWebSocket;
    
    if (ws.readyState !== WebSocket.OPEN) return;

    // Check if client should receive this event
    let shouldSend = true;

    // Token-specific events only go to subscribers
    if (channel === CHANNELS.TOKENS && event.type === 'price_update') {
      const tokenAddress = (event as any).data?.address;
      if (tokenAddress && !ws.subscriptions.has(`token:${tokenAddress}`)) {
        // For price updates, only send to subscribers OR if it's a general broadcast
        // Actually, let's send all price updates for now
        shouldSend = true;
      }
    }

    if (shouldSend) {
      ws.send(data);
      count++;
    }
  });

  logger.debug(`Broadcast ${event.type} to ${count} clients`);
}

function send(ws: WebSocket, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// Broadcast to all connected clients
export function broadcast(event: WSEvent) {
  const data = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Send to specific agent
export function sendToAgent(agentId: string, event: WSEvent) {
  const client = clients.get(agentId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(event));
  }
}

// Get connected client count
export function getClientCount(): number {
  return wss?.clients.size || 0;
}
