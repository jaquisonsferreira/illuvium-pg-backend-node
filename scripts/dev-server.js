#!/usr/bin/env node

const { spawn } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

let currentProcess = null;
const PORT = process.env.PORT || 3333;

function killProcessOnPort(port) {
  return new Promise((resolve) => {
    // Try to find and kill process using the port
    const killCommand = process.platform === 'win32' 
      ? `netstat -ano | findstr :${port} && taskkill /F /PID`
      : `lsof -ti :${port} | xargs kill -9 2>/dev/null || true`;
    
    const kill = spawn('sh', ['-c', killCommand]);
    kill.on('close', () => {
      setTimeout(resolve, 1000); // Give more time to release the port
    });
  });
}

async function startServer() {
  console.log('🧹 Cleaning up any existing processes...');
  // Kill any existing process on the port
  await killProcessOnPort(PORT);
  
  console.log(`🚀 Starting development server on port ${PORT}...`);
  
  // Use nodemon for better hot reload control
  currentProcess = spawn('npx', ['nodemon'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PORT }
  });

  currentProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
  });

  currentProcess.on('exit', (code, signal) => {
    if (signal !== 'SIGTERM' && signal !== 'SIGINT') {
      console.log(`Server exited with code ${code}, signal ${signal}`);
    }
  });
}

// Handle process termination
async function cleanup() {
  console.log('\n🛑 Shutting down development server...');
  
  if (currentProcess) {
    currentProcess.kill('SIGTERM');
    // Wait for the process to exit
    await new Promise(resolve => {
      currentProcess.on('exit', resolve);
      // Force kill after 5 seconds
      setTimeout(() => {
        currentProcess.kill('SIGKILL');
        resolve();
      }, 5000);
    });
  }
  
  // Final cleanup of the port
  await killProcessOnPort(PORT);
  console.log('✅ Development server stopped');
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  cleanup();
});

// Start the server
startServer();