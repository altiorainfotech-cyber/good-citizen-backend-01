# Localization Module

This module provides comprehensive localization and internationalization support for the ride-hailing backend system.

## Features

### 1. User Preferences Management
- Language preference storage and retrieval
- Regional settings (timezone, currency, date format)
- Unit system preferences (metric/imperial)
- Notification preferences by language

### 2. Localized Content Delivery
- Multi-language content storage
- Automatic fallback to default language/region
- Content categorization (general, notification, error, emergency)
- Variable substitution in content

### 3. Regional Configuration
- Currency formatting and conversion
- Emergency contact information by region
- Regional pricing configurations
- Address formatting by region
- Timezone handling and date formatting

## Supported Languages
- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Hindi (hi)
- Chinese (zh)
- Japanese (ja)
- Korean (ko)
- Arabic (ar)

## Supported Regions
- United States (US)
- Canada (CA)
- United Kingdom (GB)
- France (FR)
- Germany (DE)
- Italy (IT)
- Spain (ES)
- Portugal (PT)
- India (IN)
- China (CN)
- Japan (JP)
- Korea (KR)
- Australia (AU)
- Brazil (BR)
- Mexico (MX)

## API Endpoints

### User Preferences
- `GET /localization/preferences` - Get user preferences
- `PUT /localization/preferences` - Update user preferences

### Localized Content
- `GET /localization/content/:contentKey` - Get localized content
- `POST /localization/content/batch` - Get multiple localized contents
- `GET /localization/content/user/:userId` - Get localized content for user
- `POST /localization/content` - Create localized content (Admin only)
- `PUT /localization/content/:contentKey/:language/:region` - Update content (Admin only)
- `DELETE /localization/content/:contentKey/:language/:region` - Delete content (Admin only)

### Regional Configuration
- `GET /localization/regions` - Get all regional configurations
- `GET /localization/regions/:regionCode` - Get specific regional configuration
- `POST /localization/regions` - Create regional configuration (Admin only)
- `PUT /localization/regions/:regionCode` - Update regional configuration (Admin only)

### Regional Customization
- `GET /localization/regional/currency/format` - Format currency for region
- `GET /localization/regional/currency/format/user` - Format currency for user
- `GET /localization/regional/emergency-contacts/:regionCode` - Get emergency contacts
- `GET /localization/regional/emergency-contacts/user/current` - Get user's emergency contacts
- `GET /localization/regional/pricing/:regionCode` - Get regional pricing
- `GET /localization/regional/pricing/user/current` - Get user's regional pricing
- `GET /localization/regional/distance/convert` - Convert distance units
- `GET /localization/regional/distance/convert/user` - Convert distance for user

### Utility Endpoints
- `GET /localization/format/currency` - Format currency amount
- `GET /localization/format/date` - Format date

## Usage Examples

### Getting User Preferences
```javascript
GET /localization/preferences
Authorization: Bearer <jwt_token>

Response:
{
  "user_id": "507f1f77bcf86cd799439011",
  "language": "en",
  "region": "US",
  "timezone": "America/New_York",
  "currency": "USD",
  "date_format": "MM/DD/YYYY",
  "time_format": "12",
  "unit_system": "imperial",
  "notification_preferences": {
    "language": "en",
    "emergency_alerts": true,
    "ride_updates": true,
    "promotional": false
  }
}
```

### Getting Localized Content
```javascript
GET /localization/content/welcome_message?language=es&region=US

Response:
{
  "content_key": "welcome_message",
  "language": "es",
  "region": "US",
  "content": "¡Bienvenido a Good Citizen!",
  "content_type": "text",
  "category": "general"
}
```

### Getting Emergency Contacts
```javascript
GET /localization/regional/emergency-contacts/IN

Response:
{
  "region_code": "IN",
  "region_name": "India",
  "contacts": {
    "police": "100",
    "fire": "101",
    "ambulance": "108",
    "general_emergency": "112"
  }
}
```

### Formatting Currency
```javascript
GET /localization/regional/currency/format?amount=25.50&region=IN&language=hi

Response:
{
  "amount": 25.50,
  "formatted": "₹25.50",
  "currency_code": "INR",
  "currency_symbol": "₹"
}
```

## Database Collections

### user_preferences
Stores user-specific localization preferences.

### localized_contents
Stores localized content for different languages and regions.

### regional_configs
Stores regional configuration including currency, emergency contacts, and pricing.

## Middleware and Interceptors

### LocalizationMiddleware
Automatically detects user's language and region from request headers.

### LocalizationInterceptor
Automatically localizes API responses based on user preferences.

## Utilities

### LocalizationUtils
Provides utility methods for:
- Notification localization
- Error message localization
- Ride information localization
- Emergency alert localization
- Batch content localization

## Seeding Data

Use `LocalizationSeeder` to populate initial regional configurations and localized content:

```javascript
const seeder = new LocalizationSeeder();
await seeder.seedAll();
```

## Requirements Fulfilled

This implementation fulfills the following requirements:

### Requirement 18.1: Language Preference Storage
- ✅ User language preferences stored and retrieved
- ✅ Localized content delivery based on preferences

### Requirement 18.3: Regional Configuration
- ✅ Regional settings management
- ✅ Currency and timezone configuration

### Requirement 18.4: Currency Formatting
- ✅ Regional currency formatting
- ✅ Multi-currency support

### Requirement 18.5: Timezone Handling
- ✅ Timezone-aware date formatting
- ✅ Regional date format preferences

### Requirement 18.6: Emergency Contact Information
- ✅ Region-specific emergency contacts
- ✅ Emergency contact retrieval by region