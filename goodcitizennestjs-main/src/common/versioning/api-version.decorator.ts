import { SetMetadata } from '@nestjs/common';

export const API_VERSION_KEY = 'api_version';

/**
 * Decorator to specify API version for controllers or routes
 * Requirements: 19.3 - API versioning for mobile app compatibility
 */
export const ApiVersion = (version: string) =>
  SetMetadata(API_VERSION_KEY, version);

/**
 * Supported API versions
 */
export enum ApiVersions {
  V1 = '1.0',
  V2 = '2.0',
  LEGACY = 'legacy',
}

/**
 * Default API version for backward compatibility
 */
export const DEFAULT_API_VERSION = ApiVersions.V1;
