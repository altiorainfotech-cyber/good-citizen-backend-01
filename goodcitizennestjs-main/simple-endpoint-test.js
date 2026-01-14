const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001';

async function testEndpointStructure() {
  const tests = [
    // Test health endpoint (no auth required)
    {
      name: 'Health Check',
      method: 'GET',
      url: `${API_BASE_URL}/v1/monitoring/health`,
      requiresAuth: false
    },
    // Test explore endpoints (should return 401 without auth)
    {
      name: 'Get Hospitals (No Auth)',
      method: 'GET',
      url: `${API_BASE_URL}/v1/explore/hospitals`,
      requiresAuth: true,
      expectedStatus: 401
    },
    {
      name: 'Get Ambulances (No Auth)',
      method: 'GET',
      url: `${API_BASE_URL}/v1/explore/ambulances`,
      requiresAuth: true,
      expectedStatus: 401
    },
    {
      name: 'Get Blood Banks (No Auth)',
      method: 'GET',
      url: `${API_BASE_URL}/v1/explore/blood-banks`,
      requiresAuth: true,
      expectedStatus: 401
    },
    {
      name: 'Get Emergency Services (No Auth)',
      method: 'GET',
      url: `${API_BASE_URL}/v1/explore/emergency-services`,
      requiresAuth: true,
      expectedStatus: 401
    },
    {
      name: 'Get Health Tips (No Auth)',
      method: 'GET',
      url: `${API_BASE_URL}/v1/explore/health-tips`,
      requiresAuth: true,
      expectedStatus: 401
    },
    {
      name: 'Get Community Stats (No Auth)',
      method: 'GET',
      url: `${API_BASE_URL}/v1/explore/community-stats`,
      requiresAuth: true,
      expectedStatus: 401
    },
    // Test detail endpoints
    {
      name: 'Get Payment Methods (No Auth)',
      method: 'GET',
      url: `${API_BASE_URL}/v1/payments/methods`,
      requiresAuth: true,
      expectedStatus: 401
    },
    // Test rewards endpoints
    {
      name: 'Get Rewards History (No Auth)',
      method: 'GET',
      url: `${API_BASE_URL}/v1/rewards/history?userId=test`,
      requiresAuth: true,
      expectedStatus: 401
    },
    {
      name: 'Get Achievements (No Auth)',
      method: 'GET',
      url: `${API_BASE_URL}/v1/rewards/achievements?userId=test`,
      requiresAuth: true,
      expectedStatus: 401
    },
    {
      name: 'Get Ambulance Assists (No Auth)',
      method: 'GET',
      url: `${API_BASE_URL}/v1/users/test/ambulance-assists`,
      requiresAuth: true,
      expectedStatus: 401
    }
  ];

  console.log('=== Testing Endpoint Structure and Authentication ===\n');

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      
      const response = await axios({
        method: test.method,
        url: test.url,
        validateStatus: () => true // Don't throw on non-2xx status codes
      });
      
      if (test.requiresAuth && test.expectedStatus === 401) {
        if (response.status === 401) {
          console.log(`✅ ${test.name}: Correctly returned 401 Unauthorized`);
          passedTests++;
        } else {
          console.log(`❌ ${test.name}: Expected 401, got ${response.status}`);
        }
      } else if (!test.requiresAuth) {
        if (response.status >= 200 && response.status < 300) {
          console.log(`✅ ${test.name}: Status ${response.status} - OK`);
          passedTests++;
        } else {
          console.log(`❌ ${test.name}: Status ${response.status} - Expected 2xx`);
        }
      }
      
    } catch (error) {
      console.log(`❌ ${test.name}: Network error - ${error.message}`);
    }
    console.log('');
  }

  console.log(`\n=== Test Summary ===`);
  console.log(`Passed: ${passedTests}/${totalTests}`);
  console.log(`Success Rate: ${((passedTests/totalTests) * 100).toFixed(1)}%`);

  return passedTests === totalTests;
}

async function testDatabaseConnection() {
  try {
    console.log('=== Testing Database Connection ===\n');
    
    const response = await axios.get(`${API_BASE_URL}/v1/monitoring/health`);
    
    if (response.data && response.data.checks && response.data.checks.database) {
      const dbStatus = response.data.checks.database.status;
      console.log(`Database Status: ${dbStatus}`);
      
      if (dbStatus === 'healthy') {
        console.log('✅ Database connection is healthy');
        return true;
      } else {
        console.log('❌ Database connection is not healthy');
        return false;
      }
    } else {
      console.log('❌ Could not determine database status');
      return false;
    }
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('Backend API Endpoints - Core Functionality Test\n');
  
  // Test database connection
  const dbHealthy = await testDatabaseConnection();
  console.log('');
  
  // Test endpoint structure
  const endpointsWorking = await testEndpointStructure();
  
  console.log('\n=== Final Results ===');
  console.log(`Database Connection: ${dbHealthy ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Endpoint Structure: ${endpointsWorking ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Authentication Integration: ${endpointsWorking ? '✅ PASS' : '❌ FAIL'}`);
  
  if (dbHealthy && endpointsWorking) {
    console.log('\n🎉 All core functionality tests PASSED!');
    console.log('✅ New endpoints return proper responses');
    console.log('✅ Database connections verified');
    console.log('✅ Authentication integration working');
  } else {
    console.log('\n❌ Some tests FAILED. Please review the results above.');
  }
}

main().catch(console.error);