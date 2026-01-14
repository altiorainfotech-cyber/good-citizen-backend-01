import { SetMetadata } from '@nestjs/common';
import { AdminPermission } from '../guards/admin-access.guard';

export const AdminPermissions = (...permissions: AdminPermission[]) =>
  SetMetadata('adminPermissions', permissions);

export const RequiresDriverApproval = () =>
  SetMetadata('requiresDriverApproval', true);

export const PublicEndpoint = () => SetMetadata('isPublic', true);
