# Database Seeding Guide

This guide explains how to seed the database with sample data for the Good Citizen ride-hailing platform backend.

## Overview

The seeding system provides comprehensive sample data for:
- **Healthcare Facilities**: Hospitals, clinics, and medical centers with location data
- **Blood Banks**: Blood donation centers with availability information
- **Ambulance Providers**: Emergency ambulance services with response times
- **Achievement Definitions**: User achievement system with badges and milestones
- **Payment Methods**: Payment processing configurations for the platform

## Requirements Addressed

This seeding system addresses the following requirements:
- **1.1, 1.2, 1.3**: Healthcare facility seeder with sample data for location-based discovery
- **2.2**: Achievement definitions seeder for user rewards and milestone tracking
- **3.4**: Payment method configuration seeder for payment processing capabilities
- **Geospatial indexes**: Set up for efficient location-based queries

## Quick Start

### Using NPM Scripts

```bash
# Seed complete database (recommended for new installations)
npm run seed:database

# Seed only healthcare facilities
npm run seed:healthcare

# Seed only achievements
npm run seed:achievements

# Seed only payment methods
npm run seed:payment-methods

# Validate database state
npm run validate:database
```

### Using CLI Scripts Directly

```bash
# Complete database seeding
cd src/migration/scripts
ts-node seed-database.ts

# Skip specific components
ts-node seed-database.ts --skip-achievements --skip-payment-methods

# Validate only (no seeding)
ts-node seed-database.ts --validate-only
```

### Using API Endpoints

The seeding can also be triggered via REST API endpoints (requires admin authentication):

```bash
# Seed all data
POST /migration/seed/all

# Seed healthcare facilities
POST /migration/seed/healthcare-facilities

# Seed achievements
POST /migration/seed/achievements

# Seed payment methods
POST /migration/seed/payment-methods

# Create geospatial indexes
POST /migration/indexes
```

## Seeded Data Details

### Healthcare Facilities

**Hospitals** (10 major hospitals in Delhi NCR):
- AIIMS Delhi - Premier medical institute with comprehensive services
- Fortis Hospital Gurgaon - Multi-specialty hospital with advanced care
- Max Super Speciality Hospital - Specialized medical services
- Apollo Hospital Delhi - Full-service hospital with emergency care
- Medanta - The Medicity - Advanced medical facility
- And 5 more major hospitals

**Blood Banks** (4 major blood banks):
- Indian Red Cross Society Blood Bank - Central Delhi location
- Rotary Blood Bank Delhi - Community blood donation center
- AIIMS Blood Bank - Hospital-based blood bank
- Lions Blood Bank Gurgaon - Regional blood donation center

**Ambulance Providers** (5 emergency services):
- 108 Emergency Ambulance Service - Government emergency service
- Ziqitza Healthcare Ambulance - Private emergency provider
- MedCab Ambulance Service - Patient transport service
- Red Cross Ambulance Service - Disaster response ambulance
- Apollo Emergency Services - Hospital-based emergency service

### Achievement Definitions

**15 Achievement Types** across 4 categories:

**Community Achievements**:
- First Responder - First emergency assistance
- Helping Hand - 5 emergency assists
- Community Hero - 25 emergency assists
- Guardian Angel - 100 emergency assists

**Safety Achievements**:
- Ambulance Navigator - Guided ambulance navigation
- Emergency Coordinator - Coordinated emergency responses
- Life Saver - Critical emergency assistance

**Loyalty Achievements**:
- Loyal Citizen - 30 consecutive days active
- Dedicated Helper - 7-day helping streak
- Platform Veteran - 365 consecutive days active
- Point Collector - 1000 loyalty points earned
- Point Master - 10000 loyalty points earned

**Emergency Achievements**:
- Rapid Responder - Quick emergency responses
- Night Guardian - Night-time assistance
- Medical Assistant - Medical emergency assistance

### Payment Methods

**5 Payment Options** for Indian market:
- UPI (Unified Payments Interface) - Instant digital payments
- Credit/Debit Card - Secure card payments with 2.5% processing fee
- Digital Wallet - Paytm, PhonePe, etc. with 1.5% processing fee
- Cash Payment - Traditional cash payment option
- Net Banking - Direct bank account payments

## Geospatial Indexes

The seeding process creates the following geospatial indexes for efficient location-based queries:

### Primary Indexes
- `HealthcareFacility.location` - 2dsphere index for hospital/clinic queries
- `BloodBank.location` - 2dsphere index for blood bank proximity
- `AmbulanceProvider.location` - 2dsphere index for ambulance dispatch
- `User.location` - 2dsphere index for user location tracking

### Compound Indexes
- `User.location + role + is_online + approval` - Driver matching optimization
- `Ride.user_id + created_at` - User ride history queries
- `Achievement.category + isActive` - Achievement filtering
- `PaymentMethod.type + isEnabled` - Payment method queries

## Data Validation

The seeding system includes comprehensive validation:

### Location Data Validation
- Ensures all coordinates are within valid bounds (-90 to 90 latitude, -180 to 180 longitude)
- Validates GeoJSON format compliance
- Checks for duplicate location entries

### Data Integrity Checks
- Verifies all required fields are populated
- Validates foreign key relationships
- Checks for duplicate records
- Ensures data consistency across collections

### Achievement System Validation
- Validates achievement requirement structures
- Ensures unique achievement IDs
- Checks category and badge icon references

## Troubleshooting

### Common Issues

**Connection Errors**:
```bash
# Ensure MongoDB is running
brew services start mongodb-community
# Or check your DATABASE_URL environment variable
```

**Permission Errors**:
```bash
# Ensure you have write permissions to the database
# Check your MongoDB user permissions
```

**Duplicate Key Errors**:
```bash
# Run validation to check for existing data
npm run validate:database

# Clear existing data if needed (be careful!)
# This would require manual database cleanup
```

### Validation Failures

If validation fails, check the following:
1. **Invalid Coordinates**: Ensure latitude/longitude are within valid ranges
2. **Missing References**: Verify all foreign key relationships exist
3. **Duplicate Data**: Check for duplicate entries in collections
4. **Index Issues**: Ensure geospatial indexes are created properly

### Performance Issues

For large datasets:
1. **Batch Processing**: The seeder processes data in batches to avoid memory issues
2. **Index Creation**: Indexes are created before data insertion for better performance
3. **Connection Pooling**: Ensure proper MongoDB connection pool settings

## Development Usage

### Adding New Seed Data

To add new healthcare facilities:
1. Edit `src/explore/seeders/healthcare-facility.seeder.ts`
2. Add new facility objects to the appropriate arrays
3. Run the seeder to update the database

To add new achievements:
1. Edit `src/user/seeders/achievement.seeder.ts`
2. Add new achievement definitions
3. Run the achievement seeder

### Custom Seeding Scripts

Create custom seeding scripts by extending the base seeder classes:

```typescript
import { HealthcareFacilitySeeder } from '../explore/seeders/healthcare-facility.seeder';

class CustomSeeder extends HealthcareFacilitySeeder {
  async seedCustomData() {
    // Your custom seeding logic
  }
}
```

## Production Considerations

### Before Production Deployment
1. **Backup Existing Data**: Always backup before running seeders in production
2. **Test on Staging**: Run complete seeding process on staging environment
3. **Validate Results**: Use validation endpoints to ensure data integrity
4. **Monitor Performance**: Check database performance after seeding

### Production Seeding Strategy
1. **Incremental Updates**: Use update operations instead of full recreation
2. **Maintenance Windows**: Schedule seeding during low-traffic periods
3. **Rollback Plan**: Have a rollback strategy in case of issues
4. **Monitoring**: Monitor application performance after seeding

## API Documentation

All seeding endpoints are documented in the Swagger API documentation available at `/api` when the application is running in development mode.

### Authentication
All seeding endpoints require admin authentication:
- Include `Authorization: Bearer <jwt_token>` header
- User must have `ADMIN` role

### Response Format
All seeding endpoints return standardized responses:
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "results": {
    "created": 10,
    "updated": 5,
    "skipped": 2
  }
}
```

## Support

For issues or questions about the seeding system:
1. Check the validation output for specific error messages
2. Review the application logs for detailed error information
3. Ensure all dependencies are properly installed
4. Verify database connectivity and permissions

The seeding system is designed to be idempotent - running it multiple times should not create duplicate data or cause errors.