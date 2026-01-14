import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  HealthcareFacility,
  HealthcareFacilityDocument,
} from '../entities/healthcare-facility.entity';
import { BloodBank, BloodBankDocument } from '../entities/blood-bank.entity';
import {
  AmbulanceProvider,
  AmbulanceProviderDocument,
} from '../entities/ambulance-provider.entity';

@Injectable()
export class HealthcareFacilitySeeder {
  private readonly logger = new Logger(HealthcareFacilitySeeder.name);

  constructor(
    @InjectModel(HealthcareFacility.name)
    private healthcareFacilityModel: Model<HealthcareFacilityDocument>,
    @InjectModel(BloodBank.name)
    private bloodBankModel: Model<BloodBankDocument>,
    @InjectModel(AmbulanceProvider.name)
    private ambulanceProviderModel: Model<AmbulanceProviderDocument>,
  ) {}

  /**
   * Seed comprehensive healthcare facility data
   * Requirements: 1.1, 1.2, 1.3 - Location-based healthcare facility discovery
   */
  async seedHealthcareFacilities() {
    this.logger.log('Starting healthcare facilities seeding...');

    const facilities = [
      // Major Hospitals in Delhi NCR
      {
        name: 'All India Institute of Medical Sciences (AIIMS)',
        type: 'hospital',
        location: {
          type: 'Point',
          coordinates: [77.209, 28.5672], // [longitude, latitude] - AIIMS Delhi
        },
        address: 'Sri Aurobindo Marg, Ansari Nagar, New Delhi, Delhi 110029',
        services: [
          'cardiology',
          'neurology',
          'oncology',
          'emergency',
          'surgery',
          'pediatrics',
          'orthopedics',
        ],
        operatingHours: {
          monday: '24/7',
          tuesday: '24/7',
          wednesday: '24/7',
          thursday: '24/7',
          friday: '24/7',
          saturday: '24/7',
          sunday: '24/7',
        },
        contactInfo: {
          phone: '+91-11-26588500',
          emergency: '+91-11-26588700',
          email: 'info@aiims.edu',
        },
        isActive: true,
        metadata: {
          availability: 'available',
          estimatedWaitTime: 30,
          rating: 4.8,
          specializations: ['trauma care', 'cardiac surgery', 'neurosurgery'],
          bedCapacity: 2500,
          currentOccupancy: 85,
        },
      },
      {
        name: 'Fortis Hospital Gurgaon',
        type: 'hospital',
        location: {
          type: 'Point',
          coordinates: [77.0688, 28.4595], // Gurgaon
        },
        address: 'Sector 44, Gurugram, Haryana 122002',
        services: [
          'cardiology',
          'orthopedics',
          'gastroenterology',
          'emergency',
          'oncology',
          'neurology',
        ],
        operatingHours: {
          monday: '24/7',
          tuesday: '24/7',
          wednesday: '24/7',
          thursday: '24/7',
          friday: '24/7',
          saturday: '24/7',
          sunday: '24/7',
        },
        contactInfo: {
          phone: '+91-124-4962200',
          emergency: '+91-124-4962299',
          email: 'info@fortishealthcare.com',
        },
        isActive: true,
        metadata: {
          availability: 'busy',
          estimatedWaitTime: 45,
          rating: 4.5,
          specializations: ['robotic surgery', 'minimal invasive surgery'],
          bedCapacity: 1000,
          currentOccupancy: 92,
        },
      },
      {
        name: 'Max Super Speciality Hospital Saket',
        type: 'hospital',
        location: {
          type: 'Point',
          coordinates: [77.2167, 28.5355], // Saket, Delhi
        },
        address: '1, 2, Press Enclave Road, Saket, New Delhi, Delhi 110017',
        services: [
          'cardiology',
          'neurology',
          'oncology',
          'pediatrics',
          'emergency',
          'orthopedics',
        ],
        operatingHours: {
          monday: '24/7',
          tuesday: '24/7',
          wednesday: '24/7',
          thursday: '24/7',
          friday: '24/7',
          saturday: '24/7',
          sunday: '24/7',
        },
        contactInfo: {
          phone: '+91-11-26515050',
          emergency: '+91-11-26515099',
          email: 'info@maxhealthcare.com',
        },
        isActive: true,
        metadata: {
          availability: 'available',
          estimatedWaitTime: 20,
          rating: 4.6,
          specializations: [
            'liver transplant',
            'kidney transplant',
            'bone marrow transplant',
          ],
          bedCapacity: 800,
          currentOccupancy: 78,
        },
      },
      {
        name: 'Apollo Hospital Delhi',
        type: 'hospital',
        location: {
          type: 'Point',
          coordinates: [77.2773, 28.5562], // Mathura Road, Delhi
        },
        address: 'Mathura Road, Sarita Vihar, New Delhi, Delhi 110076',
        services: [
          'cardiology',
          'neurology',
          'oncology',
          'emergency',
          'surgery',
          'pediatrics',
        ],
        operatingHours: {
          monday: '24/7',
          tuesday: '24/7',
          wednesday: '24/7',
          thursday: '24/7',
          friday: '24/7',
          saturday: '24/7',
          sunday: '24/7',
        },
        contactInfo: {
          phone: '+91-11-26925858',
          emergency: '+91-11-26925800',
          email: 'info@apollohospitals.com',
        },
        isActive: true,
        metadata: {
          availability: 'available',
          estimatedWaitTime: 25,
          rating: 4.7,
          specializations: [
            'heart surgery',
            'cancer treatment',
            'organ transplant',
          ],
          bedCapacity: 1200,
          currentOccupancy: 82,
        },
      },

      // Specialty Clinics
      {
        name: 'Delhi Heart & Lung Institute',
        type: 'clinic',
        location: {
          type: 'Point',
          coordinates: [77.1025, 28.7041], // Pashchim Vihar, Delhi
        },
        address: '3, Panchkuian Road, New Delhi, Delhi 110055',
        services: ['cardiology', 'pulmonology', 'cardiac surgery', 'emergency'],
        operatingHours: {
          monday: '8:00-20:00',
          tuesday: '8:00-20:00',
          wednesday: '8:00-20:00',
          thursday: '8:00-20:00',
          friday: '8:00-20:00',
          saturday: '8:00-16:00',
          sunday: 'Emergency only',
        },
        contactInfo: {
          phone: '+91-11-25738938',
          emergency: '+91-11-25738900',
          email: 'info@dhli.com',
        },
        isActive: true,
        metadata: {
          availability: 'available',
          estimatedWaitTime: 15,
          rating: 4.4,
          specializations: ['interventional cardiology', 'thoracic surgery'],
          bedCapacity: 200,
          currentOccupancy: 65,
        },
      },
      {
        name: 'BLK Super Speciality Hospital',
        type: 'hospital',
        location: {
          type: 'Point',
          coordinates: [77.2096, 28.6692], // Pusa Road, Delhi
        },
        address: 'Pusa Road, Rajinder Nagar, New Delhi, Delhi 110005',
        services: [
          'cardiology',
          'neurology',
          'oncology',
          'emergency',
          'orthopedics',
          'gastroenterology',
        ],
        operatingHours: {
          monday: '24/7',
          tuesday: '24/7',
          wednesday: '24/7',
          thursday: '24/7',
          friday: '24/7',
          saturday: '24/7',
          sunday: '24/7',
        },
        contactInfo: {
          phone: '+91-11-30403040',
          emergency: '+91-11-30403000',
          email: 'info@blkhospital.com',
        },
        isActive: true,
        metadata: {
          availability: 'busy',
          estimatedWaitTime: 35,
          rating: 4.3,
          specializations: ['liver transplant', 'robotic surgery', 'IVF'],
          bedCapacity: 650,
          currentOccupancy: 88,
        },
      },

      // Government Hospitals
      {
        name: 'Safdarjung Hospital',
        type: 'hospital',
        location: {
          type: 'Point',
          coordinates: [77.209, 28.5672], // Safdarjung, Delhi
        },
        address: 'Ansari Nagar West, New Delhi, Delhi 110029',
        services: [
          'emergency',
          'surgery',
          'medicine',
          'pediatrics',
          'orthopedics',
          'gynecology',
        ],
        operatingHours: {
          monday: '24/7',
          tuesday: '24/7',
          wednesday: '24/7',
          thursday: '24/7',
          friday: '24/7',
          saturday: '24/7',
          sunday: '24/7',
        },
        contactInfo: {
          phone: '+91-11-26165060',
          emergency: '+91-11-26165000',
          email: 'info@safdarjunghospital.in',
        },
        isActive: true,
        metadata: {
          availability: 'busy',
          estimatedWaitTime: 60,
          rating: 4.0,
          specializations: ['trauma care', 'emergency medicine'],
          bedCapacity: 1500,
          currentOccupancy: 95,
        },
      },
      {
        name: 'Lady Hardinge Medical College Hospital',
        type: 'hospital',
        location: {
          type: 'Point',
          coordinates: [77.2085, 28.6358], // Connaught Place area, Delhi
        },
        address: 'Shaheed Bhagat Singh Marg, New Delhi, Delhi 110001',
        services: [
          'emergency',
          'gynecology',
          'pediatrics',
          'surgery',
          'medicine',
        ],
        operatingHours: {
          monday: '24/7',
          tuesday: '24/7',
          wednesday: '24/7',
          thursday: '24/7',
          friday: '24/7',
          saturday: '24/7',
          sunday: '24/7',
        },
        contactInfo: {
          phone: '+91-11-23408120',
          emergency: '+91-11-23408100',
          email: 'info@lhmc.edu.in',
        },
        isActive: true,
        metadata: {
          availability: 'available',
          estimatedWaitTime: 40,
          rating: 3.9,
          specializations: ['maternal care', 'neonatal care'],
          bedCapacity: 800,
          currentOccupancy: 85,
        },
      },

      // Regional Hospitals
      {
        name: 'Medanta - The Medicity',
        type: 'hospital',
        location: {
          type: 'Point',
          coordinates: [77.0688, 28.4595], // Gurgaon
        },
        address: 'Sector 38, Gurugram, Haryana 122001',
        services: [
          'cardiology',
          'neurology',
          'oncology',
          'emergency',
          'surgery',
          'pediatrics',
          'orthopedics',
        ],
        operatingHours: {
          monday: '24/7',
          tuesday: '24/7',
          wednesday: '24/7',
          thursday: '24/7',
          friday: '24/7',
          saturday: '24/7',
          sunday: '24/7',
        },
        contactInfo: {
          phone: '+91-124-4141414',
          emergency: '+91-124-4141400',
          email: 'info@medanta.org',
        },
        isActive: true,
        metadata: {
          availability: 'available',
          estimatedWaitTime: 30,
          rating: 4.6,
          specializations: [
            'heart surgery',
            'liver transplant',
            'robotic surgery',
          ],
          bedCapacity: 1250,
          currentOccupancy: 80,
        },
      },
      {
        name: 'Artemis Hospital Gurgaon',
        type: 'hospital',
        location: {
          type: 'Point',
          coordinates: [77.0688, 28.4595], // Gurgaon
        },
        address: 'Sector 51, Gurugram, Haryana 122001',
        services: [
          'cardiology',
          'neurology',
          'oncology',
          'emergency',
          'orthopedics',
          'gastroenterology',
        ],
        operatingHours: {
          monday: '24/7',
          tuesday: '24/7',
          wednesday: '24/7',
          thursday: '24/7',
          friday: '24/7',
          saturday: '24/7',
          sunday: '24/7',
        },
        contactInfo: {
          phone: '+91-124-4511111',
          emergency: '+91-124-4511100',
          email: 'info@artemishospitals.com',
        },
        isActive: true,
        metadata: {
          availability: 'available',
          estimatedWaitTime: 25,
          rating: 4.5,
          specializations: [
            'cancer treatment',
            'spine surgery',
            'joint replacement',
          ],
          bedCapacity: 600,
          currentOccupancy: 75,
        },
      },
    ];

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const facilityData of facilities) {
      try {
        const existingFacility = await this.healthcareFacilityModel.findOne({
          name: facilityData.name,
          'location.coordinates': facilityData.location.coordinates,
        });

        if (existingFacility) {
          // Update existing facility
          const updated = await this.healthcareFacilityModel.updateOne(
            { _id: existingFacility._id },
            { $set: facilityData },
          );

          if (updated.modifiedCount > 0) {
            updatedCount++;
            this.logger.log(
              `Updated healthcare facility: ${facilityData.name}`,
            );
          } else {
            skippedCount++;
          }
        } else {
          // Create new facility
          await this.healthcareFacilityModel.create(facilityData);
          createdCount++;
          this.logger.log(`Created healthcare facility: ${facilityData.name}`);
        }
      } catch (error) {
        this.logger.error(
          `Error seeding healthcare facility ${facilityData.name}:`,
          error,
        );
      }
    }

    this.logger.log(
      `Healthcare facilities seeding completed: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped`,
    );
    return {
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      total: facilities.length,
    };
  }

  /**
   * Seed comprehensive blood bank data
   * Requirements: 1.3 - Blood bank information with availability status
   */
  async seedBloodBanks() {
    this.logger.log('Starting blood banks seeding...');

    const bloodBanks = [
      {
        name: 'Indian Red Cross Society Blood Bank - Central Delhi',
        location: {
          type: 'Point',
          coordinates: [77.209, 28.6139], // Red Fort area, Delhi
        },
        address: 'Red Cross Bhawan, 1, Red Cross Road, New Delhi, Delhi 110001',
        bloodTypes: {
          'A+': 25,
          'A-': 8,
          'B+': 30,
          'B-': 5,
          'AB+': 12,
          'AB-': 3,
          'O+': 40,
          'O-': 10,
        },
        operatingHours: {
          monday: '9:00-17:00',
          tuesday: '9:00-17:00',
          wednesday: '9:00-17:00',
          thursday: '9:00-17:00',
          friday: '9:00-17:00',
          saturday: '9:00-13:00',
          sunday: 'Closed',
        },
        emergencyContact: '+91-11-23711551',
        contactInfo: {
          phone: '+91-11-23711551',
          emergency: '+91-11-23711552',
          email: 'bloodbank@indianredcross.org',
        },
        isActive: true,
        metadata: {
          lastUpdated: new Date(),
          donorsToday: 15,
          totalDonations: 2500,
          urgentNeed: ['O-', 'AB-'],
        },
      },
      {
        name: 'Rotary Blood Bank Delhi',
        location: {
          type: 'Point',
          coordinates: [77.2245, 28.6358], // Karol Bagh, Delhi
        },
        address:
          'Rotary Sadan, 94, Institutional Area, Sector 1, R.K. Puram, New Delhi, Delhi 110022',
        bloodTypes: {
          'A+': 18,
          'A-': 6,
          'B+': 22,
          'B-': 4,
          'AB+': 8,
          'AB-': 2,
          'O+': 35,
          'O-': 7,
        },
        operatingHours: {
          monday: '8:00-18:00',
          tuesday: '8:00-18:00',
          wednesday: '8:00-18:00',
          thursday: '8:00-18:00',
          friday: '8:00-18:00',
          saturday: '8:00-14:00',
          sunday: 'Emergency only',
        },
        emergencyContact: '+91-11-26172431',
        contactInfo: {
          phone: '+91-11-26172431',
          emergency: '+91-11-26172432',
          email: 'bloodbank@rotarydelhi.org',
        },
        isActive: true,
        metadata: {
          lastUpdated: new Date(),
          donorsToday: 12,
          totalDonations: 1800,
          urgentNeed: ['B-', 'AB-'],
        },
      },
      {
        name: 'AIIMS Blood Bank',
        location: {
          type: 'Point',
          coordinates: [77.209, 28.5672], // AIIMS Delhi
        },
        address:
          'All India Institute of Medical Sciences, Ansari Nagar, New Delhi, Delhi 110029',
        bloodTypes: {
          'A+': 45,
          'A-': 15,
          'B+': 50,
          'B-': 12,
          'AB+': 20,
          'AB-': 8,
          'O+': 60,
          'O-': 18,
        },
        operatingHours: {
          monday: '24/7',
          tuesday: '24/7',
          wednesday: '24/7',
          thursday: '24/7',
          friday: '24/7',
          saturday: '24/7',
          sunday: '24/7',
        },
        emergencyContact: '+91-11-26588700',
        contactInfo: {
          phone: '+91-11-26588500',
          emergency: '+91-11-26588700',
          email: 'bloodbank@aiims.edu',
        },
        isActive: true,
        metadata: {
          lastUpdated: new Date(),
          donorsToday: 25,
          totalDonations: 5000,
          urgentNeed: [],
        },
      },
      {
        name: 'Lions Blood Bank Gurgaon',
        location: {
          type: 'Point',
          coordinates: [77.0688, 28.4595], // Gurgaon
        },
        address: 'Sector 14, Gurugram, Haryana 122001',
        bloodTypes: {
          'A+': 20,
          'A-': 5,
          'B+': 25,
          'B-': 3,
          'AB+': 10,
          'AB-': 2,
          'O+': 30,
          'O-': 5,
        },
        operatingHours: {
          monday: '9:00-17:00',
          tuesday: '9:00-17:00',
          wednesday: '9:00-17:00',
          thursday: '9:00-17:00',
          friday: '9:00-17:00',
          saturday: '9:00-13:00',
          sunday: 'Emergency only',
        },
        emergencyContact: '+91-124-2345678',
        contactInfo: {
          phone: '+91-124-2345678',
          emergency: '+91-124-2345679',
          email: 'bloodbank@lionsgurgaon.org',
        },
        isActive: true,
        metadata: {
          lastUpdated: new Date(),
          donorsToday: 8,
          totalDonations: 1200,
          urgentNeed: ['A-', 'O-'],
        },
      },
    ];

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const bloodBankData of bloodBanks) {
      try {
        const existingBloodBank = await this.bloodBankModel.findOne({
          name: bloodBankData.name,
          'location.coordinates': bloodBankData.location.coordinates,
        });

        if (existingBloodBank) {
          // Update existing blood bank
          const updated = await this.bloodBankModel.updateOne(
            { _id: existingBloodBank._id },
            { $set: bloodBankData },
          );

          if (updated.modifiedCount > 0) {
            updatedCount++;
            this.logger.log(`Updated blood bank: ${bloodBankData.name}`);
          } else {
            skippedCount++;
          }
        } else {
          // Create new blood bank
          await this.bloodBankModel.create(bloodBankData);
          createdCount++;
          this.logger.log(`Created blood bank: ${bloodBankData.name}`);
        }
      } catch (error) {
        this.logger.error(
          `Error seeding blood bank ${bloodBankData.name}:`,
          error,
        );
      }
    }

    this.logger.log(
      `Blood banks seeding completed: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped`,
    );
    return {
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      total: bloodBanks.length,
    };
  }

  /**
   * Seed comprehensive ambulance provider data
   * Requirements: 1.2 - Ambulance services with response times
   */
  async seedAmbulanceProviders() {
    this.logger.log('Starting ambulance providers seeding...');

    const ambulanceProviders = [
      {
        name: '108 Emergency Ambulance Service - Central Delhi',
        location: {
          type: 'Point',
          coordinates: [77.209, 28.6139], // Central Delhi
        },
        responseTime: 8,
        vehicleType: 'advanced',
        availability: true,
        contactNumber: '108',
        services: [
          'emergency',
          'critical care',
          'patient transport',
          'trauma care',
        ],
        contactInfo: {
          phone: '108',
          emergency: '108',
          email: 'info@108ambulance.com',
        },
        operatingHours: {
          monday: '24/7',
          tuesday: '24/7',
          wednesday: '24/7',
          thursday: '24/7',
          friday: '24/7',
          saturday: '24/7',
          sunday: '24/7',
        },
        isActive: true,
        metadata: {
          vehicleCount: 50,
          averageResponseTime: 8,
          successfulRescues: 15000,
          coverage: 'Delhi NCR',
        },
      },
      {
        name: 'Ziqitza Healthcare Ambulance - Gurgaon',
        location: {
          type: 'Point',
          coordinates: [77.0688, 28.4595], // Gurgaon
        },
        responseTime: 12,
        vehicleType: 'critical',
        availability: true,
        contactNumber: '+91-124-4567890',
        services: [
          'emergency',
          'critical care',
          'ICU transport',
          'neonatal care',
          'cardiac care',
        ],
        contactInfo: {
          phone: '+91-124-4567890',
          emergency: '+91-124-4567891',
          email: 'emergency@zhl.org.in',
        },
        operatingHours: {
          monday: '24/7',
          tuesday: '24/7',
          wednesday: '24/7',
          thursday: '24/7',
          friday: '24/7',
          saturday: '24/7',
          sunday: '24/7',
        },
        isActive: true,
        metadata: {
          vehicleCount: 25,
          averageResponseTime: 12,
          successfulRescues: 8000,
          coverage: 'Gurgaon, Faridabad',
        },
      },
      {
        name: 'MedCab Ambulance Service - South Delhi',
        location: {
          type: 'Point',
          coordinates: [77.2167, 28.5355], // South Delhi
        },
        responseTime: 15,
        vehicleType: 'basic',
        availability: true,
        contactNumber: '+91-11-98765432',
        services: [
          'emergency',
          'patient transport',
          'medical escort',
          'inter-hospital transfer',
        ],
        contactInfo: {
          phone: '+91-11-98765432',
          emergency: '+91-11-98765433',
          email: 'info@medcab.in',
        },
        operatingHours: {
          monday: '24/7',
          tuesday: '24/7',
          wednesday: '24/7',
          thursday: '24/7',
          friday: '24/7',
          saturday: '24/7',
          sunday: '24/7',
        },
        isActive: true,
        metadata: {
          vehicleCount: 15,
          averageResponseTime: 15,
          successfulRescues: 5000,
          coverage: 'South Delhi, Noida',
        },
      },
      {
        name: 'Red Cross Ambulance Service',
        location: {
          type: 'Point',
          coordinates: [77.209, 28.6139], // Central Delhi
        },
        responseTime: 10,
        vehicleType: 'advanced',
        availability: true,
        contactNumber: '+91-11-23711551',
        services: [
          'emergency',
          'disaster response',
          'patient transport',
          'blood transport',
        ],
        contactInfo: {
          phone: '+91-11-23711551',
          emergency: '+91-11-23711552',
          email: 'ambulance@indianredcross.org',
        },
        operatingHours: {
          monday: '24/7',
          tuesday: '24/7',
          wednesday: '24/7',
          thursday: '24/7',
          friday: '24/7',
          saturday: '24/7',
          sunday: '24/7',
        },
        isActive: true,
        metadata: {
          vehicleCount: 20,
          averageResponseTime: 10,
          successfulRescues: 12000,
          coverage: 'Delhi NCR',
        },
      },
      {
        name: 'Apollo Emergency Services',
        location: {
          type: 'Point',
          coordinates: [77.2773, 28.5562], // Apollo Hospital area
        },
        responseTime: 12,
        vehicleType: 'critical',
        availability: true,
        contactNumber: '+91-11-26925800',
        services: [
          'emergency',
          'critical care',
          'cardiac emergency',
          'stroke care',
        ],
        contactInfo: {
          phone: '+91-11-26925858',
          emergency: '+91-11-26925800',
          email: 'emergency@apollohospitals.com',
        },
        operatingHours: {
          monday: '24/7',
          tuesday: '24/7',
          wednesday: '24/7',
          thursday: '24/7',
          friday: '24/7',
          saturday: '24/7',
          sunday: '24/7',
        },
        isActive: true,
        metadata: {
          vehicleCount: 18,
          averageResponseTime: 12,
          successfulRescues: 9000,
          coverage: 'Delhi, Noida',
        },
      },
    ];

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const providerData of ambulanceProviders) {
      try {
        const existingProvider = await this.ambulanceProviderModel.findOne({
          name: providerData.name,
          'location.coordinates': providerData.location.coordinates,
        });

        if (existingProvider) {
          // Update existing provider
          const updated = await this.ambulanceProviderModel.updateOne(
            { _id: existingProvider._id },
            { $set: providerData },
          );

          if (updated.modifiedCount > 0) {
            updatedCount++;
            this.logger.log(`Updated ambulance provider: ${providerData.name}`);
          } else {
            skippedCount++;
          }
        } else {
          // Create new provider
          await this.ambulanceProviderModel.create(providerData);
          createdCount++;
          this.logger.log(`Created ambulance provider: ${providerData.name}`);
        }
      } catch (error) {
        this.logger.error(
          `Error seeding ambulance provider ${providerData.name}:`,
          error,
        );
      }
    }

    this.logger.log(
      `Ambulance providers seeding completed: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped`,
    );
    return {
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      total: ambulanceProviders.length,
    };
  }

  /**
   * Seed all healthcare facility data
   */
  async seedAll() {
    this.logger.log('Starting complete healthcare facility seeding...');

    try {
      const facilitiesResult = await this.seedHealthcareFacilities();
      const bloodBanksResult = await this.seedBloodBanks();
      const ambulanceResult = await this.seedAmbulanceProviders();

      this.logger.log('Healthcare facility seeding completed successfully');
      return {
        facilities: facilitiesResult,
        bloodBanks: bloodBanksResult,
        ambulanceProviders: ambulanceResult,
      };
    } catch (error) {
      this.logger.error('Healthcare facility seeding failed:', error);
      throw error;
    }
  }
}
