# API Versioning Implementation

This document describes the API versioning standardization implemented for the Good Citizen backend API.

## Overview

The API versioning system ensures consistent versioning across all endpoints and provides backward compatibility for legacy clients.

## Implementation Details

### 1. Controller Versioning

All controllers now use the standardized object-based versioning format:

```typescript
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  // Controller implementation
}
```

**Standardized Controllers:**
- `AuthController`: `/v1/auth/*`
- `RideController`: `/v1/rides/*`
- `UsersController`: `/v1/users/*`
- `RewardsController`: `/v1/rewards/*`
- `ExploreController`: `/v1/explore/*`
- `DetailController`: `/v1/*` (assists, stations, hospitals, payments)
- `MobileController`: `/v1/mobile/*`
- `AdminController`: `/v1/admin/*`
- `SecurityController`: `/v1/security/*`
- `NotificationController`: `/v1/notifications/*`
- `PrivacyController`: `/v1/privacy/*`

### 2. Version Compatibility Middleware

The `VersionCompatibilityMiddleware` handles:

- **Version Extraction**: From headers, query parameters, or URL paths
- **Version Mapping**: Maps legacy versions to current versions
- **Response Headers**: Sets appropriate version headers
- **Deprecation Warnings**: Adds deprecation headers for legacy versions

**Version Priority (highest to lowest):**
1. `X-API-Version` header
2. `api-version` header
3. `version` query parameter
4. URL path version (e.g., `/v1/`)
5. Default version (`1.0`)

### 3. Version Interceptor

The existing `VersionInterceptor` provides:

- **Response Transformation**: Converts responses for different versions
- **Legacy Compatibility**: Transforms new responses to legacy format
- **Metadata Injection**: Adds version metadata to responses

### 4. Session Compatibility

The `SessionCompatibilityService` handles:

- **Legacy Session Migration**: Migrates old session formats
- **Token Validation**: Validates legacy authentication tokens
- **Session Cleanup**: Removes expired sessions

## Usage Examples

### Client Requests

```bash
# Using URL versioning (recommended)
GET /v1/auth/profile

# Using header versioning
GET /auth/profile
X-API-Version: 1.0

# Using query parameter
GET /auth/profile?version=1.0

# Legacy version (deprecated)
GET /auth/profile
X-API-Version: legacy
```

### Response Headers

```http
HTTP/1.1 200 OK
X-API-Version: 1.0
X-Requested-Version: 1.0
X-API-Deprecated: false
```

For deprecated versions:
```http
HTTP/1.1 200 OK
X-API-Version: 1.0
X-Requested-Version: legacy
X-API-Deprecated: true
X-API-Deprecation-Date: 2024-12-31
X-API-Migration-Guide: /docs/api/migration-guide
```

## Swagger Documentation

The Swagger documentation has been updated to reflect the versioning:

- **Base URLs**: Include versioned endpoints (`/v1/`)
- **Legacy Support**: Maintains backward compatibility URLs
- **Version Headers**: Documents version header usage

## Testing

### Unit Tests
- `version-compatibility.middleware.spec.ts`: Tests middleware functionality

### Integration Tests
- `api-versioning.integration.spec.ts`: Tests end-to-end versioning behavior

## Migration Guide

### For Frontend Developers

1. **Update API Calls**: Use `/v1/` prefix for all API endpoints
2. **Add Version Headers**: Include `X-API-Version: 1.0` header
3. **Handle Deprecation**: Check for `X-API-Deprecated` header

### For Backend Developers

1. **New Controllers**: Use `@Controller({ path: 'name', version: '1' })`
2. **Version-Specific Logic**: Use version metadata from middleware
3. **Response Transformation**: Implement version-specific transformations in interceptor

## Configuration

### Environment Variables

No additional environment variables are required. The versioning system uses the existing NestJS configuration.

### Middleware Registration

The middleware is automatically registered in `AppModule`:

```typescript
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(VersionCompatibilityMiddleware)
      .forRoutes('*');
  }
}
```

## Future Considerations

### Version 2.0 Support

When implementing v2.0:

1. Update `ApiVersions` enum
2. Add v2.0 transformation logic in interceptor
3. Update deprecation dates for v1.0
4. Create migration documentation

### Deprecation Timeline

- **Legacy/0.9**: Deprecated (remove by 2024-12-31)
- **v1.0**: Current stable version
- **v2.0**: Future version (planned)

## Troubleshooting

### Common Issues

1. **404 Errors**: Ensure endpoints use correct versioning format
2. **Missing Headers**: Check middleware registration order
3. **Legacy Compatibility**: Verify interceptor transformations

### Debug Information

Enable debug logging to see version resolution:

```typescript
// In version-compatibility.middleware.ts
this.logger.debug(`API Version: ${req.method} ${req.originalUrl} - Requested: ${requestedVersion}, Effective: ${effectiveVersion}`);
```