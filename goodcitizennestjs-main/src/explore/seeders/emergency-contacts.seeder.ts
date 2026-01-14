import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EmergencyContact,
  EmergencyContactDocument,
} from '../../entities/emergency-contact.entity';

@Injectable()
export class EmergencyContactsSeeder {
  private readonly logger = new Logger(EmergencyContactsSeeder.name);

  constructor(
    @InjectModel(EmergencyContact.name)
    private emergencyContactModel: Model<EmergencyContactDocument>,
  ) {}

  async seed(): Promise<void> {
    try {
      const existingCount = await this.emergencyContactModel.countDocuments();
      if (existingCount > 0) {
        this.logger.log('Emergency contacts already seeded');
        return;
      }

      const emergencyContacts = [
        // National Emergency Services
        {
          name: 'National Emergency Services',
          serviceType: 'general',
          contactNumber: '112',
          description: 'National emergency helpline for all emergencies',
          scope: 'national',
          availability: '24/7',
          languages: ['English', 'Hindi'],
          status: 'active',
        },
        {
          name: 'Police Emergency',
          serviceType: 'police',
          contactNumber: '100',
          description: 'Police emergency services',
          scope: 'national',
          availability: '24/7',
          languages: ['English', 'Hindi'],
          status: 'active',
        },
        {
          name: 'Fire Emergency',
          serviceType: 'fire',
          contactNumber: '101',
          description: 'Fire department emergency services',
          scope: 'national',
          availability: '24/7',
          languages: ['English', 'Hindi'],
          status: 'active',
        },
        {
          name: 'Medical Emergency',
          serviceType: 'medical',
          contactNumber: '108',
          description: 'Medical emergency and ambulance services',
          scope: 'national',
          availability: '24/7',
          languages: ['English', 'Hindi'],
          status: 'active',
        },
        {
          name: 'Disaster Management',
          serviceType: 'disaster',
          contactNumber: '1078',
          description: 'National Disaster Management Authority helpline',
          scope: 'national',
          availability: '24/7',
          languages: ['English', 'Hindi'],
          status: 'active',
        },

        // Delhi State Emergency Services
        {
          name: 'Delhi Police Control Room',
          serviceType: 'police',
          contactNumber: '011-23490000',
          alternateNumber: '100',
          description: 'Delhi Police emergency control room',
          scope: 'state',
          state: 'Delhi',
          city: 'New Delhi',
          location: {
            type: 'Point',
            coordinates: [77.209, 28.6139], // New Delhi coordinates
          },
          coverageRadius: 50,
          availability: '24/7',
          languages: ['English', 'Hindi'],
          status: 'active',
        },
        {
          name: 'Delhi Fire Service',
          serviceType: 'fire',
          contactNumber: '011-23353333',
          alternateNumber: '101',
          description: 'Delhi Fire Service emergency response',
          scope: 'state',
          state: 'Delhi',
          city: 'New Delhi',
          location: {
            type: 'Point',
            coordinates: [77.209, 28.6139],
          },
          coverageRadius: 50,
          availability: '24/7',
          languages: ['English', 'Hindi'],
          status: 'active',
        },
        {
          name: 'CATS Ambulance Service Delhi',
          serviceType: 'ambulance',
          contactNumber: '011-23389999',
          alternateNumber: '108',
          description: 'Centralized Accident & Trauma Services ambulance',
          scope: 'state',
          state: 'Delhi',
          city: 'New Delhi',
          location: {
            type: 'Point',
            coordinates: [77.209, 28.6139],
          },
          coverageRadius: 50,
          availability: '24/7',
          languages: ['English', 'Hindi'],
          status: 'active',
        },

        // Mumbai Emergency Services
        {
          name: 'Mumbai Police Control Room',
          serviceType: 'police',
          contactNumber: '022-22621855',
          alternateNumber: '100',
          description: 'Mumbai Police emergency control room',
          scope: 'city',
          state: 'Maharashtra',
          city: 'Mumbai',
          location: {
            type: 'Point',
            coordinates: [72.8777, 19.076], // Mumbai coordinates
          },
          coverageRadius: 40,
          availability: '24/7',
          languages: ['English', 'Hindi', 'Marathi'],
          status: 'active',
        },
        {
          name: 'Mumbai Fire Brigade',
          serviceType: 'fire',
          contactNumber: '022-23076666',
          alternateNumber: '101',
          description: 'Mumbai Fire Brigade emergency services',
          scope: 'city',
          state: 'Maharashtra',
          city: 'Mumbai',
          location: {
            type: 'Point',
            coordinates: [72.8777, 19.076],
          },
          coverageRadius: 40,
          availability: '24/7',
          languages: ['English', 'Hindi', 'Marathi'],
          status: 'active',
        },

        // Bangalore Emergency Services
        {
          name: 'Bangalore Police Control Room',
          serviceType: 'police',
          contactNumber: '080-22943333',
          alternateNumber: '100',
          description: 'Bangalore Police emergency control room',
          scope: 'city',
          state: 'Karnataka',
          city: 'Bangalore',
          location: {
            type: 'Point',
            coordinates: [77.5946, 12.9716], // Bangalore coordinates
          },
          coverageRadius: 35,
          availability: '24/7',
          languages: ['English', 'Hindi', 'Kannada'],
          status: 'active',
        },
        {
          name: 'Bangalore Fire & Emergency Services',
          serviceType: 'fire',
          contactNumber: '080-25588888',
          alternateNumber: '101',
          description: 'Bangalore Fire & Emergency Services',
          scope: 'city',
          state: 'Karnataka',
          city: 'Bangalore',
          location: {
            type: 'Point',
            coordinates: [77.5946, 12.9716],
          },
          coverageRadius: 35,
          availability: '24/7',
          languages: ['English', 'Hindi', 'Kannada'],
          status: 'active',
        },

        // Chennai Emergency Services
        {
          name: 'Chennai Police Control Room',
          serviceType: 'police',
          contactNumber: '044-28447777',
          alternateNumber: '100',
          description: 'Chennai Police emergency control room',
          scope: 'city',
          state: 'Tamil Nadu',
          city: 'Chennai',
          location: {
            type: 'Point',
            coordinates: [80.2707, 13.0827], // Chennai coordinates
          },
          coverageRadius: 30,
          availability: '24/7',
          languages: ['English', 'Hindi', 'Tamil'],
          status: 'active',
        },
        {
          name: 'Chennai Fire & Rescue Services',
          serviceType: 'fire',
          contactNumber: '044-25619999',
          alternateNumber: '101',
          description: 'Chennai Fire & Rescue Services',
          scope: 'city',
          state: 'Tamil Nadu',
          city: 'Chennai',
          location: {
            type: 'Point',
            coordinates: [80.2707, 13.0827],
          },
          coverageRadius: 30,
          availability: '24/7',
          languages: ['English', 'Hindi', 'Tamil'],
          status: 'active',
        },

        // Specialized Emergency Services
        {
          name: 'Women Helpline',
          serviceType: 'general',
          contactNumber: '1091',
          description: 'National helpline for women in distress',
          scope: 'national',
          availability: '24/7',
          languages: ['English', 'Hindi'],
          status: 'active',
        },
        {
          name: 'Child Helpline',
          serviceType: 'general',
          contactNumber: '1098',
          description: 'National helpline for children in need',
          scope: 'national',
          availability: '24/7',
          languages: ['English', 'Hindi'],
          status: 'active',
        },
        {
          name: 'Tourist Helpline',
          serviceType: 'general',
          contactNumber: '1363',
          description: 'Tourist assistance and emergency helpline',
          scope: 'national',
          availability: '24/7',
          languages: ['English', 'Hindi'],
          status: 'active',
        },
      ];

      await this.emergencyContactModel.insertMany(emergencyContacts);
      this.logger.log(`Seeded ${emergencyContacts.length} emergency contacts`);
    } catch (error) {
      this.logger.error(
        `Failed to seed emergency contacts: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
