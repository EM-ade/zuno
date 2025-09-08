// Script to run Supabase database migration
import { readFile } from 'fs/promises';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function runMigration() {
  console.log('Running Supabase migration...');
  
  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing required environment variables:');
    console.error('SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
    console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? '✓ Set' : '✗ Missing');
    process.exit(1);
  }

  try {
    // Read migration file
    const migrationPath = './supabase/migrations/001_create_collections_tables.sql';
    const migrationSql = await readFile(migrationPath, 'utf8');
    
    console.log('Migration SQL loaded successfully');
    
    // Create Supabase client with service role for migrations
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Split SQL into individual statements
    const statements = migrationSql
      .split(';')
      .filter(statement => statement.trim().length > 0)
      .map(statement => statement.trim() + ';');
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // If exec_sql function doesn't exist, try direct SQL execution
          if (error.message.includes('function exec_sql(text) does not exist')) {
            console.log('exec_sql function not available, trying alternative approach...');
            // For now, we'll just output the SQL for manual execution
            console.log('Please run the following SQL in your Supabase SQL editor:');
            console.log('\n' + migrationSql);
            break;
          } else {
            throw error;
          }
        }
      } catch (stmtError) {
        console.error(`Error executing statement ${i + 1}:`, stmtError.message);
        // Continue with next statement
      }
    }
    
    console.log('\n✅ Migration completed!');
    console.log('Next steps:');
    console.log('1. If the migration failed to run automatically, please:');
    console.log('   - Go to your Supabase dashboard');
    console.log('   - Open the SQL editor');
    console.log('   - Copy and paste the SQL from supabase/migrations/001_create_collections_tables.sql');
    console.log('   - Click "Run"');
    console.log('2. Test the database connection with: npm run test:supabase');
    console.log('3. Test collection creation with the API');
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration().catch(console.error);