require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiConnection() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY not found in environment variables');
      console.error('Please create a .env file with your Gemini API key');
      return;
    }

    console.log('🔑 API Key found, testing connection...');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    const result = await model.generateContent('Hello! Please respond with "Connection successful!"');
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Gemini connection successful!');
    console.log('Response:', text);
    
  } catch (error) {
    console.error('❌ Error testing Gemini connection:', error.message);
  }
}

testGeminiConnection(); 