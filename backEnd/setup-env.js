#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '.env');

// Check if .env file exists
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file...');
  
  const envContent = `# Google OAuth Configuration
# Get these from: https://console.cloud.google.com/
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/coursify

# Session Configuration
SESSION_SECRET=your_session_secret_here

# Email Configuration
EMAIL_USER=rouuha7@gmail.com
EMAIL_PASS=your_app_password_here
`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created!');
  console.log('');
  console.log('🔧 Next steps:');
  console.log('1. Go to https://console.cloud.google.com/');
  console.log('2. Create a new project or select existing one');
  console.log('3. Enable Google+ API');
  console.log('4. Create OAuth 2.0 credentials');
  console.log('5. Add authorized redirect URI: http://localhost:3000/api/auth/google/callback');
  console.log('6. Copy Client ID and Client Secret to .env file');
  console.log('7. Generate a random SESSION_SECRET');
  console.log('');
  console.log('📧 For email configuration:');
  console.log('1. Enable 2-factor authentication on your Gmail account');
  console.log('2. Generate an App Password');
  console.log('3. Use the App Password as EMAIL_PASS');
} else {
  console.log('✅ .env file already exists');
}

console.log('');
console.log('🚀 To start the server:');
console.log('npm run dev');