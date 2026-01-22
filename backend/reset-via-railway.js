// Reset database via Railway endpoint
// This script calls the reset endpoint we just added to the backend

const axios = require('axios');

const RAILWAY_URL = 'https://crediya-backend-a-production.up.railway.app';
const ADMIN_EMAIL = 'admin@test.com'; // You'll need to use existing admin credentials
const ADMIN_PASSWORD = 'your_existing_password'; // Replace with actual password

async function resetDatabaseViaRailway() {
  try {
    console.log('🚀 Starting database reset via Railway...');
    
    // Step 1: Login to get authentication token
    console.log('🔐 Logging in to get authentication token...');
    
    const loginResponse = await axios.post(`${RAILWAY_URL}/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    if (!loginResponse.data.token) {
      throw new Error('Login failed - no token received');
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful, token received');
    
    // Step 2: Call the reset endpoint
    console.log('🗑️ Calling database reset endpoint...');
    
    const resetResponse = await axios.post(`${RAILWAY_URL}/admin/reset-database`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (resetResponse.data.success) {
      console.log('🎉 Database reset completed successfully!');
      console.log('\n📋 New credentials:');
      console.log(`Email: ${resetResponse.data.credentials.email}`);
      console.log(`Password: ${resetResponse.data.credentials.password}`);
      console.log(`\n📝 Note: ${resetResponse.data.note}`);
      console.log('\n🔗 Test the system at:');
      console.log(`Frontend: https://21dac4f1-4738-4a63-93d9-17517abb90e1.netlify.app`);
      console.log(`Backend: ${RAILWAY_URL}`);
    } else {
      throw new Error('Reset endpoint returned failure');
    }
    
  } catch (error) {
    console.error('❌ Error resetting database via Railway:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Make sure you have valid admin credentials');
    console.log('2. Check if the Railway deployment is complete');
    console.log('3. Verify the backend is running and accessible');
    console.log('4. Wait a few minutes for the deployment to complete');
  }
}

// Check if credentials are provided
if (ADMIN_PASSWORD === 'your_existing_password') {
  console.log('⚠️  Please update the ADMIN_PASSWORD in this script with your actual admin password');
  console.log('Then run: node reset-via-railway.js');
} else {
  resetDatabaseViaRailway();
}
