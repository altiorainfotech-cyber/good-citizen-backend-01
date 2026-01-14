import { Controller, Get, Query, UseGuards, Req, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';

@ApiTags('Explore')
@Controller({ path: 'explore', version: '1' })
export class ExploreSimpleController {
  
  /**
   * Get nearby hospitals with location filtering
   */
  @Get('hospitals')
  @ApiOperation({ summary: 'Get nearby hospitals with location filtering' })
  async getHospitals(@Query() query: any) {
    const { latitude, longitude, radius = 10 } = query;
    
    // Mock hospitals data
    const hospitals = [
      {
        id: 'hospital-1',
        name: 'AIIMS Hospital',
        address: 'Ansari Nagar, New Delhi, Delhi 110029',
        coordinates: [77.2065, 28.5672],
        specialties: ['Emergency', 'Cardiology', 'Neurology'],
        availability: 'available',
        distance: 2.5,
        estimatedWaitTime: 15,
        contactInfo: {
          phone: '+91-11-26588500',
          emergency: '+91-11-26588700'
        }
      },
      {
        id: 'hospital-2',
        name: 'Fortis Hospital',
        address: 'B-22, Sector 62, Noida, Uttar Pradesh 201301',
        coordinates: [77.3507, 28.5672],
        specialties: ['Emergency', 'Orthopedics', 'Oncology'],
        availability: 'available',
        distance: 5.2,
        estimatedWaitTime: 20,
        contactInfo: {
          phone: '+91-120-6200000',
          emergency: '+91-120-6200108'
        }
      }
    ];

    return {
      count: hospitals.length,
      hospitals
    };
  }

  /**
   * Get available ambulance services
   */
  @Get('ambulances')
  @ApiOperation({ summary: 'Get available ambulance services with response times' })
  async getAmbulances(@Query() query: any) {
    const { latitude, longitude, radius = 20 } = query;
    
    // Mock ambulances data
    const ambulances = [
      {
        id: 'ambulance-1',
        name: 'Delhi Emergency Services',
        location: [77.209, 28.6139],
        responseTime: 8,
        vehicleType: 'Advanced Life Support',
        availability: true,
        contactNumber: '+91-108',
        services: ['Emergency Transport', 'Life Support', 'Cardiac Care']
      },
      {
        id: 'ambulance-2',
        name: 'Noida Medical Transport',
        location: [77.391, 28.5355],
        responseTime: 12,
        vehicleType: 'Basic Life Support',
        availability: true,
        contactNumber: '+91-120-2412345',
        services: ['Emergency Transport', 'Basic Life Support']
      }
    ];

    return {
      count: ambulances.length,
      ambulances
    };
  }

  /**
   * Get nearby blood banks with availability
   */
  @Get('blood-banks')
  @ApiOperation({ summary: 'Get nearby blood banks with availability status' })
  async getBloodBanks(@Query() query: any) {
    const { latitude, longitude, radius = 15 } = query;
    
    // Mock blood banks data
    const bloodBanks = [
      {
        id: 'bloodbank-1',
        name: 'Red Cross Blood Bank',
        address: 'Red Cross Bhawan, 1, Red Cross Road, New Delhi',
        coordinates: [77.2167, 28.6358],
        bloodTypes: {
          'A+': 25,
          'A-': 8,
          'B+': 30,
          'B-': 5,
          'AB+': 12,
          'AB-': 3,
          'O+': 40,
          'O-': 10
        },
        operatingHours: '24/7',
        emergencyContact: '+91-11-23711551',
        contactInfo: {
          phone: '+91-11-23711551',
          email: 'bloodbank@redcross.org.in'
        }
      }
    ];

    return {
      count: bloodBanks.length,
      bloodBanks
    };
  }

  /**
   * Get emergency services contact information
   */
  @Get('emergency-services')
  @ApiOperation({ summary: 'Get comprehensive emergency contact information' })
  async getEmergencyServices(@Query() query: any) {
    const emergencyServices = [
      {
        id: 'emergency-1',
        name: 'National Emergency Services',
        type: 'general',
        contactNumber: '112',
        description: 'National emergency helpline for all emergencies',
        availability: '24/7'
      },
      {
        id: 'emergency-2',
        name: 'Police Emergency',
        type: 'police',
        contactNumber: '100',
        description: 'Police emergency services',
        availability: '24/7'
      },
      {
        id: 'emergency-3',
        name: 'Fire Emergency',
        type: 'fire',
        contactNumber: '101',
        description: 'Fire department emergency services',
        availability: '24/7'
      },
      {
        id: 'emergency-4',
        name: 'Medical Emergency',
        type: 'medical',
        contactNumber: '108',
        description: 'Medical emergency and ambulance services',
        availability: '24/7'
      }
    ];

    return {
      count: emergencyServices.length,
      emergencyServices
    };
  }

  /**
   * Get health tips and safety information
   */
  @Get('health-tips')
  @ApiOperation({ summary: 'Get relevant health and safety information' })
  async getHealthTips(@Query() query: any) {
    const healthTips = [
      {
        id: 'tip-1',
        title: 'Emergency First Aid',
        category: 'emergency',
        content: 'Learn basic first aid techniques for common emergencies',
        priority: 'high',
        createdAt: new Date()
      },
      {
        id: 'tip-2',
        title: 'Road Safety Guidelines',
        category: 'safety',
        content: 'Important road safety tips for drivers and passengers',
        priority: 'medium',
        createdAt: new Date()
      },
      {
        id: 'tip-3',
        title: 'Health Checkup Reminders',
        category: 'health',
        content: 'Regular health checkup schedule and importance',
        priority: 'low',
        createdAt: new Date()
      }
    ];

    return {
      count: healthTips.length,
      healthTips
    };
  }

  /**
   * Get community statistics and metrics
   */
  @Get('community-stats')
  @ApiOperation({ summary: 'Get aggregated platform usage and assistance metrics' })
  async getCommunityStats(@Query() query: any) {
    const stats = {
      totalUsers: 15420,
      totalRides: 89650,
      emergencyAssists: 1250,
      communityPoints: 245800,
      activeDrivers: 3200,
      timeframe: '30d',
      lastUpdated: new Date(),
      breakdown: {
        ridesThisMonth: 12450,
        emergencyAssistsThisMonth: 180,
        newUsersThisMonth: 890,
        topContributors: [
          { userId: 'user-1', points: 2500, assists: 45 },
          { userId: 'user-2', points: 2200, assists: 38 },
          { userId: 'user-3', points: 1980, assists: 32 }
        ]
      }
    };

    return {
      communityStats: stats
    };
  }
}