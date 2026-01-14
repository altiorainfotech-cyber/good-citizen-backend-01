import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DriverModule } from './driver/driver.module';
import { UserModule } from './user/user.module';
import { WebSocketModule } from './web-socket/web-socket.module';
import { AuthModule } from './authentication/auth.module';
import { RideModule } from './ride/ride.module';
import { CommonModule } from './common/common.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './authentication/strategies/jwt.strategy';
import { VerificationStrategy } from './authentication/strategies/verification.strategy';
import { TempStrategy } from './authentication/strategies/temp-jwt.strategy';
import { RolesGuard } from './authentication/guards/roles.guard';
import { JwtModule } from '@nestjs/jwt';
import { modelDefinitions } from './user/entities';
import { commonModelDefinitions } from './entities';
import { rideModelDefinitions as driverRideModelDefinitions } from './driver/entities';
import { rideModelDefinitions } from './ride/entities';
import { AdminModule } from './admin/admin.module';
import { AdminModelDefinitions } from './admin/entities';
import { LocalizationModule } from './localization/localization.module';
import { localizationModelDefinitions } from './localization/entities';
import { exploreModelDefinitions } from './explore/entities';
import { MetricsMiddleware } from './common/metrics.middleware';
import { MigrationModule } from './migration/migration.module';
import { VersioningModule } from './common/versioning/versioning.module';
import { MobileModule } from './mobile/mobile.module';
import { ExploreModule } from './explore/explore.module';
import { ExploreSimpleModule } from './explore-simple/explore-simple.module';
import { LocationModule } from './location/location.module';
import { modelDefinitions as locationModelDefinitions } from './location/entities';
import { RoutingModule } from './routing/routing.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [
        '.env.local',
        '.env.development',
        '.env.testing',
        '.env.production',
        '.env',
      ],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>('DATABASE_URL') ||
          'mongodb://localhost:27017/ride-hailing',
      }),
    }),
    MongooseModule.forFeature([
      ...AdminModelDefinitions,
      ...modelDefinitions,
      ...commonModelDefinitions,
      ...driverRideModelDefinitions,
      ...rideModelDefinitions,
      ...localizationModelDefinitions,
      ...exploreModelDefinitions,
      ...locationModelDefinitions,
    ]),
    // FirebaseModule.forRootAsync({
    //   inject: [ConfigService],
    //   useFactory: (configService: ConfigService) => ({
    //     googleApplicationCredential: {
    //       projectId: configService.get<string>('PROJECT_ID'),
    //       clientEmail: configService.get<string>('CLIENT_EMAIL'),
    //       privateKey: configService.get<string>('PRIVATE_KEY')
    //     }
    //   }),
    // }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET', 'defaultSecret'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRY', '1d'),
        },
      }),
    }),
    CommonModule,
    DriverModule,
    UserModule,
    WebSocketModule,
    AuthModule,
    RideModule,
    AdminModule,
    LocalizationModule,
    MigrationModule,
    VersioningModule,
    MobileModule,
    ExploreModule,
    ExploreSimpleModule,
    LocationModule,
    RoutingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtStrategy,
    VerificationStrategy,
    TempStrategy,
    RolesGuard,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MetricsMiddleware)
      .exclude(
        '/v1/monitoring/health',
        '/v1/monitoring/live',
        '/v1/monitoring/ready',
      ) // Exclude health checks from metrics
      .forRoutes('*');
  }
}
