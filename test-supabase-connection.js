// Test script to verify Supabase connection and basic operations
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env.local') });

console.log('Testing Supabase connection...');

// Check environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('SUPABASE_URL present:', !!supabaseUrl);
console.log('SUPABASE_ANON_KEY present:', !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('❌ Supabase configuration is missing');
  console.log('Please check your .env.local file for SUPABASE_URL and SUPABASE_ANON_KEY');
  process.exit(1);
}

async function testSupabaseConnection() {
  try {
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    console.log('Testing Supabase connection...');
    
    // Test connection by querying a simple function or table
    // First try to get the database version
    const { data: versionData, error: versionError } = await supabase.rpc('version');
    
    if (versionError) {
      console.log('Version function not available, trying direct table query...');
      
      // Try a simple query to test connection
      const { data, error } = await supabase
        .from('collections')
        .select('count')
        .limit(1);
      
      if (error) {
        if (error.code === '42P01') {
          console.log('✅ Supabase connection successful!');
          console.log('⚠️  Tables not created yet - this is expected if you haven\'t run the migration');
          console.log('Run the SQL migration to create the database tables:');
          console.log('1. Go to your Supabase dashboard');
          console.log('2. Open the SQL editor');
          console.log('3. Copy and paste the SQL from supabase/migrations/001_create_collections_tables.sql');
          console.log('4. Click "Run"');
          return true;
        } else {
          throw error;
        }
      } else {
        console.log('✅ Supabase connection successful! Tables are accessible.');
        return true;
      }
    } else {
      console.log('✅ Supabase connection successful! Database version:', versionData);
      return true;
    }
    
  } catch (error) {
    console.log('❌ Supabase connection failed:', error.message);
    
    if (error.message.includes('JWT')) {
      console.log('🔍 Check your Supabase ANON_KEY - it might be invalid');
    } else if (error.message.includes('fetch')) {
      console.log('🔍 Network error - check your Supabase URL');
    }
    
    return false;
  }
}

async function testEnvironmentConfig() {
  console.log('\nTesting environment configuration...');
  
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log('❌ Missing environment variables:', missingVars.join(', '));
    console.log('Please check your .env.local file');
    return false;
  } else {
    console.log('✅ All required environment variables are set');
    return true;
  }
}

async function main() {
  console.log('=== Supabase Integration Test ===\n');
  
  const envTest = await testEnvironmentConfig();
  if (!envTest) {
    process.exit(1);
  }
  
  const connectionTest = await testSupabaseConnection();
  
  console.log('\n=== Test Complete ===');
  if (connectionTest) {
    console.log('✅ Supabase integration ready!');
    console.log('Next steps:');
    console.log('1. Run the SQL migration to create database tables');
    console.log('2. Test collection creation API endpoint');
    console.log('3. Verify data is stored in Supabase');
  } else {
    console.log('❌ Supabase integration failed');
    console.log('Check your Supabase configuration and try again');
    process.exit(1);
  }
}

main().catch(console.error);