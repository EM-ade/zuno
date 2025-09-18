#!/usr/bin/env node

/**
 * Auto-activation cron job script
 * 
 * This script can be run by:
 * 1. System cron job (Linux/Mac): Add to crontab with `crontab -e`
 *    Example: */5 * * * * node /path/to/auto-activate-cron.js
 * 
 * 2. Windows Task Scheduler: Create a task to run this script every 5 minutes
 * 
 * 3. External cron services like:
 *    - Vercel Cron Jobs (if deployed on Vercel)
 *    - GitHub Actions with schedule
 *    - EasyCron, cron-job.org, etc.
 */

const https = require('https');
const http = require('http');

// Configuration
const config = {
  // Change this to your deployed URL or localhost for development
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  endpoint: '/api/collections/auto-activate',
  timeout: 30000, // 30 seconds timeout
};

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    const req = client.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Zuno-Auto-Activation-Cron/1.0'
      },
      timeout: config.timeout
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, data: result });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

async function runAutoActivation() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Starting auto-activation check...`);
  
  try {
    const url = `${config.baseUrl}${config.endpoint}`;
    console.log(`[${timestamp}] Calling: ${url}`);
    
    const response = await makeRequest(url);
    
    if (response.status === 200) {
      const data = response.data;
      console.log(`[${timestamp}] ✅ Success:`, data.message);
      
      if (data.activated > 0) {
        console.log(`[${timestamp}] 🚀 Activated ${data.activated} collections:`);
        data.collections.forEach(collection => {
          console.log(`[${timestamp}]   - ${collection.name} (${collection.id})`);
        });
      } else {
        console.log(`[${timestamp}] ℹ️  No collections needed activation`);
      }
    } else {
      console.error(`[${timestamp}] ❌ HTTP ${response.status}:`, response.data);
      process.exit(1);
    }
  } catch (error) {
    console.error(`[${timestamp}] ❌ Error:`, error.message);
    process.exit(1);
  }
}

// Run the auto-activation
runAutoActivation();
