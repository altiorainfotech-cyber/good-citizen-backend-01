/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-call */

import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { INestApplication } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | undefined;

  constructor(app: INestApplication) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      },
    });

    const subClient = pubClient.duplicate();

    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.adapterConstructor = createAdapter(pubClient, subClient, {
        key: 'socket.io',
        requestsTimeout: 5000,
      });
// console.log removed
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      // Fallback to memory adapter if Redis is not available
      this.adapterConstructor = undefined;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
// console.log removed
    } else {
      console.warn('Using default memory adapter (Redis not available)');
    }

    return server;
  }

  async init(): Promise<void> {
    await this.connectToRedis();
  }
}
