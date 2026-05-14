import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CURRENCY_CODES,
  CurrencyCode,
  TRANSPORT_TYPES,
  TransportType,
} from '../../shared/constants/enums';

export class UpdateTripDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  destinationCountry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  destinationName?: string;

  @IsOptional()
  @IsLatitude()
  destinationLat?: number;

  @IsOptional()
  @IsLongitude()
  destinationLng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  mapboxPlaceId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @IsIn(TRANSPORT_TYPES)
  transport?: TransportType;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(50000)
  pricePerPerson?: number;

  @IsOptional()
  @IsIn(CURRENCY_CODES)
  currency?: CurrencyCode;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(100)
  maxMembers?: number;

  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  galleryUrls?: string[];
}
