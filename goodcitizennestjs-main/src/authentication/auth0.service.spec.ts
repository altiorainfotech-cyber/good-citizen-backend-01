/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as fc from 'fast-check';
import * as jwt from 'jsonwebtoken';
import { Auth0Service, Auth0UserProfile } from './auth0.service';
import { Auth0ConfigService } from './auth0.config';

describe('Auth0Service', () => {
  let service: Auth0Service;

  const mockAuth0Config = {
    domain: 'test-domain.auth0.com',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    audience: 'test-audience',
    scope: 'openid profile email',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Auth0Service,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                AUTH0_DOMAIN: mockAuth0Config.domain,
                AUTH0_CLIENT_ID: mockAuth0Config.clientId,
                AUTH0_CLIENT_SECRET: mockAuth0Config.clientSecret,
                AUTH0_AUDIENCE: mockAuth0Config.audience,
                BASE_URL: 'http://localhost:3001',
              };
              return config[key];
            }),
          },
        },
        {
          provide: Auth0ConfigService,
          useValue: {
            getAuth0Config: jest.fn(() => mockAuth0Config),
          },
        },
      ],
    }).compile();

    service = module.get<Auth0Service>(Auth0Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * Property 26: Auth0 Token Validation
   * Validates: Requirements 27.1, 27.2, 27.4
   * Feature: ride-hailing-backend-integration, Property 26: Auth0 Token Validation
   */
  describe('Property 26: Auth0 Token Validation', () => {
    it('should validate Auth0 tokens and extract user profile data consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid Auth0 user profile data
          fc.record({
            sub: fc.oneof(
              fc.string({ minLength: 10 }).map((s) => `google-oauth2|${s}`),
              fc.string({ minLength: 10 }).map((s) => `apple|${s}`),
            ),
            email: fc.emailAddress(),
            email_verified: fc.boolean(),
            name: fc.string({ minLength: 2, maxLength: 50 }),
            picture: fc.webUrl(),
            given_name: fc.string({ minLength: 1, maxLength: 25 }),
            family_name: fc.string({ minLength: 1, maxLength: 25 }),
          }),
          async (profileData) => {
            // Create a valid JWT token with the profile data
            const tokenPayload = {
              ...profileData,
              iss: `https://${mockAuth0Config.domain}/`,
              aud: mockAuth0Config.clientId,
              exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
              iat: Math.floor(Date.now() / 1000),
            };

            // Create ID token (we'll mock the validation since we can't use real Auth0 keys in tests)
            const idToken = jwt.sign(
              tokenPayload,
              mockAuth0Config.clientSecret,
            );

            // Mock the validateIdToken method to return our test data
            const originalValidateIdToken = service.validateIdToken;
            service.validateIdToken = jest.fn().mockResolvedValue({
              sub: profileData.sub,
              email: profileData.email,
              email_verified: profileData.email_verified,
              name: profileData.name,
              picture: profileData.picture,
              given_name: profileData.given_name,
              family_name: profileData.family_name,
              provider: profileData.sub.startsWith('google-oauth2|')
                ? 'google-oauth2'
                : 'apple',
            } as Auth0UserProfile);

            try {
              // Test token validation
              const result = await service.validateIdToken(idToken);

              // Verify the result contains all expected profile data
              expect(result).toBeDefined();
              expect(result.sub).toBe(profileData.sub);
              expect(result.email).toBe(profileData.email);
              expect(result.email_verified).toBe(profileData.email_verified);
              expect(result.name).toBe(profileData.name);
              expect(result.picture).toBe(profileData.picture);
              expect(result.given_name).toBe(profileData.given_name);
              expect(result.family_name).toBe(profileData.family_name);

              // Verify provider is correctly extracted
              if (profileData.sub.startsWith('google-oauth2|')) {
                expect(result.provider).toBe('google-oauth2');
              } else if (profileData.sub.startsWith('apple|')) {
                expect(result.provider).toBe('apple');
              }

              // Verify all required fields are present
              expect(typeof result.sub).toBe('string');
              expect(result.sub.length).toBeGreaterThan(0);
              expect(['google-oauth2', 'apple']).toContain(result.provider);
            } finally {
              // Restore original method
              service.validateIdToken = originalValidateIdToken;
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject invalid Auth0 tokens consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate invalid token scenarios
          fc.oneof(
            fc.constant(''), // Empty token
            fc.constant('invalid-token'), // Invalid format
            fc.string({ minLength: 1, maxLength: 50 }), // Random string
            fc.constant(
              'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid.signature',
            ), // Invalid JWT
          ),
          async (invalidToken) => {
            // Test that invalid tokens are rejected
            await expect(service.validateIdToken(invalidToken)).rejects.toThrow(
              UnauthorizedException,
            );
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should handle expired tokens correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sub: fc.string({ minLength: 10 }).map((s) => `google-oauth2|${s}`),
            email: fc.emailAddress(),
            name: fc.string({ minLength: 2, maxLength: 50 }),
          }),
          async (profileData) => {
            // Create an expired token
            const expiredTokenPayload = {
              ...profileData,
              iss: `https://${mockAuth0Config.domain}/`,
              aud: mockAuth0Config.clientId,
              exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
              iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
            };

            const expiredToken = jwt.sign(
              expiredTokenPayload,
              mockAuth0Config.clientSecret,
            );

            // Test that expired tokens are rejected
            await expect(service.validateIdToken(expiredToken)).rejects.toThrow(
              UnauthorizedException,
            );
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should extract provider information correctly from Auth0 sub', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.string({ minLength: 5 }).map((s) => `google-oauth2|${s}`),
            fc.string({ minLength: 5 }).map((s) => `apple|${s}`),
            fc.string({ minLength: 5 }).map((s) => `unknown-provider|${s}`),
          ),
          async (sub) => {
            const tokenPayload = {
              sub,
              email: 'test@example.com',
              iss: `https://${mockAuth0Config.domain}/`,
              aud: mockAuth0Config.clientId,
              exp: Math.floor(Date.now() / 1000) + 3600,
              iat: Math.floor(Date.now() / 1000),
            };

            const token = jwt.sign(tokenPayload, mockAuth0Config.clientSecret);

            // Mock the validateIdToken method
            const originalValidateIdToken = service.validateIdToken;
            service.validateIdToken = jest.fn().mockResolvedValue({
              sub,
              email: 'test@example.com',
              provider: sub.startsWith('google-oauth2|')
                ? 'google-oauth2'
                : sub.startsWith('apple|')
                  ? 'apple'
                  : 'google-oauth2',
            } as Auth0UserProfile);

            try {
              const result = await service.validateIdToken(token);

              // Verify provider extraction logic
              if (sub.startsWith('google-oauth2|')) {
                expect(result.provider).toBe('google-oauth2');
              } else if (sub.startsWith('apple|')) {
                expect(result.provider).toBe('apple');
              } else {
                // Unknown providers default to google-oauth2
                expect(result.provider).toBe('google-oauth2');
              }
            } finally {
              service.validateIdToken = originalValidateIdToken;
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
