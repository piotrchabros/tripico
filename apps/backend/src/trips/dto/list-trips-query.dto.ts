import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TRIP_STATUSES, TripStatus } from '../../shared/constants/enums';

export class ListTripsQueryDto {
  @IsOptional()
  @IsIn(TRIP_STATUSES)
  status?: TripStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
