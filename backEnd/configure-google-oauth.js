#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function configureGoogleOAuth() {
  console.log('🔧 Google OAuth Configuration Setup');
  console.log('=====================================\n');
  
  console.log('📋 Before we start, make sure you have:');
  console.log('1. Created a Google Cloud Project');
  console.log('2. Enabled Google+ API');
  console.log('3. Created OAuth 2.0 credentials');
  console.log('4. Got your Client ID and Client Secret\n');
  
  try {
    const clientId = await question('Enter your Google Client ID: ');
    const clientSecret = await question('Enter your Google Client Secret: ');
    
    if (!clientId || !clientSecret) {
      console.log('❌ Client ID and Client Secret are required!');
      process.exit(1);
    }
    
    // Read existing .env file
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update or add Google OAuth variables
    const lines = envContent.split('\n');
    const updatedLines = [];
    let googleClientIdFound = false;
    let googleClientSecretFound = false;
    
    for (const line of lines) {
      if (line.startsWith('GOOGLE_CLIENT_ID=')) {
        updatedLines.push(`GOOGLE_CLIENT_ID=${clientId}`);
        googleClientIdFound = true;
      } else if (line.startsWith('GOOGLE_CLIENT_SECRET=')) {
        updatedLines.push(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
        googleClientSecretFound = true;
      } else {
        updatedLines.push(line);
      }
    }
    
    // Add Google OAuth variables if not found
    if (!googleClientIdFound) {
      updatedLines.push(`GOOGLE_CLIENT_ID=${clientId}`);
    }
    if (!googleClientSecretFound) {
      updatedLines.push(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
    }
    
    // Write updated .env file
    fs.writeFileSync(envPath, updatedLines.join('\n'));
    
    console.log('\n✅ Google OAuth configuration updated!');
    console.log('\n📝 Next steps:');
    console.log('1. Create frontEnd/.env file with: VITE_GOOGLE_CLIENT_ID=' + clientId);
    console.log('2. Restart both frontend and backend servers');
    console.log('3. Test Google authentication on login/signup pages');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

configureGoogleOAuth();
