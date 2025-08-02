#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Running post-install script...');

// Check if we're in a Linux environment (typical for deployment)
const platform = process.platform;
const arch = process.arch;

console.log(`Platform: ${platform}, Architecture: ${arch}`);

// Try to ensure the correct Valkey binary is installed
try {
  // Check if @valkey/valkey-glide is installed
  const valkeyPath = path.join(
    __dirname,
    '..',
    'node_modules',
    '@valkey',
    'valkey-glide',
  );

  if (fs.existsSync(valkeyPath)) {
    console.log('Valkey-glide is installed.');

    // For Linux x64 environments, ensure the native binding is available
    if (platform === 'linux' && arch === 'x64') {
      console.log(
        'Linux x64 environment detected. Checking for native bindings...',
      );

      // Try to install the platform-specific package if needed
      try {
        execSync('npm list @valkey/valkey-glide-linux-x64', {
          stdio: 'ignore',
        });
        console.log('Native bindings for Linux x64 are already installed.');
      } catch (e) {
        console.log('Installing native bindings for Linux x64...');
        try {
          execSync(
            'npm install @valkey/valkey-glide-linux-x64@1.3.4 --no-save --force',
            { stdio: 'inherit' },
          );
          console.log('Native bindings installed successfully.');
        } catch (installError) {
          console.warn(
            'Warning: Could not install native bindings. The application might fail at runtime.',
          );
          console.warn(
            'You may need to install build tools or use a different cache strategy.',
          );
        }
      }
    }
  }
} catch (error) {
  console.error('Error in post-install script:', error.message);
  // Don't fail the install process
  process.exit(0);
}

console.log('Post-install script completed.');
