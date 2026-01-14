#!/usr/bin/env node

/**
 * Validation script for enhanced project structure setup
 * Validates that all required dependencies and configurations are in place
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating enhanced project structure setup...\n');

const validations = [
  {
    name: 'Package.json dependencies',
    check: () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const requiredDeps = ['auth0', 'joi'];
      const requiredDevDeps = ['fast-check'];
      
      const missingDeps = requiredDeps.filter(dep => !pkg.dependencies[dep]);
      const missingDevDeps = requiredDevDeps.filter(dep => !pkg.devDependencies[dep]);
      
      if (missingDeps.length > 0 || missingDevDeps.length > 0) {
        throw new Error(`Missing dependencies: ${[...missingDeps, ...missingDevDeps].join(', ')}`);
      }
      
      return 'All required dependencies installed';
    }
  },
  {
    name: 'Environment configuration files',
    check: () => {
      const envFiles = ['.env', '.env.development', '.env.testing', '.env.production'];
      const missing = envFiles.filter(file => !fs.existsSync(file));
      
      if (missing.length > 0) {
        throw new Error(`Missing environment files: ${missing.join(', ')}`);
      }
      
      return 'All environment files present';
    }
  },
  {
    name: 'Configuration modules',
    check: () => {
      const configFiles = [
        'src/config/configuration.ts',
        'src/config/validation.ts'
      ];
      const missing = configFiles.filter(file => !fs.existsSync(file));
      
      if (missing.length > 0) {
        throw new Error(`Missing configuration files: ${missing.join(', ')}`);
      }
      
      return 'Configuration modules created';
    }
  },
  {
    name: 'Testing utilities',
    check: () => {
      const testFiles = [
        'src/test/test-utils.ts',
        'src/test/project-configuration.property.spec.ts'
      ];
      const missing = testFiles.filter(file => !fs.existsSync(file));
      
      if (missing.length > 0) {
        throw new Error(`Missing test files: ${missing.join(', ')}`);
      }
      
      return 'Property-based testing utilities created';
    }
  },
  {
    name: 'Build configuration',
    check: () => {
      const buildFiles = [
        'build.config.js',
        'tsconfig.build.json'
      ];
      const missing = buildFiles.filter(file => !fs.existsSync(file));
      
      if (missing.length > 0) {
        throw new Error(`Missing build files: ${missing.join(', ')}`);
      }
      
      return 'Build optimization configuration created';
    }
  },
  {
    name: 'TypeScript configuration',
    check: () => {
      const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
      
      if (!tsconfig.compilerOptions.strict) {
        throw new Error('TypeScript strict mode not enabled');
      }
      
      return 'TypeScript strict mode configured';
    }
  },
  {
    name: 'Package.json scripts',
    check: () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const requiredScripts = ['test:pbt', 'test:unit'];
      const missing = requiredScripts.filter(script => !pkg.scripts[script]);
      
      if (missing.length > 0) {
        throw new Error(`Missing scripts: ${missing.join(', ')}`);
      }
      
      return 'Property-based testing scripts configured';
    }
  },
  {
    name: 'Documentation',
    check: () => {
      if (!fs.existsSync('PROJECT_STRUCTURE.md')) {
        throw new Error('PROJECT_STRUCTURE.md not found');
      }
      
      return 'Project documentation created';
    }
  }
];

let passed = 0;
let failed = 0;

for (const validation of validations) {
  try {
    const result = validation.check();
    console.log(`✅ ${validation.name}: ${result}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${validation.name}: ${error.message}`);
    failed++;
  }
}

console.log(`\n📊 Validation Summary:`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failed === 0) {
  console.log('\n🎉 Enhanced project structure setup completed successfully!');
  console.log('\nNext steps:');
  console.log('1. Run property-based tests: npm run test:pbt');
  console.log('2. Run unit tests: npm run test:unit');
  console.log('3. Start development server: npm run start:dev');
  console.log('4. Review PROJECT_STRUCTURE.md for detailed information');
  process.exit(0);
} else {
  console.log('\n⚠️  Some validations failed. Please address the issues above.');
  process.exit(1);
}