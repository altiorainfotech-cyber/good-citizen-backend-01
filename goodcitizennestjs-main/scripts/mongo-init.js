// MongoDB initialization script for production
db = db.getSiblingDB('goodcitizen');

// Create application user
db.createUser({
  user: 'app_user',
  pwd: process.env.MONGO_APP_PASSWORD || 'secure_app_password',
  roles: [
    {
      role: 'readWrite',
      db: 'goodcitizen'
    }
  ]
});

// Create indexes for optimal performance
print('Creating indexes...');

// User collection indexes
db.users.createIndex({ email: 1 }, { unique: true, sparse: true });
db.users.createIndex({ phone_number: 1, country_code: 1 }, { unique: true, sparse: true });
db.users.createIndex({ location: '2dsphere' });
db.users.createIndex({ is_online: 1, role: 1 });
db.users.createIndex({ approval: 1, role: 1 });

// Ride collection indexes
db.rides.createIndex({ user_id: 1, created_at: -1 });
db.rides.createIndex({ driver_id: 1, status: 1 });
db.rides.createIndex({ status: 1, vehicle_type: 1 });
db.rides.createIndex({ created_at: -1 });
db.rides.createIndex({ 
  'pickup_location.latitude': 1, 
  'pickup_location.longitude': 1 
});

// Session collection indexes
db.sessions.createIndex({ user_id: 1, is_active: 1 });
db.sessions.createIndex({ access_token: 1 });
db.sessions.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Notification collection indexes
db.notifications.createIndex({ user_id: 1, status: 1, created_at: -1 });
db.notifications.createIndex({ type: 1, created_at: -1 });

// Loyalty points collection indexes
db.loyaltypoints.createIndex({ user_id: 1 });
db.loyaltypoints.createIndex({ incident_id: 1 }, { unique: true, sparse: true });

print('Indexes created successfully');

// Create initial admin user if it doesn't exist
const adminExists = db.users.findOne({ email: 'admin@goodcitizen.com' });
if (!adminExists) {
  db.users.insertOne({
    first_name: 'System',
    last_name: 'Admin',
    email: 'admin@goodcitizen.com',
    password: '$2b$10$encrypted_password_hash', // This should be properly hashed
    role: 'ADMIN',
    is_email_verified: true,
    is_online: false,
    is_deleted: false,
    loyalty_points: 0,
    created_at: Date.now(),
    updated_at: Date.now()
  });
  print('Admin user created');
}

print('MongoDB initialization completed');