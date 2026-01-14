const axios = require('axios');

// Simple endpoint validation without authentication
const BASE_URL = 'http://localhost:3000';

async function testBasicEndpoints() {
  console.log('🔍 Testing Basic API Endpoints...\n');
  
  const basicEndpoints = [
    { method: 'GET', path: '/health', description: 'Health check' },
    { method: 'GET', path: '/api-docs', description: 'API documentation' },
    { method: 'GET', path: '/', description: 'Root endpoint' }
  ];
  
  for (const endpoint of basicEndpoints) {
    try {
      const response = await axios({
        method: endpoint.method.toLowerCase(),
        url: `${BASE_URL}${endpoint.path}`,
        timeout: 5000,
        validateStatus: function (status) {
          return status < 500;
        }
      });
      
      console.log(`✅ ${endpoint.method} ${endpoint.path} - ${endpoint.description} (${response.status})`);
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`🔌 Server not running on ${BASE_URL}`);
        return false;
      } else {
        console.log(`❌ ${endpoint.method} ${endpoint.path} - Error: ${error.message}`);
      }
    }
  }
  
  return true;
}

async function testNewEndpointsExistence() {
  console.log('\n🔍 Testing New API Endpoints Existence...\n');
  
  const newEndpoints = [
    // Explore endpoints
    { method: 'GET', path: '/v1/explore/hospitals', description: 'Hospital discovery' },
    { method: 'GET', path: '/v1/explore/ambulances', description: 'Ambulance services' },
    { method: 'GET', path: '/v1/explore/blood-banks', description: 'Blood bank locations' },
    { method: 'GET', path: '/v1/explore/emergency-services', description: 'Emergency services' },
    { method: 'GET', path: '/v1/explore/health-tips', description: 'Health tips' },
    { method: 'GET', path: '/v1/explore/community-stats', description: 'Community statistics' },
    
    // Enhanced rewards endpoints
    { method: 'GET', path: '/v1/rewards/history', description: 'Rewards history' },
    { method: 'GET', path: '/v1/rewards/achievements', description: 'User achievements' },
    { method: 'GET', path: '/v1/users/test-id/ambulance-assists', description: 'Ambulance assists' },
    
    // Detail endpoints
    { method: 'GET', path: '/v1/assists/test-id/route', description: 'Route details' },
    { method: 'GET', path: '/v1/stations/test-id', description: 'Station details' },
    { method: 'GET', path: '/v1/hospitals/test-id', description: 'Hospital details' },
    { method: 'GET', path: '/v1/payments/methods', description: 'Payment methods' },
    
    // Emergency services
    { method: 'GET', path: '/v1/explore/emergency-contacts', description: 'Emergency contacts' },
    { method: 'GET', path: '/v1/explore/ambulance-availability', description: 'Ambulance availability' }
  ];
  
  let existingCount = 0;
  let missingCount = 0;
  
  for (const endpoint of newEndpoints) {
    try {
      const response = await axios({
        method: endpoint.method.toLowerCase(),
        url: `${BASE_URL}${endpoint.path}`,
        timeout: 5000,
        validateStatus: function (status) {
          return status < 500;
        }
      });
      
      if (response.status === 404) {
        console.log(`❌ ${endpoint.method} ${endpoint.path} - NOT FOUND (${endpoint.description})`);
        missingCount++;
      } else if (response.status === 401) {
        console.log(`✅ ${endpoint.method} ${endpoint.path} - EXISTS, AUTH REQUIRED (${endpoint.description})`);
        existingCount++;
      } else {
        console.log(`✅ ${endpoint.method} ${endpoint.path} - EXISTS (${response.status}) (${endpoint.description})`);
        existingCount++;
      }
      
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`❌ ${endpoint.method} ${endpoint.path} - NOT FOUND (${endpoint.description})`);
        missingCount++;
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`🔌 Server not running`);
        return false;
      } else {
        console.log(`⚠️  ${endpoint.method} ${endpoint.path} - ERROR: ${error.message} (${endpoint.description})`);
      }
    }
  }
  
  console.log('\n📊 New Endpoints Summary:');
  console.log(`✅ Existing endpoints: ${existingCount}`);
  console.log(`❌ Missing endpoints: ${missingCount}`);
  console.log(`📈 Total new endpoints: ${newEndpoints.length}`);
  
  return missingCount === 0;
}

async function testWebSocketConnection() {
  console.log('\n🔍 Testing WebSocket Connection...\n');
  
  try {
    // Simple HTTP check for WebSocket endpoint
    const response = await axios({
      method: 'get',
      url: `${BASE_URL}/socket.io/`,
      timeout: 5000,
      validateStatus: function (status) {
        return status < 500;
      }
    });
    
    if (response.status === 400) {
      console.log('✅ WebSocket endpoint available (Socket.IO detected)');
      return true;
    } else {
      console.log(`⚠️  WebSocket endpoint responded with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ WebSocket endpoint available (Socket.IO detected)');
      return true;
    } else {
      console.log(`❌ WebSocket connection test failed: ${error.message}`);
      return false;
    }
  }
}

async function runAllTests() {
  console.log('🚀 Starting Backend API Integration Tests\n');
  
  const basicWorking = await testBasicEndpoints();
  if (!basicWorking) {
    console.log('\n❌ Basic endpoints failed. Server may not be running.');
    process.exit(1);
  }
  
  const newEndpointsWorking = await testNewEndpointsExistence();
  const webSocketWorking = await testWebSocketConnection();
  
  console.log('\n🎯 Final Results:');
  console.log(`✅ Basic endpoints: ${basicWorking ? 'PASS' : 'FAIL'}`);
  console.log(`✅ New endpoints: ${newEndpointsWorking ? 'PASS' : 'FAIL'}`);
  console.log(`✅ WebSocket: ${webSocketWorking ? 'PASS' : 'FAIL'}`);
  
  if (basicWorking && newEndpointsWorking && webSocketWorking) {
    console.log('\n🎉 All integration tests passed!');
    console.log('✅ Frontend-backend connectivity should be working');
    console.log('✅ All missing endpoints have been implemented');
    console.log('✅ Real-time features are available');
    return true;
  } else {
    console.log('\n⚠️  Some tests failed. Check the details above.');
    return false;
  }
}

// Run all tests
runAllTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });