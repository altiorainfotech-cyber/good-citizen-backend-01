/* eslint-disable @typescript-eslint/no-unused-vars */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { DriverApproval } from '../../common/utils';

export class Approval {
  @ApiProperty({})
  @IsNotEmpty({ message: 'approval status is required' })
  @IsString()
  @IsEnum(DriverApproval)
  approval: string;

  @ApiProperty({
    description: 'Reason for rejection (required when rejecting)',
  })
  @IsOptional()
  @IsString()
  rejection_reason?: string;
}
