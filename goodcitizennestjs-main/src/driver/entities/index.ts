import { ModelDefinition } from '@nestjs/mongoose';
import { DriverRide, DriverRideSchema } from './driver-ride.entity';
import { DriverEarnings, DriverEarningsSchema } from './driver-earnings.entity';

export const rideModelDefinitions: ModelDefinition[] = [
  {
    name: DriverRide.name,
    schema: DriverRideSchema,
  },
  {
    name: DriverEarnings.name,
    schema: DriverEarningsSchema,
  },
];
