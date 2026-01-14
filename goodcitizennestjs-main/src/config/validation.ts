import Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'testing')
    .default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),

  // JWT Configuration
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRY: Joi.string().default('1d'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),
  TEMP_JWT_ACCESS_SECRET: Joi.string().required(),
  TEMP_JWT_ACCESS_EXPIRY: Joi.string().default('1m'),
  VERIFICATION_JWT_SECRET: Joi.string().required(),
  VERIFICATION_JWT_EXPIRY: Joi.string().default('1m'),

  // Auth0 Configuration
  AUTH0_DOMAIN: Joi.string().required(),
  AUTH0_CLIENT_ID: Joi.string().required(),
  AUTH0_CLIENT_SECRET: Joi.string().required(),
  AUTH0_AUDIENCE: Joi.string().required(),

  // Google API
  GOOGLE_API_KEY: Joi.string().required(),

  // Firebase Configuration
  PROJECT_ID: Joi.string().required(),
  CLIENT_EMAIL: Joi.string().email().required(),
  PRIVATE_KEY: Joi.string().required(),

  // Performance Configuration
  MAX_CONCURRENT_REQUESTS: Joi.number().default(1000),
  WEBSOCKET_MAX_CONNECTIONS: Joi.number().default(500),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),

  // Testing Configuration
  PBT_NUM_RUNS: Joi.number().default(100),
  PBT_SEED: Joi.number().default(42),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
});
