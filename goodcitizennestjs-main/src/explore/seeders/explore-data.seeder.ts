import { Injectable } from '@nestjs/common';
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
export class ExploreDataSeeder {
  constructor(
    @InjectModel(HealthcareFacility.name)
    private healthcareFacilityModel: Model<HealthcareFacilityDocument>,
    @InjectModel(BloodBank.name)
    private bloodBankModel: Model<BloodBankDocument>,
    @InjectModel(AmbulanceProvider.name)
    private ambulanceProviderModel: Model<AmbulanceProviderDocument>,
  ) {}

  async seedHealthcareFacilities() {
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
    ];

    // Clear existing data and insert new data
    await this.healthcareFacilityModel.deleteMany({});
    await this.healthcareFacilityModel.insertMany(facilities);
    
    // Ensure geospatial indexes are created
    await this.healthcareFacilityModel.collection.createIndex({ location: '2dsphere' });
    await this.healthcareFacilityModel.collection.createIndex({ type: 1, isActive: 1 });
    await this.healthcareFacilityModel.collection.createIndex({ services: 1 });
    
    console.log(`✅ Seeded ${facilities.length} healthcare facilities with geospatial indexing`);
  }

  async seedBloodBanks() {
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

    await this.bloodBankModel.deleteMany({});
    await this.bloodBankModel.insertMany(bloodBanks);
    
    // Ensure geospatial indexes are created
    await this.bloodBankModel.collection.createIndex({ location: '2dsphere' });
    await this.bloodBankModel.collection.createIndex({ isActive: 1 });
    // Create compound indexes for blood type availability queries
    await this.bloodBankModel.collection.createIndex({ 'bloodTypes.A+': 1 });
    await this.bloodBankModel.collection.createIndex({ 'bloodTypes.A-': 1 });
    await this.bloodBankModel.collection.createIndex({ 'bloodTypes.B+': 1 });
    await this.bloodBankModel.collection.createIndex({ 'bloodTypes.B-': 1 });
    await this.bloodBankModel.collection.createIndex({ 'bloodTypes.AB+': 1 });
    await this.bloodBankModel.collection.createIndex({ 'bloodTypes.AB-': 1 });
    await this.bloodBankModel.collection.createIndex({ 'bloodTypes.O+': 1 });
    await this.bloodBankModel.collection.createIndex({ 'bloodTypes.O-': 1 });
    
    console.log(`✅ Seeded ${bloodBanks.length} blood banks with geospatial indexing and blood type indexes`);
  }

  async seedAmbulanceProviders() {
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

    await this.ambulanceProviderModel.deleteMany({});
    await this.ambulanceProviderModel.insertMany(ambulanceProviders);
    
    // Ensure geospatial indexes are created
    await this.ambulanceProviderModel.collection.createIndex({ location: '2dsphere' });
    await this.ambulanceProviderModel.collection.createIndex({ isActive: 1, availability: 1 });
    await this.ambulanceProviderModel.collection.createIndex({ vehicleType: 1 });
    await this.ambulanceProviderModel.collection.createIndex({ responseTime: 1 });
    
    console.log(`✅ Seeded ${ambulanceProviders.length} ambulance providers with geospatial indexing`);
  }

  async seedAll() {
    try {
      await this.seedHealthcareFacilities();
      await this.seedBloodBanks();
      await this.seedAmbulanceProviders();
      console.log('✅ All emergency services data seeded successfully with geospatial indexing');
    } catch (error) {
      console.error('Error seeding explore data:', error);
      throw error;
    }
  }
}
