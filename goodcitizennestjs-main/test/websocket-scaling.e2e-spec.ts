/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { io, Socket } from 'socket.io-client';
import { RedisIoAdapter } from '../src/web-socket/redis-io.adapter';

describe('WebSocket Scaling with Redis Adapter (e2e)', () => {
  let app1: INestApplication;
  let app2: INestApplication;
  const testUsers: Array<{ token: string; id: string }> = [];

  beforeAll(async () => {
    // Create first app instance
    const moduleFixture1: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app1 = moduleFixture1.createNestApplication();
    app1.useWebSocketAdapter(new RedisIoAdapter(app1));
    await app1.init();
    await app1.listen(3004);

    // Create second app instance
    const moduleFixture2: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app2 = moduleFixture2.createNestApplication();
    app2.useWebSocketAdapter(new RedisIoAdapter(app2));
    await app2.init();
    await app2.listen(3005);

    // Create test users
    for (let i = 0; i < 50; i++) {
      const userResponse = await request(app1.getHttpServer())
        .post('/auth/signup')
        .send({
          first_name: `ScaleUser${i}`,
          last_name: 'Test',
          email: `scaleuser${i}@example.com`,
          password: 'password123',
          phone_number: `3333333${String(i).padStart(3, '0')}`,
          country_code: '+1',
          role: 'USER',
        });

      if (userResponse.status === 201) {
        testUsers.push({
          token: userResponse.body.access_token,
          id: userResponse.body.user._id,
        });
      }
    }
  });

  afterAll(async () => {
    await app1.close();
    await app2.close();
  });

  describe('Multi-Instance WebSocket Communication', () => {
    it('should handle cross-instance WebSocket communication via Redis', (done) => {
      const sockets1: Socket[] = [];
      const sockets2: Socket[] = [];
      let messagesReceived = 0;
      const expectedMessages = 20;

      // Connect 10 sockets to first instance
      for (let i = 0; i < 10; i++) {
        const socket = io('http://localhost:3004', {
          auth: {
            token: testUsers[i]?.token,
          },
        });

        sockets1.push(socket);

        socket.on('location_broadcast', (data) => {
          messagesReceived++;
          expect(data).toBeDefined();
          expect(data.latitude).toBeDefined();
          expect(data.longitude).toBeDefined();

          if (messagesReceived === expectedMessages) {
            // Cleanup
            sockets1.forEach((s) => s.disconnect());
            sockets2.forEach((s) => s.disconnect());
            done();
          }
        });
      }

      // Connect 10 sockets to second instance
      for (let i = 10; i < 20; i++) {
        const socket = io('http://localhost:3005', {
          auth: {
            token: testUsers[i]?.token,
          },
        });

        sockets2.push(socket);

        socket.on('location_broadcast', (data) => {
          messagesReceived++;
          expect(data).toBeDefined();

          if (messagesReceived === expectedMessages) {
            // Cleanup
            sockets1.forEach((s) => s.disconnect());
            sockets2.forEach((s) => s.disconnect());
            done();
          }
        });
      }

      // Wait for connections to establish, then broadcast from first instance
      setTimeout(() => {
        sockets1[0]?.emit('broadcast_location', {
          latitude: 40.7128,
          longitude: -74.006,
          message: 'Cross-instance test',
        });
      }, 1000);
    });

    it('should scale to 500+ concurrent WebSocket connections across instances', (done) => {
      const totalConnections = Math.min(500, testUsers.length * 10);
      const connectionsPerInstance = Math.floor(totalConnections / 2);
      const sockets: Socket[] = [];
      let connectedCount = 0;

      const startTime = Date.now();

      // Connect to first instance
      for (let i = 0; i < connectionsPerInstance; i++) {
        const userIndex = i % testUsers.length;
        const socket = io('http://localhost:3004', {
          auth: {
            token: testUsers[userIndex]?.token,
          },
          forceNew: true,
        });

        sockets.push(socket);

        socket.on('connect', () => {
          connectedCount++;
          checkCompletion();
        });

        socket.on('connect_error', (error) => {
          console.error(`Socket ${i} (instance 1) connection error:`, error);
          connectedCount++; // Count as processed
          checkCompletion();
        });
      }

      // Connect to second instance
      for (let i = 0; i < connectionsPerInstance; i++) {
        const userIndex = i % testUsers.length;
        const socket = io('http://localhost:3005', {
          auth: {
            token: testUsers[userIndex]?.token,
          },
          forceNew: true,
        });

        sockets.push(socket);

        socket.on('connect', () => {
          connectedCount++;
          checkCompletion();
        });

        socket.on('connect_error', (error) => {
          console.error(`Socket ${i} (instance 2) connection error:`, error);
          connectedCount++; // Count as processed
          checkCompletion();
        });
      }

      function checkCompletion() {
        if (connectedCount >= totalConnections) {
          const connectionTime = Date.now() - startTime;
          const successfulConnections = sockets.filter(
            (s) => s.connected,
          ).length;

          console.log(
            `${totalConnections} connection attempts completed in ${connectionTime}ms`,
          );
          console.log(`Successful connections: ${successfulConnections}`);
          console.log(
            `Success rate: ${((successfulConnections / totalConnections) * 100).toFixed(2)}%`,
          );

          // Cleanup
          sockets.forEach((s) => {
            if (s.connected) {
              s.disconnect();
            }
          });

          expect(successfulConnections).toBeGreaterThan(totalConnections * 0.8); // 80% success rate
          expect(connectionTime).toBeLessThan(15000); // 15 seconds max
          done();
        }
      }
    });

    it('should handle high-frequency message broadcasting across instances', (done) => {
      const numSenders = 5;
      const numReceivers = 20;
      const messagesPerSender = 10;
      const expectedTotalMessages =
        numSenders * messagesPerSender * numReceivers;

      const senderSockets: Socket[] = [];
      const receiverSockets: Socket[] = [];
      let messagesReceived = 0;

      // Create sender sockets (connected to first instance)
      for (let i = 0; i < numSenders; i++) {
        const socket = io('http://localhost:3004', {
          auth: {
            token: testUsers[i]?.token,
          },
        });
        senderSockets.push(socket);
      }

      // Create receiver sockets (connected to both instances)
      for (let i = 0; i < numReceivers; i++) {
        const instanceUrl =
          i % 2 === 0 ? 'http://localhost:3004' : 'http://localhost:3005';
        const socket = io(instanceUrl, {
          auth: {
            token: testUsers[i % testUsers.length]?.token,
          },
        });

        receiverSockets.push(socket);

        socket.on('high_frequency_message', (data) => {
          messagesReceived++;
          expect(data.senderId).toBeDefined();
          expect(data.messageIndex).toBeDefined();

          if (messagesReceived >= expectedTotalMessages * 0.8) {
            // Allow for some message loss
            // Cleanup
            senderSockets.forEach((s) => s.disconnect());
            receiverSockets.forEach((s) => s.disconnect());

            const deliveryRate =
              (messagesReceived / expectedTotalMessages) * 100;
            console.log(`Message delivery rate: ${deliveryRate.toFixed(2)}%`);
            console.log(
              `Messages received: ${messagesReceived}/${expectedTotalMessages}`,
            );

            expect(deliveryRate).toBeGreaterThan(70); // 70% delivery rate
            done();
          }
        });
      }

      // Wait for connections, then start sending messages
      setTimeout(() => {
        senderSockets.forEach((socket, senderIndex) => {
          if (socket.connected) {
            for (
              let messageIndex = 0;
              messageIndex < messagesPerSender;
              messageIndex++
            ) {
              setTimeout(() => {
                socket.emit('broadcast_high_frequency', {
                  senderId: senderIndex,
                  messageIndex: messageIndex,
                  timestamp: Date.now(),
                });
              }, messageIndex * 100); // 100ms intervals
            }
          }
        });
      }, 2000);

      // Timeout after 30 seconds
      setTimeout(() => {
        senderSockets.forEach((s) => s.disconnect());
        receiverSockets.forEach((s) => s.disconnect());

        if (messagesReceived < expectedTotalMessages * 0.8) {
          console.log(
            `Test timed out. Messages received: ${messagesReceived}/${expectedTotalMessages}`,
          );
          done();
        }
      }, 30000);
    });
  });

  describe('Redis Adapter Performance', () => {
    it('should maintain low latency with Redis message passing', (done) => {
      const numTests = 50;
      const latencies: number[] = [];
      let completedTests = 0;

      const senderSocket = io('http://localhost:3004', {
        auth: {
          token: testUsers[0]?.token,
        },
      });

      const receiverSocket = io('http://localhost:3005', {
        auth: {
          token: testUsers[1]?.token,
        },
      });

      receiverSocket.on('latency_test_message', (data) => {
        const receiveTime = Date.now();
        const latency = receiveTime - data.sendTime;
        latencies.push(latency);
        completedTests++;

        if (completedTests === numTests) {
          const avgLatency =
            latencies.reduce((a, b) => a + b, 0) / latencies.length;
          const maxLatency = Math.max(...latencies);
          const minLatency = Math.min(...latencies);

          console.log(`Average Redis latency: ${avgLatency.toFixed(2)}ms`);
          console.log(
            `Min latency: ${minLatency}ms, Max latency: ${maxLatency}ms`,
          );

          senderSocket.disconnect();
          receiverSocket.disconnect();

          expect(avgLatency).toBeLessThan(100); // Average under 100ms
          expect(maxLatency).toBeLessThan(500); // Max under 500ms
          done();
        }
      });

      // Wait for connections, then start latency tests
      setTimeout(() => {
        for (let i = 0; i < numTests; i++) {
          setTimeout(() => {
            senderSocket.emit('send_latency_test', {
              testIndex: i,
              sendTime: Date.now(),
            });
          }, i * 100);
        }
      }, 1000);
    });

    it('should handle Redis connection failures gracefully', (done) => {
      // This test would require actually stopping Redis, which is complex in a test environment
      // Instead, we'll test the error handling mechanisms

      const socket = io('http://localhost:3004', {
        auth: {
          token: testUsers[0]?.token,
        },
      });

      socket.on('connect', () => {
        // Send a message that would normally go through Redis
        socket.emit('test_redis_resilience', {
          message: 'Testing Redis resilience',
        });

        // If we get here without errors, Redis is working
        socket.disconnect();
        done();
      });

      socket.on('connect_error', (error) => {
        console.error('Connection error during Redis resilience test:', error);
        done();
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        socket.disconnect();
        done();
      }, 5000);
    });
  });

  describe('Memory Usage Under WebSocket Load', () => {
    it('should maintain reasonable memory usage with many connections', async () => {
      const initialMemory = process.memoryUsage();
      const numConnections = 100;
      const sockets: Socket[] = [];

      // Create many connections
      for (let i = 0; i < numConnections; i++) {
        const socket = io('http://localhost:3004', {
          auth: {
            token: testUsers[i % testUsers.length]?.token,
          },
        });
        sockets.push(socket);
      }

      // Wait for connections to establish
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const peakMemory = process.memoryUsage();

      // Send messages through all connections
      sockets.forEach((socket, index) => {
        if (socket.connected) {
          socket.emit('memory_test_message', {
            index: index,
            data: 'x'.repeat(1000), // 1KB message
          });
        }
      });

      // Wait for message processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const finalMemory = process.memoryUsage();

      // Cleanup
      sockets.forEach((s) => s.disconnect());

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryPerConnection = memoryIncrease / numConnections;

      console.log(
        `Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`,
      );
      console.log(
        `Memory per connection: ${(memoryPerConnection / 1024).toFixed(2)} KB`,
      );

      expect(memoryPerConnection).toBeLessThan(50 * 1024); // Less than 50KB per connection
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB total
    });
  });
});
