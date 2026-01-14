import { ModelDefinition } from '@nestjs/mongoose';
import { Ride, RideSchema } from './ride.entity';

export const rideModelDefinitions: ModelDefinition[] = [
  {
    name: Ride.name,
    schema: RideSchema,
  },
];
