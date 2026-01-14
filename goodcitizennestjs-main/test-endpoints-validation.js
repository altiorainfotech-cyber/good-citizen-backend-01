const axios = require('axios');

// Simple endpoint validation script
const BASE_URL = 'http://localhost:3000';

const endpoints = [
  // Explore endpoints
  { method: 'GET', path: '/v1/explore/hospitals', requiresAuth: true },
  { method: 'GET', path: '/v1/explore/ambulances', requiresAuth: true },
  { method: 'GET', path: '/v1/explore/blood-banks', requiresAuth: true },
  { method: 'GET', path: '/v1/explore/emergency-services', requiresAuth: true },
  { method: 'GET', path: '/v1/explore/health-tips', requiresAuth: true },
  { method: 'GET', path: '/v1/explore/community-stats', requiresAuth: true },
  
  // Enhanced rewards endpoints
  { method: 'GET', path: '/v1/rewards/history', requiresAuth: true },
  { method: 'GET', path: '/v1/rewards/achievements', requiresAuth: true },
  { method: 'GET', path: '/v1/users/test-id/ambulance-assists', requiresAuth: true },
  
  // Detail endpoints
  { method: 'GET', path: '/v1/assists/test-id/route', requiresAuth: true },
  { method: 'GET', path: '/v1/stations/test-id', requiresAuth: true },
  { method: 'GET', path: '/v1/hospitals/test-id', requiresAuth: true },
  { method: 'GET', path: '/v1/payments/methods', requiresAuth: true },
  
  // Emergency services
  { method: 'GET', path: '/v1/explore/emergency-contacts', requiresAuth: true },
  { method: 'GET', path: '/v1/explore/ambulance-availability', requiresAuth: true },
  
  // Public endpoints for comparison
  { method: 'GET', path: '/health', requiresAuth: false },
  { method: 'GET', path: '/api-docs', requiresAuth: false }
];

async function validateEndpoints() {
  console.log('🔍 Validating Backend API Endpoints...\n');
  
  let availableCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;
  
  for (const endpoint of endpoints) {
    try {
      const config = {
        method: endpoint.method.toLowerCase(),
        url: `${BASE_URL}${endpoint.path}`,
        timeout: 5000,
        validateStatus: function (status) {
          // Accept any status code to check if endpoint exists
          return status < 500;
        }
      };
      
      // Add dummy auth header for protected endpoints
      if (endpoint.requiresAuth) {
        config.headers = {
          'Authorization': 'Bearer dummy-token'
        };
      }
      
      const response = await axios(config);
      
      if (response.status === 404) {
        console.log(`❌ ${endpoint.method} ${endpoint.path} - NOT FOUND (404)`);
        notFoundCount++;
      } else if (response.status === 401 && endpoint.requiresAuth) {
        console.log(`✅ ${endpoint.method} ${endpoint.path} - AVAILABLE (401 - Auth Required)`);
        availableCount++;
      } else if (response.status === 200) {
        console.log(`✅ ${endpoint.method} ${endpoint.path} - AVAILABLE (200)`);
        availableCount++;
      } else {
        console.log(`⚠️  ${endpoint.method} ${endpoint.path} - AVAILABLE (${response.status})`);
        availableCount++;
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`🔌 ${endpoint.method} ${endpoint.path} - SERVER NOT RUNNING`);
        errorCount++;
      } else if (error.response && error.response.status === 404) {
        console.log(`❌ ${endpoint.method} ${endpoint.path} - NOT FOUND (404)`);
        notFoundCount++;
      } else {
        console.log(`❌ ${endpoint.method} ${endpoint.path} - ERROR: ${error.message}`);
        errorCount++;
      }
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`✅ Available endpoints: ${availableCount}`);
  console.log(`❌ Not found endpoints: ${notFoundCount}`);
  console.log(`🔌 Connection/Other errors: ${errorCount}`);
  console.log(`📈 Total endpoints checked: ${endpoints.length}`);
  
  if (notFoundCount === 0 && errorCount === 0) {
    console.log('\n🎉 All endpoints are available!');
    return true;
  } else if (errorCount > 0) {
    console.log('\n⚠️  Some endpoints had connection errors. Make sure the server is running.');
    return false;
  } else {
    console.log('\n❌ Some endpoints are missing and need to be implemented.');
    return false;
  }
}

// Run validation
validateEndpoints()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });