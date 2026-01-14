import { Types } from 'mongoose';

export enum UserType {
  USER = 'USER',
  ADMIN = 'ADMIN',
  DRIVER = 'DRIVER',
}

export enum Device_TYPE {
  WEB = 'WEB',
  IOS = 'IOS',
  ANDROID = 'ANDROID',
}

export enum RideStatus {
  REQUESTED = 'requested',
  DRIVER_ASSIGNED = 'driver_assigned',
  DRIVER_ARRIVING = 'driver_arriving',
  DRIVER_ARRIVED = 'driver_arrived',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum DIRECTION {
  NORTH = 'NORTH',
  NORTH_EAST = 'NORTH_EAST',
  EAST = 'EAST',
  SOUTH_EAST = 'SOUTH_EAST',
  SOUTH = 'SOUTH',
  SOUTH_WEST = 'SOUTH_WEST',
  WEST = 'WEST',
  NORTH_WEST = 'NORTH_WEST',
}

export interface Query {
  [key: string]: string | boolean | Types.ObjectId;
}

export interface Update {
  [key: string]: any;
}

export interface locationNow {
  long: number;
  lat: number;
}

export enum DriverApproval {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ContentType {
  ABOUT_US = 'ABOUT_US',
  PRIVACY_POLICY = 'PRIVACY_POLICY',
  TERMS_AND_CONDITIONS = 'TERMS_AND_CONDITIONS',
}
