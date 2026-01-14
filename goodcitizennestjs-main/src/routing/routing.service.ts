import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RouteRequestDto, PlaceSearchDto, PlaceDetailsDto, GeocodeDto, CoordinatesDto } from './dto/route-request.dto';

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private readonly googleApiKey: string;

  constructor(private configService: ConfigService) {
    this.googleApiKey = this.configService.get<string>('GOOGLE_API_KEY') || '';
    if (!this.googleApiKey) {
      this.logger.warn('Google API Key not configured. Routing features will use fallback mode.');
    }
  }

  /**
   * Get optimized route using Google Directions API
   */
  async getOptimizedRoute(routeRequest: RouteRequestDto) {
    try {
      if (!this.googleApiKey) {
        return this.createFallbackRoute(routeRequest.origin, routeRequest.destination);
      }

      const { origin, destination, mode, alternatives, avoidTolls, avoidHighways, avoidFerries, trafficModel, departureTime } = routeRequest;

      // Build API URL
      const params = new URLSearchParams({
        origin: `${origin.latitude},${origin.longitude}`,
        destination: `${destination.latitude},${destination.longitude}`,
        mode: mode || 'driving',
        alternatives: String(alternatives !== false),
        key: this.googleApiKey,
        departure_time: departureTime || 'now',
        traffic_model: trafficModel || 'best_guess',
      });

      // Add avoidance parameters
      const avoid: string[] = [];
      if (avoidTolls) avoid.push('tolls');
      if (avoidHighways) avoid.push('highways');
      if (avoidFerries) avoid.push('ferries');
      if (avoid.length > 0) {
        params.append('avoid', avoid.join('|'));
      }

      const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        this.logger.warn(`Google Directions API error: ${data.status}`);
        return this.createFallbackRoute(origin, destination);
      }

      // Parse routes
      const routes = data.routes.map((route: any, index: number) => {
        const leg = route.legs[0];
        const coordinates = this.decodePolyline(route.overview_polyline.points);

        return {
          id: index,
          coordinates,
          distance: leg.distance.text,
          distanceValue: leg.distance.value,
          duration: leg.duration.text,
          durationValue: leg.duration.value,
          durationInTraffic: leg.duration_in_traffic ? leg.duration_in_traffic.text : leg.duration.text,
          durationInTrafficValue: leg.duration_in_traffic ? leg.duration_in_traffic.value : leg.duration.value,
          startAddress: leg.start_address,
          endAddress: leg.end_address,
          steps: leg.steps.map((step: any) => ({
            instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
            distance: step.distance.text,
            duration: step.duration.text,
            maneuver: step.maneuver || 'straight',
            coordinates: this.decodePolyline(step.polyline.points),
          })),
          summary: route.summary,
          warnings: route.warnings || [],
          waypointOrder: route.waypoint_order || [],
          bounds: route.bounds,
        };
      });

      return {
        success: true,
        routes,
        primaryRoute: routes[0],
        alternativeRoutes: routes.slice(1),
      };
    } catch (error) {
      this.logger.error('Error fetching route:', error);
      return this.createFallbackRoute(routeRequest.origin, routeRequest.destination);
    }
  }

  /**
   * Search places using Google Places Autocomplete API
   */
  async searchPlaces(searchDto: PlaceSearchDto) {
    try {
      if (!this.googleApiKey) {
        return this.getMockPlaces(searchDto.query);
      }

      const { query, location } = searchDto;
      let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${this.googleApiKey}`;

      if (location) {
        url += `&location=${location.latitude},${location.longitude}&radius=50000`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        return {
          success: true,
          suggestions: data.predictions.map((prediction: any) => ({
            description: prediction.description,
            placeId: prediction.place_id,
            mainText: prediction.structured_formatting.main_text,
            secondaryText: prediction.structured_formatting.secondary_text,
          })),
        };
      }

      return this.getMockPlaces(query);
    } catch (error) {
      this.logger.error('Error searching places:', error);
      return this.getMockPlaces(searchDto.query);
    }
  }

  /**
   * Get place details from place ID
   */
  async getPlaceDetails(detailsDto: PlaceDetailsDto) {
    try {
      if (!this.googleApiKey) {
        throw new HttpException('Google API Key not configured', HttpStatus.SERVICE_UNAVAILABLE);
      }

      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${detailsDto.placeId}&fields=geometry,formatted_address,name&key=${this.googleApiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        return {
          success: true,
          coordinates: {
            latitude: data.result.geometry.location.lat,
            longitude: data.result.geometry.location.lng,
          },
          formattedAddress: data.result.formatted_address,
          name: data.result.name,
        };
      }

      throw new HttpException('Place not found', HttpStatus.NOT_FOUND);
    } catch (error) {
      this.logger.error('Error getting place details:', error);
      throw new HttpException('Failed to get place details', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Geocode an address to coordinates
   */
  async geocodeAddress(geocodeDto: GeocodeDto) {
    try {
      if (!this.googleApiKey) {
        throw new HttpException('Google API Key not configured', HttpStatus.SERVICE_UNAVAILABLE);
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(geocodeDto.address)}&key=${this.googleApiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        return {
          success: true,
          coordinates: {
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng,
          },
          formattedAddress: result.formatted_address,
          placeId: result.place_id,
        };
      }

      throw new HttpException('Address not found', HttpStatus.NOT_FOUND);
    } catch (error) {
      this.logger.error('Geocoding error:', error);
      throw new HttpException('Failed to geocode address', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Decode Google Maps polyline encoding
   */
  private decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
    const points: Array<{ latitude: number; longitude: number }> = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  }

  /**
   * Create fallback route when API is unavailable
   */
  private createFallbackRoute(origin: CoordinatesDto, destination: CoordinatesDto) {
    const coordinates = this.generateIntermediatePoints(origin, destination, 5);
    const distance = this.calculateDistance(origin, destination);
    const duration = Math.round((distance / 40) * 60); // Assume 40 km/h average speed

    return {
      success: false,
      fallback: true,
      routes: [
        {
          id: 0,
          coordinates,
          distance: `${distance.toFixed(1)} km`,
          distanceValue: distance * 1000,
          duration: `${duration} min`,
          durationValue: duration * 60,
          durationInTraffic: `${duration} min`,
          durationInTrafficValue: duration * 60,
          startAddress: 'Origin',
          endAddress: 'Destination',
          steps: [
            {
              instruction: 'Head towards destination',
              distance: `${distance.toFixed(1)} km`,
              duration: `${duration} min`,
              maneuver: 'straight',
              coordinates,
            },
          ],
          summary: 'Direct route (estimated)',
          warnings: ['Using estimated route - Google Maps API not available'],
          waypointOrder: [],
          bounds: null,
        },
      ],
      primaryRoute: null,
      alternativeRoutes: [],
    };
  }

  /**
   * Generate intermediate points between origin and destination
   */
  private generateIntermediatePoints(start: CoordinatesDto, end: CoordinatesDto, numPoints = 5): CoordinatesDto[] {
    const points: CoordinatesDto[] = [start];

    for (let i = 1; i < numPoints; i++) {
      const ratio = i / numPoints;
      points.push({
        latitude: start.latitude + (end.latitude - start.latitude) * ratio,
        longitude: start.longitude + (end.longitude - start.longitude) * ratio,
      });
    }

    points.push(end);
    return points;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(coord1: CoordinatesDto, coord2: CoordinatesDto): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(coord2.latitude - coord1.latitude);
    const dLon = this.toRad(coord2.longitude - coord1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(coord1.latitude)) *
        Math.cos(this.toRad(coord2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get mock places for fallback
   */
  private getMockPlaces(query: string) {
    const allPlaces = [
      { description: 'Mohali Hospital, Punjab', placeId: 'mock_1', mainText: 'Mohali Hospital', secondaryText: 'Punjab' },
      { description: 'Delhi AIIMS, Delhi', placeId: 'mock_2', mainText: 'Delhi AIIMS', secondaryText: 'Delhi' },
      { description: 'Mumbai Central Hospital, Mumbai', placeId: 'mock_3', mainText: 'Mumbai Central Hospital', secondaryText: 'Mumbai' },
      { description: 'Bangalore Medical Center, Bangalore', placeId: 'mock_4', mainText: 'Bangalore Medical Center', secondaryText: 'Bangalore' },
      { description: 'Chennai Apollo, Chennai', placeId: 'mock_5', mainText: 'Chennai Apollo', secondaryText: 'Chennai' },
      { description: 'Sector 14 Clinic, Mohali', placeId: 'mock_6', mainText: 'Sector 14 Clinic', secondaryText: 'Mohali' },
      { description: 'Phase 7 Hospital, Mohali', placeId: 'mock_7', mainText: 'Phase 7 Hospital', secondaryText: 'Mohali' },
      { description: 'Chandigarh PGI, Chandigarh', placeId: 'mock_8', mainText: 'Chandigarh PGI', secondaryText: 'Chandigarh' },
    ];

    const filtered = allPlaces.filter((place) => place.description.toLowerCase().includes(query.toLowerCase()));

    return {
      success: true,
      suggestions: filtered,
    };
  }
}
