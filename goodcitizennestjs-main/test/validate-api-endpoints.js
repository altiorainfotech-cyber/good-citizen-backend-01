/**
 * API Endpoint Validation Script
 * 
 * This script validates the new API endpoints for:
 * - Emergency services (hospitals, blood banks, ambulances)
 * - Impact tracking and calculation
 * - Rewards system integration
 * - Location management
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 * 
 * Usage: node test/validate-api-endpoints.js
 * Note: Requires the backend server to be running on http://localhost:3000
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_USER_EMAIL = 'api-test-user@example.com';
const TEST_USER_PASSWORD = 'TestPassword123!';

let authToken = null;
let userId = null;

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const req = lib.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null,
          };
          resolve(response);
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function setupTestUser() {
  log('\n=== Setting up test user ===', colors.blue);
  
  try {
    // Try to sign up
    const signupResponse = await makeRequest('POST', '/auth/signup', {
      first_name: 'API',
      last_name: 'Test',
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      phone_number: '1234567890',
      country_code: '+1',
      role: 'USER',
    });

    if (signupResponse.statusCode === 201 || signupResponse.statusCode === 200) {
      authToken = signupResponse.body.access_token;
      userId = signupResponse.body.user._id;
      log('✓ Test user created successfully', colors.green);
      return true;
    } else if (signupResponse.statusCode === 409 || signupResponse.statusCode === 400) {
      // User might already exist, try to login
      log('User already exists, attempting login...', colors.yellow);
      
      const loginResponse = await makeRequest('POST', '/auth/login', {
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      if (loginResponse.statusCode === 200 || loginResponse.statusCode === 201) {
        authToken = loginResponse.body.access_token;
        userId = loginResponse.body.user._id;
        log('✓ Logged in successfully', colors.green);
        return true;
      }
    }

    log('✗ Failed to setup test user', colors.red);
    return false;
  } catch (error) {
    log(`✗ Error setting up test user: ${error.message}`, colors.red);
    return false;
  }
}

async function testHospitalsEndpoint() {
  log('\n=== Testing /v1/explore/hospitals endpoint ===', colors.blue);
  
  try {
    const response = await makeRequest(
      'GET',
      '/v1/explore/hospitals?latitude=40.7128&longitude=-74.0060&radius=10',
      null,
      authToken
    );

    if (response.statusCode === 200) {
      log('✓ Status: 200 OK', colors.green);
      
      if (response.body && response.body.hospitals) {
        log(`✓ Response structure valid (${response.body.count} hospitals)`, colors.green);
        
        if (response.body.hospitals.length > 0) {
          const hospital = response.body.hospitals[0];
          const requiredFields = ['id', 'name', 'address', 'coordinates', 'specialties'];
          const hasAllFields = requiredFields.every(field => hospital.hasOwnProperty(field));
          
          if (hasAllFields) {
            log('✓ Hospital data structure valid', colors.green);
          } else {
            log('✗ Hospital data missing required fields', colors.red);
          }
        }
      } else {
        log('✓ Response valid (no hospitals in database)', colors.yellow);
      }
      
      return true;
    } else {
      log(`✗ Status: ${response.statusCode}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, colors.red);
    return false;
  }
}

async function testBloodBanksEndpoint() {
  log('\n=== Testing /v1/explore/blood-banks endpoint ===', colors.blue);
  
  try {
    const response = await makeRequest(
      'GET',
      '/v1/explore/blood-banks?latitude=40.7128&longitude=-74.0060&radius=15&bloodType=O%2B',
      null,
      authToken
    );

    if (response.statusCode === 200) {
      log('✓ Status: 200 OK', colors.green);
      
      if (response.body && response.body.bloodBanks) {
        log(`✓ Response structure valid (${response.body.count} blood banks)`, colors.green);
        
        if (response.body.bloodBanks.length > 0) {
          const bloodBank = response.body.bloodBanks[0];
          const requiredFields = ['id', 'name', 'address', 'coordinates', 'bloodTypes'];
          const hasAllFields = requiredFields.every(field => bloodBank.hasOwnProperty(field));
          
          if (hasAllFields) {
            log('✓ Blood bank data structure valid', colors.green);
          } else {
            log('✗ Blood bank data missing required fields', colors.red);
          }
        }
      } else {
        log('✓ Response valid (no blood banks in database)', colors.yellow);
      }
      
      return true;
    } else {
      log(`✗ Status: ${response.statusCode}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, colors.red);
    return false;
  }
}

async function testImpactEndpoint() {
  log('\n=== Testing /v1/assists/:id/impact endpoint ===', colors.blue);
  
  try {
    const testAssistId = 'test-assist-id';
    const response = await makeRequest(
      'GET',
      `/v1/assists/${testAssistId}/impact`,
      null,
      authToken
    );

    // Expect 404 since assist doesn't exist, but endpoint should be accessible
    if (response.statusCode === 404) {
      log('✓ Endpoint accessible (404 expected for non-existent assist)', colors.green);
      log('✓ Proper error handling', colors.green);
      return true;
    } else if (response.statusCode === 200) {
      log('✓ Status: 200 OK', colors.green);
      
      if (response.body && response.body.data) {
        const requiredFields = ['timeSaved', 'livesAffected', 'responseTimeImprovement', 'communityContribution'];
        const hasAllFields = requiredFields.every(field => response.body.data.hasOwnProperty(field));
        
        if (hasAllFields) {
          log('✓ Impact data structure valid', colors.green);
        } else {
          log('✗ Impact data missing required fields', colors.red);
        }
      }
      
      return true;
    } else {
      log(`✗ Unexpected status: ${response.statusCode}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, colors.red);
    return false;
  }
}

async function testRewardsHistoryEndpoint() {
  log('\n=== Testing /rewards/history/:userId endpoint ===', colors.blue);
  
  try {
    const response = await makeRequest(
      'GET',
      `/rewards/history/${userId}?limit=20`,
      null,
      authToken
    );

    if (response.statusCode === 200) {
      log('✓ Status: 200 OK', colors.green);
      
      if (Array.isArray(response.body)) {
        log(`✓ Response is array (${response.body.length} items)`, colors.green);
        
        if (response.body.length > 0) {
          const historyItem = response.body[0];
          const requiredFields = ['redemption_id', 'reward_name', 'points_spent', 'status'];
          const hasAllFields = requiredFields.every(field => historyItem.hasOwnProperty(field));
          
          if (hasAllFields) {
            log('✓ Reward history data structure valid', colors.green);
          } else {
            log('✗ Reward history data missing required fields', colors.red);
          }
        } else {
          log('✓ Empty history (expected for new user)', colors.yellow);
        }
      } else {
        log('✗ Response is not an array', colors.red);
        return false;
      }
      
      return true;
    } else {
      log(`✗ Status: ${response.statusCode}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, colors.red);
    return false;
  }
}

async function testLocationUpdateEndpoint() {
  log('\n=== Testing /v1/location/update endpoint ===', colors.blue);
  
  try {
    const response = await makeRequest(
      'POST',
      '/v1/location/update',
      {
        userId: userId,
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10,
        source: 'gps',
      },
      authToken
    );

    if (response.statusCode === 200) {
      log('✓ Status: 200 OK', colors.green);
      
      if (response.body && response.body.status === 'success') {
        log('✓ Location updated successfully', colors.green);
        return true;
      } else {
        log('✗ Unexpected response format', colors.red);
        return false;
      }
    } else {
      log(`✗ Status: ${response.statusCode}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, colors.red);
    return false;
  }
}

async function testLocationCurrentEndpoint() {
  log('\n=== Testing /v1/location/current endpoint ===', colors.blue);
  
  try {
    const response = await makeRequest(
      'GET',
      `/v1/location/current?userId=${userId}`,
      null,
      authToken
    );

    if (response.statusCode === 200) {
      log('✓ Status: 200 OK', colors.green);
      
      if (response.body) {
        const requiredFields = ['latitude', 'longitude', 'accuracy', 'timestamp', 'source'];
        const hasAllFields = requiredFields.every(field => response.body.hasOwnProperty(field));
        
        if (hasAllFields) {
          log('✓ Location data structure valid', colors.green);
        } else {
          log('✗ Location data missing required fields', colors.red);
        }
      }
      
      return true;
    } else if (response.statusCode === 404) {
      log('✓ Endpoint accessible (404 expected if no location set)', colors.yellow);
      return true;
    } else {
      log(`✗ Status: ${response.statusCode}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, colors.red);
    return false;
  }
}

async function testAuthenticationRequired() {
  log('\n=== Testing authentication requirements ===', colors.blue);
  
  try {
    const response = await makeRequest(
      'GET',
      '/v1/explore/hospitals?latitude=40.7128&longitude=-74.0060',
      null,
      null // No token
    );

    if (response.statusCode === 401) {
      log('✓ Properly requires authentication (401)', colors.green);
      return true;
    } else {
      log(`✗ Expected 401, got ${response.statusCode}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, colors.red);
    return false;
  }
}

async function runAllTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', colors.blue);
  log('║   Backend API Endpoints Integration Validation            ║', colors.blue);
  log('╚════════════════════════════════════════════════════════════╝', colors.blue);
  
  log(`\nTarget: ${BASE_URL}`, colors.yellow);
  
  // Setup
  const setupSuccess = await setupTestUser();
  if (!setupSuccess) {
    log('\n✗ Failed to setup test user. Cannot proceed with tests.', colors.red);
    process.exit(1);
  }

  // Run all tests
  const results = {
    hospitals: await testHospitalsEndpoint(),
    bloodBanks: await testBloodBanksEndpoint(),
    impact: await testImpactEndpoint(),
    rewardsHistory: await testRewardsHistoryEndpoint(),
    locationUpdate: await testLocationUpdateEndpoint(),
    locationCurrent: await testLocationCurrentEndpoint(),
    authentication: await testAuthenticationRequired(),
  };

  // Summary
  log('\n╔════════════════════════════════════════════════════════════╗', colors.blue);
  log('║   Test Summary                                             ║', colors.blue);
  log('╚════════════════════════════════════════════════════════════╝', colors.blue);
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([name, passed]) => {
    const status = passed ? '✓' : '✗';
    const color = passed ? colors.green : colors.red;
    log(`${status} ${name}`, color);
  });
  
  log(`\nTotal: ${passed}/${total} tests passed`, passed === total ? colors.green : colors.red);
  
  if (passed === total) {
    log('\n✓ All API endpoint integration tests passed!', colors.green);
    process.exit(0);
  } else {
    log('\n✗ Some tests failed. Please review the output above.', colors.red);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  log(`\n✗ Fatal error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
