// run-sequential-sync.js
const { execSync } = require('child_process');

try {
    console.log('🚀 Starting sequential execution...\n');
    
    // Run each script synchronously
    console.log('📝 Running parse-sort.js...');
    execSync('node parse-sort.js', { stdio: 'inherit' });
    console.log('✅ parse-sort.js completed\n');
    
    console.log('🌐 Running scrape-content.js...');
    execSync('node scrape-content.js', { stdio: 'inherit' });
    console.log('✅ scrape-content.js completed\n');
    
    console.log('🔍 Running compare-content.js...');
    execSync('node compare-content.js', { stdio: 'inherit' });
    console.log('✅ compare-content.js completed\n');

    console.log('🔍 Running compare-titles.js...');
    execSync('node compare-titles.js', { stdio: 'inherit' });
    console.log('✅ compare-titles.js completed\n');
    
    console.log('🎉 All scripts completed successfully!');
    
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}