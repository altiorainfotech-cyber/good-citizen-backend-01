import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { RouteRequestDto, PlaceSearchDto, PlaceDetailsDto, GeocodeDto } from './dto/route-request.dto';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';

@Controller('v1/routing')
@UseGuards(JwtAuthGuard)
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post('calculate-route')
  async calculateRoute(@Body() routeRequest: RouteRequestDto) {
    return this.routingService.getOptimizedRoute(routeRequest);
  }

  @Post('search-places')
  async searchPlaces(@Body() searchDto: PlaceSearchDto) {
    return this.routingService.searchPlaces(searchDto);
  }

  @Get('place-details')
  async getPlaceDetails(@Query() detailsDto: PlaceDetailsDto) {
    return this.routingService.getPlaceDetails(detailsDto);
  }

  @Post('geocode')
  async geocodeAddress(@Body() geocodeDto: GeocodeDto) {
    return this.routingService.geocodeAddress(geocodeDto);
  }
}
