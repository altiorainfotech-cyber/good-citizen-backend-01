import {
  HealthcareFacility,
  HealthcareFacilitySchema,
} from './healthcare-facility.entity';
import { BloodBank, BloodBankSchema } from './blood-bank.entity';
import {
  AmbulanceProvider,
  AmbulanceProviderSchema,
} from './ambulance-provider.entity';

export const exploreModelDefinitions = [
  { name: HealthcareFacility.name, schema: HealthcareFacilitySchema },
  { name: BloodBank.name, schema: BloodBankSchema },
  { name: AmbulanceProvider.name, schema: AmbulanceProviderSchema },
];

export {
  HealthcareFacility,
  HealthcareFacilitySchema,
  BloodBank,
  BloodBankSchema,
  AmbulanceProvider,
  AmbulanceProviderSchema,
};
