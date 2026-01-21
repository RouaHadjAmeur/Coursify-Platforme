#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '.env');

// Check if .env file exists
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating frontend .env file...');
  
  const envContent = `# Google OAuth Configuration for Frontend
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Frontend .env file created!');
  console.log('');
  console.log('🔧 Next steps:');
  console.log('1. Get your Google Client ID from Google Cloud Console');
  console.log('2. Replace "your_google_client_id_here" with your actual Client ID');
  console.log('3. Restart the frontend server');
} else {
  console.log('✅ Frontend .env file already exists');
}

console.log('');
console.log('🚀 To start the frontend:');
console.log('npm run dev');
