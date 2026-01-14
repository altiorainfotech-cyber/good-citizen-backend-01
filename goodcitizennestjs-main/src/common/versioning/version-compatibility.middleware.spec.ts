/* eslint-disable @typescript-eslint/no-unused-vars */

import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import {
  VersionCompatibilityMiddleware,
  VersionedRequest,
} from './version-compatibility.middleware';

describe('VersionCompatibilityMiddleware', () => {
  let middleware: VersionCompatibilityMiddleware;
  let mockRequest: Partial<VersionedRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VersionCompatibilityMiddleware],
    }).compile();

    middleware = module.get<VersionCompatibilityMiddleware>(
      VersionCompatibilityMiddleware,
    );

    mockRequest = {
      headers: {},
      query: {},
      originalUrl: '/v1/auth/login',
      method: 'POST',
    };

    mockResponse = {
      setHeader: jest.fn(),
    };

    nextFunction = jest.fn();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should extract version from URL path', () => {
    mockRequest.originalUrl = '/v1/auth/login';

    middleware.use(
      mockRequest as VersionedRequest,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockRequest.apiVersion).toBe('1.0');
    expect(mockRequest.versionMetadata?.requestedVersion).toBe('1');
    expect(mockRequest.versionMetadata?.effectiveVersion).toBe('1.0');
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should extract version from header', () => {
    mockRequest.headers = { 'x-api-version': '2.0' };
    mockRequest.originalUrl = '/auth/login';

    middleware.use(
      mockRequest as VersionedRequest,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockRequest.apiVersion).toBe('2.0');
    expect(mockRequest.versionMetadata?.requestedVersion).toBe('2.0');
    expect(mockRequest.versionMetadata?.effectiveVersion).toBe('2.0');
  });

  it('should extract version from query parameter', () => {
    mockRequest.query = { version: '1.0' };
    mockRequest.originalUrl = '/auth/login';

    middleware.use(
      mockRequest as VersionedRequest,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockRequest.apiVersion).toBe('1.0');
    expect(mockRequest.versionMetadata?.requestedVersion).toBe('1.0');
    expect(mockRequest.versionMetadata?.effectiveVersion).toBe('1.0');
  });

  it('should use default version when no version specified', () => {
    mockRequest.originalUrl = '/auth/login';

    middleware.use(
      mockRequest as VersionedRequest,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockRequest.apiVersion).toBe('1.0');
    expect(mockRequest.versionMetadata?.requestedVersion).toBe('1.0');
    expect(mockRequest.versionMetadata?.effectiveVersion).toBe('1.0');
  });

  it('should handle legacy version mapping', () => {
    mockRequest.headers = { 'x-api-version': 'legacy' };
    mockRequest.originalUrl = '/auth/login';

    middleware.use(
      mockRequest as VersionedRequest,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockRequest.apiVersion).toBe('1.0');
    expect(mockRequest.versionMetadata?.requestedVersion).toBe('legacy');
    expect(mockRequest.versionMetadata?.effectiveVersion).toBe('1.0');
    expect(mockRequest.versionMetadata?.isDeprecated).toBe(true);
    expect(mockRequest.isLegacyVersion).toBe(true);
  });

  it('should set appropriate response headers', () => {
    mockRequest.originalUrl = '/v1/auth/login';

    middleware.use(
      mockRequest as VersionedRequest,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-API-Version', '1.0');
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Requested-Version',
      '1',
    );
  });

  it('should set deprecation headers for deprecated versions', () => {
    mockRequest.headers = { 'x-api-version': 'legacy' };
    mockRequest.originalUrl = '/auth/login';

    middleware.use(
      mockRequest as VersionedRequest,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-API-Deprecated',
      'true',
    );
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-API-Deprecation-Date',
      '2024-12-31',
    );
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-API-Migration-Guide',
      '/docs/api/migration-guide',
    );
  });

  it('should prioritize header version over path version', () => {
    mockRequest.headers = { 'x-api-version': '2.0' };
    mockRequest.originalUrl = '/v1/auth/login';

    middleware.use(
      mockRequest as VersionedRequest,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockRequest.apiVersion).toBe('2.0');
    expect(mockRequest.versionMetadata?.requestedVersion).toBe('2.0');
    expect(mockRequest.versionMetadata?.effectiveVersion).toBe('2.0');
  });
});
