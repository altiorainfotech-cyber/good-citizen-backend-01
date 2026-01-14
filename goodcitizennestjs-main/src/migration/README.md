# Data Migration and Legacy Support

This module provides comprehensive data migration and backward compatibility features for the ride-hailing backend system. It enables seamless transition from legacy prototype systems to the production-ready platform while maintaining compatibility with existing mobile applications.

## Features

### Data Migration
- **User Data Migration**: Migrate user accounts, preferences, and profile information
- **Ride History Migration**: Preserve complete ride history with proper data mapping
- **Geospatial Index Creation**: Set up MongoDB geospatial indexes for location-based queries
- **Location Data Migration**: Convert legacy location formats to GeoJSON standard

### Backward Compatibility
- **API Versioning**: Support multiple API versions with automatic response transformation
- **Session Compatibility**: Handle existing user sessions gracefully during system upgrades
- **Enum Mapping**: Map legacy enum values to new formats (ride status, vehicle types, etc.)
- **Legacy Response Formats**: Transform modern API responses to legacy formats for older clients

## Usage

### Running Migrations

#### Using the CLI Script
```bash
# Run complete migration with data files
cd src/migration/scripts
ts-node run-migration.ts --users ./legacy-users.json --rides ./legacy-rides.json

# Run only specific migrations
ts-node run-migration.ts --skip-users --skip-rides  # Only indexes and location migration
ts-node run-migration.ts --users ./users.json --skip-rides --skip-indexes --skip-location

# Validate existing migration
ts-node run-migration.ts --validate-only
```

#### Using the API Endpoints
```typescript
// Migrate user data
POST /migration/users
{
  "users": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      // ... other user fields
    }
  ]
}

// Migrate ride history
POST /migration/rides
{
  "rides": [
    {
      "_id": "507f1f77bcf86cd799439021",
      "user_id": "507f1f77bcf86cd799439011",
      "pickup_location": { "latitude": 37.7749, "longitude": -122.4194 },
      // ... other ride fields
    }
  ]
}

// Create geospatial indexes
POST /migration/indexes

// Migrate location data format
POST /migration/location-data

// Run all migrations
POST /migration/all
{
  "users": [...],
  "rides": [...]
}

// Validate migration
GET /migration/validate
```

### API Versioning

#### Client-Side Version Specification
Clients can specify API version using:
- Header: `X-API-Version: 1.0` or `API-Version: 1.0`
- Query parameter: `?version=1.0` or `?api_version=1.0`
- URL path: `/api/v1/users` (automatically detected)

#### Supported Versions
- `legacy` or `0.9`: Original prototype format
- `1.0`: First production version
- `2.0`: Current version with Auth0 and enhanced features

#### Version-Specific Transformations
```typescript
// Legacy format (v0.9, legacy)
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "verified": true
  },
  "token": "jwt_token_here",
  "session": "session_id_here"
}

// Modern format (v2.0)
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "is_email_verified": true,
    "auth_provider": "auth0"
  },
  "access_token": "jwt_token_here",
  "session_id": "session_id_here",
  "auth_provider": "auth0"
}
```

### Enum Mapping

#### Automatic Enum Conversion
The system automatically maps between legacy and new enum values:

```typescript
// Ride Status Mapping
'PENDING' ↔ 'REQUESTED'
'ACCEPTED' ↔ 'DRIVER_ASSIGNED'
'STARTED' ↔ 'IN_PROGRESS'

// Vehicle Type Mapping
'AMBULANCE' ↔ 'EMERGENCY'
'CAR' ↔ 'REGULAR'

// User Role Mapping
'CUSTOMER' ↔ 'USER'
'AMBULANCE_DRIVER' ↔ 'DRIVER'
```

#### Manual Enum Mapping
```typescript
// Map individual values
POST /legacy/enums/map
{
  "enumType": "ride_status",
  "values": ["PENDING", "ACCEPTED"],
  "toLegacy": false
}

// Response
{
  "enumType": "ride_status",
  "originalValues": ["PENDING", "ACCEPTED"],
  "mappedValues": ["REQUESTED", "DRIVER_ASSIGNED"],
  "toLegacy": false
}
```

### Session Compatibility

#### Legacy Session Migration
```typescript
POST /legacy/sessions/migrate
{
  "sessions": [
    {
      "user_id": "507f1f77bcf86cd799439011",
      "token": "legacy_jwt_token",
      "device_type": "MOBILE",
      "fcm_token": "fcm_token_here",
      "created_at": 1640995200000
    }
  ]
}
```

#### Session Validation
```typescript
GET /legacy/sessions/validate/jwt_token_here

// Response
{
  "valid": true,
  "user": { /* user object */ },
  "needsRefresh": false
}
```

## Data Formats

### Legacy User Data Format
```typescript
interface LegacyUserData {
  _id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  country_code?: string;
  password?: string; // Should be pre-hashed
  role?: string;
  latitude?: number;
  longitude?: number;
  is_online?: boolean;
  is_email_verified?: boolean;
  loyalty_point?: number;
  created_at?: number;
  updated_at?: number;
  // Driver-specific fields
  vehicle_type?: string;
  vehicle_plate?: string;
  approval?: string;
  driver_rating?: number;
  total_rides?: number;
}
```

### Legacy Ride Data Format
```typescript
interface LegacyRideData {
  _id?: string;
  user_id?: string;
  driver_id?: string;
  pickup_location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  destination_location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  status?: string;
  vehicle_type?: string;
  estimated_fare?: number;
  final_fare?: number;
  requested_at?: Date;
  completed_at?: Date;
  created_at?: Date;
}
```

## Migration Process

### Step-by-Step Migration
1. **Backup existing data** before starting migration
2. **Create geospatial indexes** for location-based queries
3. **Migrate location data** to GeoJSON format
4. **Migrate user data** with proper validation
5. **Migrate ride history** with user reference validation
6. **Validate migration** to ensure data integrity
7. **Test API compatibility** with different client versions

### Validation Checks
The migration system performs comprehensive validation:
- **Location Data**: Ensures all users have valid GeoJSON location data
- **User References**: Verifies all rides reference existing users
- **Duplicate Detection**: Identifies duplicate user records
- **Data Integrity**: Validates required fields and relationships

### Error Handling
- **Graceful Failures**: Individual record failures don't stop the entire migration
- **Detailed Logging**: Comprehensive error reporting with specific failure reasons
- **Rollback Support**: Ability to identify and fix migration issues
- **Progress Tracking**: Real-time migration progress and statistics

## Configuration

### Environment Variables
```bash
# Database connection
DATABASE_URL=mongodb://localhost:27017/ride-hailing

# JWT configuration
JWT_SECRET=your_jwt_secret_here
JWT_ACCESS_EXPIRY=1d

# Migration settings
MIGRATION_BATCH_SIZE=100
MIGRATION_TIMEOUT=300000
```

### Migration Settings
```typescript
// In migration service
const MIGRATION_CONFIG = {
  batchSize: 100,
  maxRetries: 3,
  timeoutMs: 300000,
  validateCoordinates: true,
  preserveTimestamps: true,
};
```

## Monitoring and Logging

### Migration Metrics
- **Migration Progress**: Real-time progress tracking
- **Success/Failure Rates**: Statistics on migration success
- **Performance Metrics**: Migration speed and resource usage
- **Error Analysis**: Detailed error categorization and reporting

### API Version Usage
- **Version Distribution**: Track which API versions are being used
- **Deprecation Warnings**: Alert clients about deprecated versions
- **Migration Recommendations**: Suggest version upgrades to clients

## Best Practices

### Before Migration
1. **Backup all data** before starting migration
2. **Test migration** on a copy of production data
3. **Validate data formats** and fix any inconsistencies
4. **Plan downtime** if required for migration

### During Migration
1. **Monitor progress** and resource usage
2. **Handle errors gracefully** without stopping the process
3. **Log all activities** for audit and debugging
4. **Validate data integrity** at each step

### After Migration
1. **Run validation checks** to ensure data integrity
2. **Test API compatibility** with all client versions
3. **Monitor system performance** and error rates
4. **Plan deprecation timeline** for legacy versions

## Troubleshooting

### Common Issues
1. **Invalid Coordinates**: Check latitude/longitude bounds (-90 to 90, -180 to 180)
2. **Missing User References**: Ensure all referenced users exist before migrating rides
3. **Duplicate Users**: Handle duplicate email/phone combinations
4. **Session Validation**: Verify JWT tokens are properly formatted

### Recovery Procedures
1. **Partial Migration Failure**: Re-run migration with `--skip-*` flags for completed steps
2. **Data Corruption**: Restore from backup and fix data issues before re-migration
3. **Performance Issues**: Adjust batch sizes and timeout settings
4. **Version Compatibility**: Update client applications to use supported API versions

## Security Considerations

### Data Protection
- **Password Hashing**: Ensure passwords are properly hashed before migration
- **Sensitive Data**: Encrypt sensitive information during migration
- **Access Control**: Restrict migration endpoints to admin users only
- **Audit Logging**: Log all migration activities for security audit

### API Security
- **Version Validation**: Validate API version requests
- **Backward Compatibility**: Ensure legacy versions don't expose new sensitive data
- **Session Security**: Properly validate and migrate user sessions
- **Token Management**: Handle JWT token validation and refresh properly