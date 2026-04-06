// Test script to verify all advanced features are working
const axios = require('axios');

const baseURL = 'http://localhost:8000';
const testUser = {
  email: 'test@example.com',
  password: 'testpassword123',
  name: 'Test User'
};

async function runTests() {
  console.log('🧪 Testing Advanced Jarvis Features...\n');
  
  try {
    // Test 1: User Signup/Login
    console.log('1. Testing Authentication...');
    let response = await axios.post(`${baseURL}/api/auth/signup`, testUser, {
      withCredentials: true
    });
    console.log('✅ Signup successful');
    
    // Get auth cookie from response
    const cookies = response.headers['set-cookie'];
    
    // Test 2: Add Expense
    console.log('\n2. Testing Expense Tracking...');
    response = await axios.post(`${baseURL}/api/advanced/expense`, {
      amount: 5.50,
      category: 'Coffee',
      description: 'Morning coffee'
    }, {
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true,
      headers: { Cookie: cookies.join('; ') }
    });
    console.log('✅ Expense tracking working');
    
    // Test 3: Add Calendar Event
    console.log('\n3. Testing Calendar Events...');
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
    response = await axios.post(`${baseURL}/api/advanced/calendar-event`, {
      title: 'Team Meeting',
      description: 'Weekly team sync',
      startDate: futureDate
    }, {
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true,
      headers: { Cookie: cookies.join('; ') }
    });
    console.log('✅ Calendar event creation working');
    
    // Test 4: Text Summarization
    console.log('\n4. Testing Text Summarization...');
    response = await axios.post(`${baseURL}/api/advanced/summarize`, {
      text: 'This is a long text that needs to be summarized. It contains multiple sentences and should be condensed into a shorter version.'
    }, {
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true,
      headers: { Cookie: cookies.join('; ') }
    });
    console.log('✅ Text summarization working');
    
    // Test 5: Translation
    console.log('\n5. Testing Text Translation...');
    response = await axios.post(`${baseURL}/api/advanced/translate`, {
      text: 'Hello world',
      targetLang: 'fr'
    }, {
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true,
      headers: { Cookie: cookies.join('; ') }
    });
    console.log('✅ Text translation working');
    
    // Test 6: Get Expenses
    console.log('\n6. Testing Expense Retrieval...');
    response = await axios.get(`${baseURL}/api/advanced/expenses`, {
      withCredentials: true,
      headers: { Cookie: cookies.join('; ') }
    });
    console.log('✅ Expense retrieval working');
    
    // Test 7: Get Calendar Events
    console.log('\n7. Testing Calendar Event Retrieval...');
    response = await axios.get(`${baseURL}/api/advanced/calendar-events`, {
      withCredentials: true,
      headers: { Cookie: cookies.join('; ') }
    });
    console.log('✅ Calendar event retrieval working');
    
    console.log('\n🎉 All advanced features are working properly!');
    console.log('\n📋 Features verified:');
    console.log('  ✓ Authentication system');
    console.log('  ✓ Expense tracking');
    console.log('  ✓ Calendar event management');
    console.log('  ✓ Text summarization');
    console.log('  ✓ Text translation');
    console.log('  ✓ Data retrieval APIs');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.status === 404) {
      console.log('💡 Make sure the backend server is running on port 8000');
    }
  }
}

// Run the tests
runTests();