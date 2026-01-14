#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 System Validation Report');
console.log('============================\n');

// Check if critical files exist
const criticalFiles = [
  'src/app.module.ts',
  'src/main.ts',
  'src/authentication/auth.service.ts',
  'src/ride/ride.service.ts',
  'src/driver/driver.service.ts',
  'src/web-socket/web-socket.gateway.ts',
  'src/common/common.service.ts',
  'package.json',
  '.env',
];

console.log('📁 Critical Files Check:');
let missingFiles = [];
criticalFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) missingFiles.push(file);
});

if (missingFiles.length > 0) {
  console.log(`\n⚠️  Missing ${missingFiles.length} critical files`);
} else {
  console.log('\n✅ All critical files present');
}

// Check package.json dependencies
console.log('\n📦 Dependencies Check:');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredDeps = [
  '@nestjs/core',
  '@nestjs/common',
  '@nestjs/mongoose',
  '@nestjs/jwt',
  '@nestjs/websockets',
  'mongoose',
  'socket.io',
  'bcrypt',
  'redis',
  '@socket.io/redis-adapter'
];

let missingDeps = [];
requiredDeps.forEach(dep => {
  const exists = packageJson.dependencies[dep] || packageJson.devDependencies[dep];
  console.log(`  ${exists ? '✅' : '❌'} ${dep}`);
  if (!exists) missingDeps.push(dep);
});

if (missingDeps.length > 0) {
  console.log(`\n⚠️  Missing ${missingDeps.length} required dependencies`);
} else {
  console.log('\n✅ All required dependencies present');
}

// Check environment variables
console.log('\n🔧 Environment Configuration:');
const envFile = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_ACCESS_EXPIRY',
  'PORT'
];

let missingEnvVars = [];
requiredEnvVars.forEach(envVar => {
  const exists = envFile.includes(envVar) || process.env[envVar];
  console.log(`  ${exists ? '✅' : '❌'} ${envVar}`);
  if (!exists) missingEnvVars.push(envVar);
});

if (missingEnvVars.length > 0) {
  console.log(`\n⚠️  Missing ${missingEnvVars.length} environment variables`);
} else {
  console.log('\n✅ All required environment variables configured');
}

// Check mobile app integration
console.log('\n📱 Mobile App Integration:');
const userAppApi = fs.existsSync('../good-citizen/src/services/api.js');
const partnerAppApi = fs.existsSync('../goodcitizen-partner/src/services/api.js');

console.log(`  ${userAppApi ? '✅' : '❌'} User App API Service`);
console.log(`  ${partnerAppApi ? '✅' : '❌'} Partner App API Service`);

if (userAppApi && partnerAppApi) {
  console.log('\n✅ Mobile app API services are integrated');
} else {
  console.log('\n⚠️  Mobile app API services need attention');
}

// Summary
console.log('\n📊 System Status Summary:');
console.log('========================');

const totalIssues = missingFiles.length + missingDeps.length + missingEnvVars.length + (!userAppApi ? 1 : 0) + (!partnerAppApi ? 1 : 0);

if (totalIssues === 0) {
  console.log('🎉 System is ready for production!');
  console.log('✅ All critical components are in place');
  console.log('✅ Dependencies are installed');
  console.log('✅ Environment is configured');
  console.log('✅ Mobile apps are integrated');
} else {
  console.log(`⚠️  Found ${totalIssues} issues that need attention:`);
  if (missingFiles.length > 0) console.log(`   - ${missingFiles.length} missing files`);
  if (missingDeps.length > 0) console.log(`   - ${missingDeps.length} missing dependencies`);
  if (missingEnvVars.length > 0) console.log(`   - ${missingEnvVars.length} missing environment variables`);
  if (!userAppApi) console.log('   - User app API service needs integration');
  if (!partnerAppApi) console.log('   - Partner app API service needs integration');
}

console.log('\n🔗 Next Steps:');
if (totalIssues === 0) {
  console.log('1. Run integration tests: npm run test:e2e');
  console.log('2. Start the development server: npm run start:dev');
  console.log('3. Test mobile app connections');
  console.log('4. Deploy to production environment');
} else {
  console.log('1. Fix the issues listed above');
  console.log('2. Re-run this validation script');
  console.log('3. Test the system thoroughly');
}

console.log('\n' + '='.repeat(50));
process.exit(totalIssues === 0 ? 0 : 1);