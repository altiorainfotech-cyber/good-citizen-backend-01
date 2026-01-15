import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Response, NextFunction } from 'express';

export interface VersionedRequest {
  apiVersion?: string;
  isLegacyVersion?: boolean;
  versionMetadata?: {
    requestedVersion: string;
    effectiveVersion: string;
    isDeprecated: boolean;
    migrationInfo?: {
      recommendedVersion: string;
      deprecationDate?: string;
      migrationGuide?: string;
    };
  };
  method: string;
  originalUrl: string;
  get: (name: string) => string | undefined;
  url: string;
  query: any;
  headers: any;
}

/**
 * Middleware to handle API version compatibility and standardization
 * Requirements: 4.1, 4.2, 4.3 - Standardize API versioning across all endpoints
 */
@Injectable()
export class VersionCompatibilityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(VersionCompatibilityMiddleware.name);

  use(req: VersionedRequest, res: Response, next: NextFunction) {
    // Extract version from various sources
    const requestedVersion = this.extractVersion(req);
    const effectiveVersion = this.determineEffectiveVersion(requestedVersion);

    // Set version information on request
    req.apiVersion = effectiveVersion;
    req.isLegacyVersion = this.isLegacyVersion(requestedVersion);
    req.versionMetadata = {
      requestedVersion,
      effectiveVersion,
      isDeprecated: this.isVersionDeprecated(requestedVersion),
    };

    // Add deprecation info if needed
    if (req.versionMetadata.isDeprecated) {
      req.versionMetadata.migrationInfo = {
        recommendedVersion: '1.0',
        deprecationDate: '2024-12-31',
        migrationGuide: '/docs/api/migration-guide',
      };
    }

    // Set response headers
    res.setHeader('X-API-Version', effectiveVersion);
    res.setHeader('X-Requested-Version', requestedVersion);

    if (req.versionMetadata.isDeprecated) {
      res.setHeader('X-API-Deprecated', 'true');
      res.setHeader(
        'X-API-Deprecation-Date',
        req.versionMetadata.migrationInfo?.deprecationDate || '',
      );
      res.setHeader(
        'X-API-Migration-Guide',
        req.versionMetadata.migrationInfo?.migrationGuide || '',
      );
    }

    // Log version usage for monitoring
    this.logger.debug(
      `API Version: ${req.method} ${req.originalUrl} - ` +
        `Requested: ${requestedVersion}, Effective: ${effectiveVersion}, ` +
        `Deprecated: ${req.versionMetadata.isDeprecated}`,
    );

    next();
  }

  /**
   * Extract API version from request
   */
  private extractVersion(req: VersionedRequest): string {
    // Priority order: header > query > path > default
    const headerVersion =
      req.headers['x-api-version'] || req.headers['api-version'];
    const queryVersion = req.query.version || req.query.api_version;
    const pathVersion = this.extractVersionFromPath(req.originalUrl);

    return (
      (headerVersion as string) ||
      (queryVersion as string) ||
      pathVersion ||
      '1.0'
    ); // Default version
  }

  /**
   * Extract version from URL path (e.g., /v1/auth, /api/v2/users)
   */
  private extractVersionFromPath(url: string): string | null {
    // Match patterns like /v1/, /api/v1/, /v2.0/
    const versionMatch = url.match(/\/v(\d+(?:\.\d+)?)\//);
    return versionMatch?.[1] ?? null;
  }

  /**
   * Determine the effective version to use
   */
  private determineEffectiveVersion(requestedVersion: string): string {
    // Map legacy versions to current versions
    const versionMap: Record<string, string> = {
      legacy: '1.0',
      '0.9': '1.0',
      '1': '1.0',
      '2': '2.0',
    };

    return versionMap[requestedVersion] || requestedVersion;
  }

  /**
   * Check if the requested version is a legacy version
   */
  private isLegacyVersion(version: string): boolean {
    const legacyVersions = ['legacy', '0.9'];
    return legacyVersions.includes(version);
  }

  /**
   * Check if a version is deprecated
   */
  private isVersionDeprecated(version: string): boolean {
    const deprecatedVersions = ['legacy', '0.9'];
    return deprecatedVersions.includes(version);
  }
}
