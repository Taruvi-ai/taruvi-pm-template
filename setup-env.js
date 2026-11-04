#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to ask a question and return a promise
function askQuestion(question, defaultValue = '') {
  return new Promise((resolve) => {
    const questionText = defaultValue
      ? `${question} (default: ${defaultValue}): `
      : `${question}: `;

    rl.question(questionText, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

// Function to copy and update .env file
function updateEnvFile(envValues) {
  const envExamplePath = path.join(__dirname, '.env.example');
  const envPath = path.join(__dirname, '.env');

  let envContent = fs.readFileSync(envExamplePath, 'utf8');

  // Replace placeholders with actual values
  envContent = envContent.replace(
    'VITE_TARUVI_BASE_URL=',
    `VITE_TARUVI_BASE_URL=${envValues.baseUrl}`
  );

  // VITE_TARUVI_API_KEY is intentionally left blank: every VITE_* value is
  // inlined into the public bundle, and the app authenticates with the
  // user's session token. The API key only goes into .mcp.json.

  envContent = envContent.replace(
    'VITE_TARUVI_APP_SLUG=',
    `VITE_TARUVI_APP_SLUG=${envValues.appSlug}`
  );

  envContent = envContent.replace(
    'VITE_TARUVI_APP_TITLE=CRM',
    `VITE_TARUVI_APP_TITLE=${envValues.appTitle}`
  );

  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file updated successfully');
}

// Function to copy and update .mcp.json file
function updateMcpFile(envValues) {
  const mcpExamplePath = path.join(__dirname, '.mcp.example.json');
  const mcpPath = path.join(__dirname, '.mcp.json');

  let mcpContent = fs.readFileSync(mcpExamplePath, 'utf8');

  // Replace API key and app slug in taruvi section
  mcpContent = mcpContent.replace(
    /"Authorization": "Api-Key [^"]*"/,
    `"Authorization": "Api-Key ${envValues.apiKey}"`
  );

  mcpContent = mcpContent.replace(
    /"X-App-Slug": "[^"]*"/,
    `"X-App-Slug": "${envValues.appSlug}"`
  );

  fs.writeFileSync(mcpPath, mcpContent);
  console.log('✅ .mcp.json file updated successfully');
}

// Main async function
async function main() {
  console.log('🔧 Taruvi Refine Template Environment Setup');
  console.log('==========================================\n');

  console.log('This script will help you set up your environment variables and configuration files.');
  console.log('You can press Enter to use the default values shown in brackets.\n');

  try {
    // Ask for environment variables
    const baseUrl = await askQuestion(
      'Taruvi Base URL',
      'https://appbuild.taruvi.cloud'
    );

    const apiKey = await askQuestion('Taruvi MCP API Key');
    if (!apiKey) {
      console.log('⚠️  No API key entered; .mcp.json will need one before the Taruvi MCP server works.');
    }

    const appSlug = await askQuestion(
      'Application Slug',
      'task'
    );

    const appTitle = await askQuestion(
      'Application Title',
      appSlug.charAt(0).toUpperCase() + appSlug.slice(1)
    );

    // Confirm values with user
    console.log('\n📝 Configuration Summary:');
    console.log(`  Base URL: ${baseUrl}`);
    console.log(`  API Key: ${apiKey ? `${apiKey.slice(0, 4)}…` : '(none)'}`);
    console.log(`  App Slug: ${appSlug}`);
    console.log(`  App Title: ${appTitle}`);

    const confirm = await askQuestion('\nProceed with these values? (y/n)', 'y');

    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ Setup cancelled by user');
      rl.close();
      return;
    }

    // Update files
    const envValues = {
      baseUrl,
      apiKey,
      appSlug,
      appTitle
    };

    // Copy and update .env file
    updateEnvFile(envValues);

    // Copy and update .mcp.json file
    updateMcpFile(envValues);

    console.log('\n🎉 Setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Review the generated .env file');
    console.log('2. Review the generated .mcp.json file');
    console.log('3. Start the development server with: npm run dev');

  } catch (error) {
    console.error('❌ Error during setup:', error.message);
  } finally {
    rl.close();
  }
}

// Run the main function
main();