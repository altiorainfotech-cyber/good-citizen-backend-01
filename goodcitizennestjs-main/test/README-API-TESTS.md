# API Endpoint Integration Tests

This directory contains integration tests for the backend API endpoints added as part of the backend-frontend integration fixes.

## Test Files

### 1. backend-api-endpoints-integration.e2e-spec.ts

Comprehensive Jest-based E2E test suite that validates:

- **Emergency Services Endpoints** (Requirement 7.1, 7.2)
  - `/v1/explore/hospitals` - Geospatial filtering of hospitals
  - `/v1/explore/blood-banks` - Blood type filtering
  - `/v1/explore/ambulances` - Ambulance availability

- **Impact Tracking Endpoints** (Requirement 7.3)
  - `/v1/assists/:id/impact` - Get calculated impact metrics
  - `/v1/assists/:id/complete` - Complete assist and calculate impact
  - `/v1/users/:userId/impact-summary` - User impact aggregation
  - `/v1/community/impact-stats` - Community statistics

- **Rewards System Endpoints** (Requirement 7.4)
  - `/rewards/history/:userId` - User reward transaction history
  - `/rewards/achievements/:userId` - User achievements
  - `/rewards/track/ride-completion` - Track ride activities
  - `/rewards/track/emergency-assist` - Track emergency assists

- **Location Management Endpoints** (Requirement 7.5)
  - `/v1/location/update` - Update user location
  - `/v1/location/current` - Get current location
  - `/v1/location/history` - Location history

### 2. validate-api-endpoints.js

Standalone Node.js validation script that can be run independently of Jest. Useful for:
- Quick endpoint validation
- CI/CD pipeline checks
- Manual testing without full test suite setup

## Running the Tests

### Option 1: Jest E2E Tests (Recommended)

```bash
# Run all E2E tests
npm run test:e2e

# Run only the API endpoint integration tests
npm run test:e2e -- backend-api-endpoints-integration.e2e-spec.ts

# Run with coverage
npm run test:e2e -- --coverage
```

**Note:** If you encounter module resolution errors related to `src/` imports, this is a known issue with the Jest configuration. The validation script (Option 2) provides an alternative.

### Option 2: Standalone Validation Script

```bash
# Make sure the backend server is running first
npm run start:dev

# In another terminal, run the validation script
node test/validate-api-endpoints.js

# Or specify a different API URL
API_BASE_URL=http://localhost:3001 node test/validate-api-endpoints.js
```

## Test Coverage

The tests validate:

1. **HTTP Status Codes**
   - 200 OK for successful requests
   - 401 Unauthorized for missing authentication
   - 404 Not Found for non-existent resources
   - 400 Bad Request for invalid input

2. **Response Formats**
   - JSON response structure
   - Required fields presence
   - Data type validation
   - Array/object structure

3. **Geospatial Filtering**
   - Distance-based queries
   - Coordinate validation
   - Radius filtering
   - Sorting by proximity

4. **Blood Type Filtering**
   - Availability filtering
   - Stock level validation
   - Multiple blood type support

5. **Impact Calculation**
   - Metric calculation accuracy
   - Data persistence
   - Aggregation correctness

6. **Rewards Integration**
   - Activity tracking
   - Point calculation
   - Achievement unlocking
   - History completeness

7. **Location Management**
   - Location updates
   - Coordinate validation
   - History tracking
   - Source tracking (GPS, network, manual)

8. **Authentication & Authorization**
   - JWT token validation
   - User-specific data access
   - Unauthorized access prevention

## Test Data

The tests use:
- Dynamically created test users
- Mock coordinates (New York City area)
- Sample blood types (A+, B+, O+, AB+, A-, B-, O-, AB-)
- Test assist and ride IDs

## Troubleshooting

### Module Resolution Errors

If you see errors like `Cannot find module 'src/...'`:
1. Use the standalone validation script instead: `node test/validate-api-endpoints.js`
2. Or fix the import paths in the source files to use relative paths (`../` instead of `src/`)

### Connection Refused

If tests fail with connection errors:
1. Ensure the backend server is running: `npm run start:dev`
2. Check the correct port is being used (default: 3000)
3. Verify MongoDB is running and accessible

### Authentication Failures

If authentication tests fail:
1. Check that the Auth module is properly configured
2. Verify JWT secret is set in environment variables
3. Ensure user registration endpoint is working

## Requirements Mapping

- **Requirement 7.1**: `/v1/explore/hospitals` endpoint with geospatial filtering
- **Requirement 7.2**: `/v1/explore/blood-banks` endpoint with blood type filtering
- **Requirement 7.3**: `/v1/assists/{id}/impact` endpoint returning calculated impact metrics
- **Requirement 7.4**: `/v1/rewards/history` endpoint returning user's actual reward transactions
- **Requirement 7.5**: `/v1/location/current` endpoint returning user's last known location

## Future Enhancements

- Add performance benchmarking
- Add load testing scenarios
- Add WebSocket real-time update tests
- Add database seeding for consistent test data
- Add property-based testing for geospatial calculations
