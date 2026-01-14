/**
 * Demo script showing how to use the enhanced WebSocket real-time updates
 * This demonstrates the new functionality added for task 11
 */

import { SocketGateway } from './web-socket.gateway';
import { RealTimeUpdatesService } from './real-time-updates.service';

export class RealTimeUpdatesDemo {
  constructor(
    private readonly socketGateway: SocketGateway,
    private readonly realTimeService: RealTimeUpdatesService,
  ) {}

  /**
   * Demo: Emergency service availability update
   */
  async demoEmergencyServiceUpdate() {
    console.log('🚨 Demo: Broadcasting emergency service update...');
    
    const location = { latitude: 40.7128, longitude: -74.0060 };
    const serviceData = {
      serviceId: 'hospital-demo-123',
      serviceType: 'hospital' as const,
      status: 'available' as const,
      availability: {
        estimatedWaitTime: 15,
        capacity: 80,
      },
    };

    await this.socketGateway.broadcastEmergencyServiceUpdate(location, serviceData);
    console.log('✅ Emergency service update broadcasted');
  }

  /**
   * Demo: Impact calculation completion
   */
  async demoImpactUpdate() {
    console.log('📊 Demo: Broadcasting impact calculation completion...');
    
    const userId = 'demo-user-123';
    const impactData = {
      assistId: 'assist-demo-456',
      metrics: {
        timeSaved: 5,
        livesAffected: 2,
        responseTimeImprovement: 25,
        communityContribution: 100,
      },
    };

    await this.socketGateway.broadcastImpactUpdate(userId, impactData);
    console.log('✅ Impact update broadcasted');
  }

  /**
   * Demo: Rewards update
   */
  async demoRewardsUpdate() {
    console.log('🎁 Demo: Broadcasting rewards update...');
    
    const userId = 'demo-user-123';
    const rewardsData = {
      action: 'Emergency assist completed',
      points: 50,
      type: 'emergency_assist' as const,
      description: 'Helped ambulance clear path on Main Street',
    };

    await this.socketGateway.broadcastRewardsUpdate(userId, rewardsData);
    console.log('✅ Rewards update broadcasted');
  }

  /**
   * Demo: Ambulance availability update
   */
  async demoAmbulanceUpdate() {
    console.log('🚑 Demo: Updating ambulance availability...');
    
    const ambulanceId = 'ambulance-demo-789';
    const location = { latitude: 40.7589, longitude: -73.9851 };
    const responseTime = 8;

    await this.realTimeService.updateAmbulanceAvailability(
      ambulanceId,
      true,
      location,
      responseTime,
    );
    console.log('✅ Ambulance availability updated');
  }

  /**
   * Demo: Emergency service status update
   */
  async demoEmergencyServiceStatusUpdate() {
    console.log('🏥 Demo: Updating emergency service status...');
    
    const serviceId = 'hospital-demo-456';
    const serviceType = 'hospital' as const;
    const status = 'busy' as const;
    const additionalData = {
      capacity: 60,
      estimatedWaitTime: 25,
      location: { latitude: 40.7128, longitude: -74.0060 },
    };

    await this.realTimeService.updateEmergencyServiceStatus(
      serviceId,
      serviceType,
      status,
      additionalData,
    );
    console.log('✅ Emergency service status updated');
  }

  /**
   * Run all demos
   */
  async runAllDemos() {
    console.log('🚀 Starting Real-time Updates Demo...\n');

    try {
      await this.demoEmergencyServiceUpdate();
      console.log('');

      await this.demoImpactUpdate();
      console.log('');

      await this.demoRewardsUpdate();
      console.log('');

      await this.demoAmbulanceUpdate();
      console.log('');

      await this.demoEmergencyServiceStatusUpdate();
      console.log('');

      // Show connection statistics
      const stats = this.realTimeService.getConnectionStats();
      console.log('📈 Connection Statistics:');
      console.log(`   Connected Users: ${stats.connectedUsers}`);
      console.log(`   Location Subscriptions: ${stats.locationSubscriptions}`);
      console.log(`   Emergency Subscriptions: ${stats.emergencySubscriptions}`);
      console.log(`   Total Subscriptions: ${stats.totalSubscriptions}`);

      console.log('\n✨ Real-time Updates Demo completed successfully!');
    } catch (error) {
      console.error('❌ Demo failed:', error.message);
    }
  }

  /**
   * Demo: Client subscription flow
   */
  demoClientSubscriptionFlow() {
    console.log('📱 Demo: Client WebSocket subscription flow...\n');

    console.log('1. Client connects to WebSocket with authentication token');
    console.log('2. Client subscribes to emergency updates:');
    console.log('   socket.emit("subscribe_emergency_updates", {');
    console.log('     location: { latitude: 40.7128, longitude: -74.0060 },');
    console.log('     radius: 10');
    console.log('   });');
    console.log('');

    console.log('3. Client subscribes to impact updates:');
    console.log('   socket.emit("subscribe_impact_updates", { userId: "user-123" });');
    console.log('');

    console.log('4. Client subscribes to rewards updates:');
    console.log('   socket.emit("subscribe_rewards_updates", { userId: "user-123" });');
    console.log('');

    console.log('5. Client receives real-time updates:');
    console.log('   - emergency_service_status_update');
    console.log('   - impact_calculation_complete');
    console.log('   - rewards_update');
    console.log('   - ambulance_availability_update');
    console.log('');

    console.log('6. Frontend Redux store automatically updates with new data');
    console.log('7. UI components re-render with live data');
    console.log('');

    console.log('✅ Client subscription flow demo completed!');
  }
}

/**
 * Usage example:
 * 
 * const demo = new RealTimeUpdatesDemo(socketGateway, realTimeService);
 * await demo.runAllDemos();
 * demo.demoClientSubscriptionFlow();
 */