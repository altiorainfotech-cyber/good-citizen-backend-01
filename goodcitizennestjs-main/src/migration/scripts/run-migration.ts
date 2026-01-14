#!/usr/bin/env ts-node

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable no-case-declarations */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../../app.module';
import {
  MigrationService,
  LegacyUserData,
  LegacyRideData,
  MigrationResult,
} from '../migration.service';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationConfig {
  userDataFile?: string;
  rideDataFile?: string;
  skipUsers?: boolean;
  skipRides?: boolean;
  skipIndexes?: boolean;
  skipLocationMigration?: boolean;
  validateOnly?: boolean;
}

class MigrationRunner {
  private readonly logger = new Logger(MigrationRunner.name);

  async run(config: MigrationConfig = {}) {
    this.logger.log('Starting migration runner...');

    try {
      // Create NestJS application context
      const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn', 'log'],
      });

      const migrationService = app.get(MigrationService);

      // If validate only, run validation and exit
      if (config.validateOnly) {
        this.logger.log('Running validation only...');
        const validation = await migrationService.validateMigration();

        if (validation.isValid) {
          this.logger.log('✅ Migration validation passed');
        } else {
          this.logger.error('❌ Migration validation failed:');
          validation.issues.forEach((issue) =>
            this.logger.error(`  - ${issue}`),
          );
        }

        await app.close();
        return;
      }

      // Load legacy data if files provided
      let legacyUsers: LegacyUserData[] = [];
      let legacyRides: LegacyRideData[] = [];

      if (config.userDataFile && !config.skipUsers) {
        legacyUsers = await this.loadJsonFile<LegacyUserData[]>(
          config.userDataFile,
        );
        this.logger.log(
          `Loaded ${legacyUsers.length} users from ${config.userDataFile}`,
        );
      }

      if (config.rideDataFile && !config.skipRides) {
        legacyRides = await this.loadJsonFile<LegacyRideData[]>(
          config.rideDataFile,
        );
        this.logger.log(
          `Loaded ${legacyRides.length} rides from ${config.rideDataFile}`,
        );
      }

      // Run migrations step by step
      const results: MigrationResult[] = [];

      // 1. Create indexes
      if (!config.skipIndexes) {
        this.logger.log('Creating geospatial indexes...');
        const indexResult = await migrationService.createGeospatialIndexes();
        results.push(indexResult);
        this.logResult('Index Creation', indexResult);
      }

      // 2. Migrate location data
      if (!config.skipLocationMigration) {
        this.logger.log('Migrating location data...');
        const locationResult = await migrationService.migrateLocationData();
        results.push(locationResult);
        this.logResult('Location Migration', locationResult);
      }

      // 3. Migrate users
      if (legacyUsers.length > 0 && !config.skipUsers) {
        this.logger.log('Migrating user data...');
        const userResult = await migrationService.migrateUserData(legacyUsers);
        results.push(userResult);
        this.logResult('User Migration', userResult);
      }

      // 4. Migrate rides
      if (legacyRides.length > 0 && !config.skipRides) {
        this.logger.log('Migrating ride data...');
        const rideResult =
          await migrationService.migrateRideHistory(legacyRides);
        results.push(rideResult);
        this.logResult('Ride Migration', rideResult);
      }

      // Final validation
      this.logger.log('Running final validation...');
      const validation = await migrationService.validateMigration();

      if (validation.isValid) {
        this.logger.log('✅ Final validation passed');
      } else {
        this.logger.warn('⚠️  Final validation found issues:');
        validation.issues.forEach((issue) => this.logger.warn(`  - ${issue}`));
      }

      // Summary
      const totalMigrated = results.reduce(
        (sum, result) => sum + result.migratedCount,
        0,
      );
      const totalErrors = results.reduce(
        (sum, result) => sum + result.errorCount,
        0,
      );
      const totalSkipped = results.reduce(
        (sum, result) => sum + result.skippedCount,
        0,
      );

      this.logger.log('='.repeat(60));
      this.logger.log('MIGRATION SUMMARY');
      this.logger.log('='.repeat(60));
      this.logger.log(`Total migrated: ${totalMigrated}`);
      this.logger.log(`Total skipped: ${totalSkipped}`);
      this.logger.log(`Total errors: ${totalErrors}`);
      this.logger.log(`Overall success: ${totalErrors === 0 ? '✅' : '❌'}`);

      await app.close();
    } catch (error) {
      this.logger.error(
        `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.logger.error(
        error instanceof Error ? error.stack : 'No stack trace available',
      );
      process.exit(1);
    }
  }

  private async loadJsonFile<T>(filePath: string): Promise<T> {
    try {
      const fullPath = path.resolve(filePath);
      const fileContent = await fs.promises.readFile(fullPath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      throw new Error(
        `Failed to load JSON file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private logResult(operation: string, result: any) {
    const status = result.success ? '✅' : '❌';
    this.logger.log(`${status} ${operation}: ${result.message}`);

    if (result.errors && result.errors.length > 0) {
      this.logger.error(`Errors in ${operation}:`);
      result.errors.forEach((error: string) =>
        this.logger.error(`  - ${error}`),
      );
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const config: MigrationConfig = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--users':
        const userFile = args[++i];
        if (userFile) config.userDataFile = userFile;
        break;
      case '--rides':
        const rideFile = args[++i];
        if (rideFile) config.rideDataFile = rideFile;
        break;
      case '--skip-users':
        config.skipUsers = true;
        break;
      case '--skip-rides':
        config.skipRides = true;
        break;
      case '--skip-indexes':
        config.skipIndexes = true;
        break;
      case '--skip-location':
        config.skipLocationMigration = true;
        break;
      case '--validate-only':
        config.validateOnly = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  const runner = new MigrationRunner();
  await runner.run(config);
}

function printHelp() {
// console.log removed
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { MigrationRunner, MigrationConfig };
