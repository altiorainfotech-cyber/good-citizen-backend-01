export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    tempAccessSecret: process.env.TEMP_JWT_ACCESS_SECRET,
    tempAccessExpiry: process.env.TEMP_JWT_ACCESS_EXPIRY || '1m',
    verificationSecret: process.env.VERIFICATION_JWT_SECRET,
    verificationExpiry: process.env.VERIFICATION_JWT_EXPIRY || '1m',
  },
  auth0: {
    domain: process.env.AUTH0_DOMAIN,
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    audience: process.env.AUTH0_AUDIENCE,
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY,
  },
  firebase: {
    projectId: process.env.PROJECT_ID,
    clientEmail: process.env.CLIENT_EMAIL,
    privateKey: process.env.PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  performance: {
    maxConcurrentRequests: parseInt(
      process.env.MAX_CONCURRENT_REQUESTS || '1000',
      10,
    ),
    websocketMaxConnections: parseInt(
      process.env.WEBSOCKET_MAX_CONNECTIONS || '500',
      10,
    ),
    rateLimitWindowMs: parseInt(
      process.env.RATE_LIMIT_WINDOW_MS || '900000',
      10,
    ),
    rateLimitMaxRequests: parseInt(
      process.env.RATE_LIMIT_MAX_REQUESTS || '100',
      10,
    ),
  },
  testing: {
    pbtNumRuns: parseInt(process.env.PBT_NUM_RUNS || '100', 10),
    pbtSeed: parseInt(process.env.PBT_SEED || '42', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
});
