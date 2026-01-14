import { RouteDetail, RouteDetailSchema } from './route-detail.entity';
import { FacilityDetail, FacilityDetailSchema } from './facility-detail.entity';
import { PaymentMethod, PaymentMethodSchema } from './payment-method.entity';

export const detailModelDefinitions = [
  { name: RouteDetail.name, schema: RouteDetailSchema },
  { name: FacilityDetail.name, schema: FacilityDetailSchema },
  { name: PaymentMethod.name, schema: PaymentMethodSchema },
];

export {
  RouteDetail,
  RouteDetailSchema,
  FacilityDetail,
  FacilityDetailSchema,
  PaymentMethod,
  PaymentMethodSchema,
};
