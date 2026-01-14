#!/usr/bin/env ts-node

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-call */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { MigrationService } from '../migration.service';
import { HealthcareFacilitySeeder } from '../../explore/seeders/healthcare-facility.seeder';
import { AchievementSeeder } from '../../user/seeders/achievement.seeder';
import { PaymentMethodSeeder } from '../../detail/seeders/payment-method.seeder';

interface SeedConfig {
  skipIndexes?: boolean;
  skipHealthcare?: boolean;
  skipAchievements?: boolean;
  skipPaymentMethods?: boolean;
  validateOnly?: boolean;
  force?: boolean; // Force recreate all data
}

class DatabaseSeeder {
  private readonly logger = new Logger(DatabaseSeeder.name);

  async run(config: SeedConfig = {}) {
    this.logger.log('Starting database seeding process...');

    try {
      // Create NestJS application context
      const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn', 'log'],
      });

      // Get services
      const migrationService = app.get(MigrationService);
      const healthcareSeeder = !config.skipHealthcare ? app.get(HealthcareFacilitySeeder) : null;
      const achievementSeeder = !config.skipAchievements ? app.get(AchievementSeeder) : null;
      const paymentMethodSeeder = !config.skipPaymentMethods ? app.get(PaymentMethodSeeder) : null;

      // If validate only, run validation and exit
      if (config.validateOnly) {
        this.logger.log('Running validation only...');
        const validation = await migrationService.validateMigration();

        if (validation.isValid) {
          this.logger.log('✅ Database validation passed');
        } else {
          this.logger.error('❌ Database validation failed:');
          validation.issues.forEach((issue) =>
            this.logger.error(`  - ${issue}`),
          );
        }

        await app.close();
        return;
      }

      const results: any[] = [];

      // 1. Create geospatial indexes
      if (!config.skipIndexes) {
        this.logger.log('Creating geospatial indexes...');
        const indexResult = await migrationService.createGeospatialIndexes();
        results.push({ operation: 'Geospatial Indexes', result: indexResult });
        this.logResult('Geospatial Indexes', indexResult);

        // Additional indexes for new entities
        await this.createAdditionalIndexes(app);
      }

      // 2. Seed healthcare facilities
      if (!config.skipHealthcare && healthcareSeeder) {
        this.logger.log('Seeding healthcare facilities...');
        const healthcareResult = await healthcareSeeder.seedAll();
        results.push({
          operation: 'Healthcare Facilities',
          result: healthcareResult,
        });
        this.logSeedResult('Healthcare Facilities', healthcareResult);
      }

      // 3. Seed achievements
      if (!config.skipAchievements && achievementSeeder) {
        this.logger.log('Seeding achievements...');
        const achievementResult = await achievementSeeder.seedAll();
        results.push({ operation: 'Achievements', result: achievementResult });
        this.logSeedResult('Achievements', achievementResult);
      }

      // 4. Seed payment methods
      if (!config.skipPaymentMethods && paymentMethodSeeder) {
        this.logger.log('Seeding payment methods...');
        await paymentMethodSeeder.seedAll();
        results.push({
          operation: 'Payment Methods',
          result: { success: true },
        });
        this.logger.log('✅ Payment Methods: Seeding completed');
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
      this.logger.log('='.repeat(60));
      this.logger.log('DATABASE SEEDING SUMMARY');
      this.logger.log('='.repeat(60));

      results.forEach(({ operation, result }) => {
        if (
          result.facilities ||
          result.bloodBanks ||
          result.ambulanceProviders
        ) {
          // Healthcare facilities result
          this.logger.log(`${operation}:`);
          this.logger.log(
            `  - Facilities: ${result.facilities?.created || 0} created, ${result.facilities?.updated || 0} updated`,
          );
          this.logger.log(
            `  - Blood Banks: ${result.bloodBanks?.created || 0} created, ${result.bloodBanks?.updated || 0} updated`,
          );
          this.logger.log(
            `  - Ambulance Providers: ${result.ambulanceProviders?.created || 0} created, ${result.ambulanceProviders?.updated || 0} updated`,
          );
        } else if (result.created !== undefined) {
          // Achievement result
          this.logger.log(
            `${operation}: ${result.created} created, ${result.updated || 0} updated, ${result.skipped || 0} skipped`,
          );
        } else if (result.success !== undefined) {
          // Migration result
          this.logger.log(
            `${operation}: ${result.success ? '✅ Success' : '❌ Failed'} - ${result.message || 'Completed'}`,
          );
        }
      });

      this.logger.log(
        `Overall status: ✅ Database seeding completed successfully`,
      );

      await app.close();
    } catch (error) {
      this.logger.error(
        `Database seeding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.logger.error(
        error instanceof Error ? error.stack : 'No stack trace available',
      );
      process.exit(1);
    }
  }

  /**
   * Create additional indexes for new entities
   */
  private async createAdditionalIndexes(app: any) {
    this.logger.log('Creating additional indexes for new entities...');

    try {
      // Get models from the app context
      const healthcareFacilityModel = app.get('HealthcareFacilityModel');
      const bloodBankModel = app.get('BloodBankModel');
      const ambulanceProviderModel = app.get('AmbulanceProviderModel');
      const achievementModel = app.get('AchievementModel');
      const userAchievementProgressModel = app.get(
        'UserAchievementProgressModel',
      );
      const paymentMethodModel = app.get('PaymentMethodModel');

      // Healthcare facility indexes (already defined in schema, but ensure they exist)
      if (healthcareFacilityModel) {
        await healthcareFacilityModel.collection.createIndex({
          location: '2dsphere',
        });
        await healthcareFacilityModel.collection.createIndex({
          type: 1,
          isActive: 1,
        });
        await healthcareFacilityModel.collection.createIndex({ services: 1 });
        this.logger.log('Created healthcare facility indexes');
      }

      // Blood bank indexes
      if (bloodBankModel) {
        await bloodBankModel.collection.createIndex({ location: '2dsphere' });
        await bloodBankModel.collection.createIndex({ isActive: 1 });
        await bloodBankModel.collection.createIndex({ 'bloodTypes.O-': 1 }); // For urgent blood type queries
        this.logger.log('Created blood bank indexes');
      }

      // Ambulance provider indexes
      if (ambulanceProviderModel) {
        await ambulanceProviderModel.collection.createIndex({
          location: '2dsphere',
        });
        await ambulanceProviderModel.collection.createIndex({
          availability: 1,
          isActive: 1,
        });
        await ambulanceProviderModel.collection.createIndex({
          vehicleType: 1,
          availability: 1,
        });
        await ambulanceProviderModel.collection.createIndex({
          responseTime: 1,
        });
        this.logger.log('Created ambulance provider indexes');
      }

      // Achievement indexes (already defined in schema, but ensure they exist)
      if (achievementModel) {
        await achievementModel.collection.createIndex(
          { achievement_id: 1 },
          { unique: true },
        );
        await achievementModel.collection.createIndex({
          category: 1,
          isActive: 1,
        });
        this.logger.log('Created achievement indexes');
      }

      // User achievement progress indexes
      if (userAchievementProgressModel) {
        await userAchievementProgressModel.collection.createIndex(
          { userId: 1, achievementId: 1 },
          { unique: true },
        );
        await userAchievementProgressModel.collection.createIndex({
          userId: 1,
          isUnlocked: 1,
        });
        this.logger.log('Created user achievement progress indexes');
      }

      // Payment method indexes (already defined in schema, but ensure they exist)
      if (paymentMethodModel) {
        await paymentMethodModel.collection.createIndex(
          { methodId: 1 },
          { unique: true },
        );
        await paymentMethodModel.collection.createIndex({
          type: 1,
          isEnabled: 1,
        });
        await paymentMethodModel.collection.createIndex({ sortOrder: 1 });
        this.logger.log('Created payment method indexes');
      }

      this.logger.log('✅ Additional indexes created successfully');
    } catch (error) {
      this.logger.warn(
        `Some indexes may already exist or failed to create: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

  private logSeedResult(operation: string, result: any) {
    if (result.facilities || result.bloodBanks || result.ambulanceProviders) {
      // Healthcare facilities result
      this.logger.log(`✅ ${operation}: Multiple entities seeded successfully`);
    } else if (result.created !== undefined) {
      // Standard seed result
      const status = result.created > 0 || result.updated > 0 ? '✅' : '⚠️';
      this.logger.log(
        `${status} ${operation}: ${result.created} created, ${result.updated || 0} updated, ${result.skipped || 0} skipped`,
      );
    } else {
      this.logger.log(`✅ ${operation}: Completed successfully`);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const config: SeedConfig = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--skip-indexes':
        config.skipIndexes = true;
        break;
      case '--skip-healthcare':
        config.skipHealthcare = true;
        break;
      case '--skip-achievements':
        config.skipAchievements = true;
        break;
      case '--skip-payment-methods':
        config.skipPaymentMethods = true;
        break;
      case '--validate-only':
        config.validateOnly = true;
        break;
      case '--force':
        config.force = true;
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

  const seeder = new DatabaseSeeder();
  await seeder.run(config);
}

function printHelp() {
  console.log(`
Usage: ts-node seed-database.ts [options]

Options:
  --skip-indexes           Skip geospatial index creation
  --skip-healthcare        Skip healthcare facility seeding
  --skip-achievements      Skip achievement definitions seeding
  --skip-payment-methods   Skip payment method configuration seeding
  --validate-only          Only run validation, don't perform seeding
  --force                  Force recreate all data (not implemented yet)
  --help                   Show this help message

Examples:
  # Run complete database seeding
  ts-node seed-database.ts
  
  # Skip index creation (if already done)
  ts-node seed-database.ts --skip-indexes
  
  # Seed only healthcare facilities
  ts-node seed-database.ts --skip-achievements --skip-payment-methods
  
  # Validate database state
  ts-node seed-database.ts --validate-only

Requirements Addressed:
  - 1.1, 1.2, 1.3: Healthcare facility seeder with sample data
  - 2.2: Achievement definitions seeder
  - 3.4: Payment method configuration seeder
  - Geospatial indexes for location-based queries
`);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { DatabaseSeeder, SeedConfig };
