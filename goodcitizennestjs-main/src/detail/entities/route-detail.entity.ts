import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RouteDetailDocument = RouteDetail & Document;

@Schema({ timestamps: true })
export class RouteDetail {
  @Prop({ required: true })
  routeId: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  origin: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  destination: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };

  @Prop({
    type: [
      {
        type: {
          type: String,
          enum: ['Point'],
          required: true,
        },
        coordinates: {
          type: [Number],
          required: true,
        },
      },
    ],
    default: [],
  })
  waypoints: Array<{
    type: 'Point';
    coordinates: [number, number];
  }>;

  @Prop({
    type: [
      {
        instruction: String,
        distance: Number,
        duration: Number,
        maneuver: String,
        coordinates: {
          type: {
            type: String,
            enum: ['Point'],
            required: true,
          },
          coordinates: {
            type: [Number],
            required: true,
          },
        },
      },
    ],
    default: [],
  })
  instructions: Array<{
    instruction: string;
    distance: number;
    duration: number;
    maneuver: string;
    coordinates: {
      type: 'Point';
      coordinates: [number, number];
    };
  }>;

  @Prop({ required: true })
  estimatedTime: number; // in minutes

  @Prop({ required: true })
  distance: number; // in kilometers

  @Prop({ enum: ['light', 'moderate', 'heavy'], default: 'light' })
  trafficConditions: string;

  @Prop({ enum: ['fastest', 'shortest', 'avoid_tolls'], default: 'fastest' })
  routeType: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: true })
  isActive: boolean;
}

export const RouteDetailSchema = SchemaFactory.createForClass(RouteDetail);

// Create geospatial indexes
RouteDetailSchema.index({ 'origin.coordinates': '2dsphere' });
RouteDetailSchema.index({ 'destination.coordinates': '2dsphere' });
RouteDetailSchema.index({ 'waypoints.coordinates': '2dsphere' });
