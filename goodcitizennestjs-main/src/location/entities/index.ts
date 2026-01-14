import { ModelDefinition } from '@nestjs/mongoose';
import { UserLocation, UserLocationSchema } from './user-location.entity';

export const modelDefinitions: ModelDefinition[] = [
  {
    name: UserLocation.name,
    schema: UserLocationSchema,
  },
];