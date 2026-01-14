const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Test data
const testUser = {
  first_name: 'Test',
  last_name: 'User',
  email: 'testuser@example.com',
  password: 'password123456',
  phone_number: '1234567890',
  country_code: '+1',
  role: 'USER',
};

let userToken = '';
let userId = '';

async function testIntegration() {
  console.log('🚀 Starting Backend Integration Tests...\n');

  try {
    // 1. Test user signup and get token
    console.log('1. Testing user authentication...');
    try {
      const signupResponse = await axios.post(`${BASE_URL}/auth/signup`, testUser);
      console.log('Signup response:', JSON.stringify(signupResponse.data, null, 2));
      if (signupResponse.status === 201) {
        userToken = signupResponse.data.access_token;
        userId = signupResponse.data.user._id;
        console.log('✅ User signup successful');
      }
    } catch (error) {
      console.log('Signup error:', error.response?.data);
      // User might already exist, try login
      try {
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
          email: testUser.email,
          password: testUser.password,
        });
        console.log('Login response:', JSON.stringify(loginResponse.data, null, 2));
        userToken = loginResponse.data.access_token;
        userId = loginResponse.data.user._id;
        console.log('✅ User login successful');
      } catch (loginError) {
        console.log('Login error:', loginError.response?.data);
        console.log('❌ Authentication failed:', loginError.response?.data?.message || loginError.message);
        return;
      }
    }

    // 2. Test Emergency Services Endpoints
    console.log('\n2. Testing Emergency Services...');
    
    const headers = { Authorization: `Bearer ${userToken}` };
    
    // Test hospitals endpoint
    try {
      const hospitalsResponse = await axios.get(`${BASE_URL}/v1/explore/hospitals`, {
        headers,
        params: {
          latitude: 28.5562,
          longitude: 77.2773,
          radius: 10,
        },
      });
      console.log('✅ Hospitals endpoint working - Status:', hospitalsResponse.status);
      console.log('   Response has hospitals:', Array.isArray(hospitalsResponse.data.hospitals || hospitalsResponse.data));
    } catch (error) {
      console.log('❌ Hospitals endpoint failed:', error.response?.data?.message || error.message);
    }

    // Test blood banks endpoint
    try {
      const bloodBanksResponse = await axios.get(`${BASE_URL}/v1/explore/blood-banks`, {
        headers,
        params: {
          latitude: 28.5562,
          longitude: 77.2773,
          radius: 10,
          bloodType: 'O+',
        },
      });
      console.log('✅ Blood banks endpoint working - Status:', bloodBanksResponse.status);
      console.log('   Response has blood banks:', Array.isArray(bloodBanksResponse.data.bloodBanks || bloodBanksResponse.data));
    } catch (error) {
      console.log('❌ Blood banks endpoint failed:', error.response?.data?.message || error.message);
    }

    // Test ambulances endpoint
    try {
      const ambulancesResponse = await axios.get(`${BASE_URL}/v1/explore/ambulances`, {
        headers,
        params: {
          latitude: 28.5562,
          longitude: 77.2773,
          radius: 15,
        },
      });
      console.log('✅ Ambulances endpoint working - Status:', ambulancesResponse.status);
      console.log('   Response has ambulances:', Array.isArray(ambulancesResponse.data.ambulances || ambulancesResponse.data));
    } catch (error) {
      console.log('❌ Ambulances endpoint failed:', error.response?.data?.message || error.message);
    }

    // 3. Test Rewards System
    console.log('\n3. Testing Rewards System...');
    
    try {
      const rewardsHistoryResponse = await axios.get(`${BASE_URL}/v1/rewards/history`, {
        headers,
        params: {
          userId: userId,
          limit: 10,
        },
      });
      console.log('✅ Rewards history endpoint working - Status:', rewardsHistoryResponse.status);
      console.log('   Response has history:', Array.isArray(rewardsHistoryResponse.data.history || rewardsHistoryResponse.data));
    } catch (error) {
      console.log('❌ Rewards history endpoint failed:', error.response?.data?.message || error.message);
    }

    try {
      const achievementsResponse = await axios.get(`${BASE_URL}/v1/rewards/achievements`, {
        headers,
        params: {
          userId: userId,
        },
      });
      console.log('✅ Achievements endpoint working - Status:', achievementsResponse.status);
      console.log('   Response has achievements:', Array.isArray(achievementsResponse.data.achievements || achievementsResponse.data));
    } catch (error) {
      console.log('❌ Achievements endpoint failed:', error.response?.data?.message || error.message);
    }

    // 4. Test Impact Data
    console.log('\n4. Testing Impact Data...');
    
    try {
      const assistId = 'test-assist-id';
      const impactResponse = await axios.get(`${BASE_URL}/v1/assists/${assistId}/impact`, {
        headers,
      });
      console.log('✅ Impact endpoint working - Status:', impactResponse.status);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Impact endpoint exists (404 expected for non-existent assist)');
      } else {
        console.log('❌ Impact endpoint failed:', error.response?.data?.message || error.message);
      }
    }

    // 5. Test Location Management
    console.log('\n5. Testing Location Management...');
    
    try {
      const locationResponse = await axios.get(`${BASE_URL}/v1/location/current`, {
        headers,
        params: {
          userId: userId,
        },
      });
      console.log('✅ Location endpoint working - Status:', locationResponse.status);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Location endpoint exists (404 expected for no location data)');
      } else {
        console.log('❌ Location endpoint failed:', error.response?.data?.message || error.message);
      }
    }

    console.log('\n🎉 Backend Integration Test Complete!');

  } catch (error) {
    console.log('❌ Integration test failed:', error.message);
  }
}

// Run the test
testIntegration();