# Location Management Service

This module provides location management functionality for the Good Citizen platform, allowing users to update and retrieve their location data.

## Features

- **Location Updates**: Store user location with geospatial indexing
- **Location Retrieval**: Get current and historical location data
- **Coordinate Validation**: Validate longitude/latitude coordinates
- **Multiple Location Sources**: Support GPS, network, and manual location sources
- **Geospatial Indexing**: Efficient location queries using MongoDB 2dsphere indexes

## API Endpoints

### POST /v1/location/update

Updates the user's current location.

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>`

**Request Body:**
```json
{
  "longitude": -122.4194,
  "latitude": 37.7749,
  "accuracy": 10,
  "source": "gps"
}
```

**Response:**
```json
{
  "message": "Location updated successfully",
  "status": "success"
}
```

### GET /v1/location/current

Retrieves the user's current (most recent) location.

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>`

**Query Parameters:**
- `userId` (optional): User ID to get location for (defaults to authenticated user)

**Response:**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "coordinates": {
    "type": "Point",
    "coordinates": [-122.4194, 37.7749]
  },
  "accuracy": 10,
  "timestamp": "2024-01-13T10:30:00.000Z",
  "source": "gps",
  "isActive": true
}
```

### GET /v1/location/history

Retrieves the user's location history.

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>`

**Query Parameters:**
- `userId` (optional): User ID to get history for (defaults to authenticated user)
- `limit` (optional): Number of records to return (default: 10, max: 100)

**Response:**
```json
[
  {
    "userId": "507f1f77bcf86cd799439011",
    "coordinates": {
      "type": "Point",
      "coordinates": [-122.4194, 37.7749]
    },
    "accuracy": 10,
    "timestamp": "2024-01-13T10:30:00.000Z",
    "source": "gps",
    "isActive": true
  }
]
```

## Data Models

### UserLocation

```typescript
interface UserLocation {
  userId: ObjectId;
  coordinates: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  accuracy: number;
  timestamp: Date;
  source: 'gps' | 'network' | 'manual';
  isActive: boolean;
  created_at: number;
  updated_at: number;
}
```

## Validation Rules

- **Longitude**: Must be between -180 and 180
- **Latitude**: Must be between -90 and 90
- **Accuracy**: Must be >= 0 (in meters)
- **Source**: Must be one of 'gps', 'network', or 'manual'

## Database Indexes

The UserLocation collection has the following indexes for optimal performance:

1. **Geospatial Index**: `coordinates: '2dsphere'` - for location-based queries
2. **User Query Index**: `{ userId: 1, timestamp: -1 }` - for user-specific location history
3. **Active Location Index**: `{ userId: 1, isActive: 1 }` - for current location queries

## Error Handling

The service provides comprehensive error handling:

- **400 Bad Request**: Invalid coordinates, missing required fields
- **401 Unauthorized**: Invalid or missing JWT token
- **404 Not Found**: No location found for user
- **500 Internal Server Error**: Database or server errors

## Requirements Validation

This implementation satisfies the following requirements:

- **4.4**: Location updates are sent to the Backend_API via WebSocket (handled by controller)
- **4.5**: Backend_API persists location updates and provides last known location when requested

## Usage Example

```typescript
// Update location
const locationData = {
  longitude: -122.4194,
  latitude: 37.7749,
  accuracy: 10,
  source: 'gps'
};

await fetch('/v1/location/update', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(locationData)
});

// Get current location
const response = await fetch('/v1/location/current', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
});
const currentLocation = await response.json();
```