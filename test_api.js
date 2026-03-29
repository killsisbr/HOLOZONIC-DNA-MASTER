const axios = require('axios');

async function test() {
  const API_URL = 'http://localhost:3001/api';
  console.log('JARVIS: Verifying API Medication Sync...');
  
  try {
    // 1. Login
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      user: 'admin',
      pass: 'admin123'
    });
    const token = loginRes.data.token;
    console.log('Login successful.');

    // 2. Get patients to find one
    const pRes = await axios.get(`${API_URL}/patients`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const patient = pRes.data[0];
    if (!patient) return console.log('No patients.');
    
    console.log(`Testing with Patient ID: ${patient.id} (${patient.name})`);

    // 3. Update medications
    const updateRes = await axios.patch(`${API_URL}/patients/${patient.id}`, {
      medications: 'API Test Med; JARVIS DNA'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('Update API Response:', updateRes.data.medications);

    // 4. Verify
    const verifyRes = await axios.get(`${API_URL}/patients/${patient.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (verifyRes.data.medications === 'API Test Med; JARVIS DNA') {
      console.log('VERIFICATION SUCCESS: API and Database are 100% in sync at the network layer.');
    } else {
      console.log('VERIFICATION FAILURE: Data mismatch at API level.');
    }

  } catch (e) {
    console.error('API TEST ERROR:', e.response ? e.response.data : e.message);
  }
}

test();
