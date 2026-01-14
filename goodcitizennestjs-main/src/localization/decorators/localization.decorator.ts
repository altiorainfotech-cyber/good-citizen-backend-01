/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-return */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { LocalizationContext } from '../middleware/localization.middleware';

export const Localization = createParamDecorator(
  (
    data: keyof LocalizationContext | undefined,
    ctx: ExecutionContext,
  ): LocalizationContext | any => {
    const request = ctx.switchToHttp().getRequest();
    const localization = request.localization;

    if (data) {
      return localization?.[data];
    }

    return localization;
  },
);

// Specific decorators for common use cases
export const Language = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.localization?.language || 'en';
  },
);

export const Region = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.localization?.region || 'US';
  },
);

export const Timezone = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.localization?.timezone || 'UTC';
  },
);
