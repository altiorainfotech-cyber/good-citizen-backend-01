import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Import all model definitions
import { modelDefinitions } from '../user/entities';
import { exploreModelDefinitions } from '../explore/entities';
import { detailModelDefinitions } from '../detail/entities';
import { commonModelDefinitions } from '../entities';

// Import seeders
import { ExploreDataSeeder } from '../explore/seeders/explore-data.seeder';
import { HealthcareFacilitySeeder } from '../explore/seeders/healthcare-facility.seeder';
import { AchievementSeeder } from '../user/seeders/achievement.seeder';
import { PaymentMethodSeeder } from '../detail/seeders/payment-method.seeder';
import { MigrationService } from './migration.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      ...modelDefinitions,
      ...exploreModelDefinitions,
      ...detailModelDefinitions,
      ...commonModelDefinitions,
    ]),
  ],
  providers: [
    MigrationService,
    ExploreDataSeeder,
    HealthcareFacilitySeeder,
    AchievementSeeder,
    PaymentMethodSeeder,
  ],
  exports: [
    MigrationService,
    ExploreDataSeeder,
    HealthcareFacilitySeeder,
    AchievementSeeder,
    PaymentMethodSeeder,
  ],
})
export class SeederModule {}
