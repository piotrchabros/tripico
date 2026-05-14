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

export class CreateTripDto {
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @IsString()
  @Length(2, 2)
  destinationCountry!: string;

  @IsString()
  @MaxLength(200)
  destinationName!: string;

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

  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @IsIn(TRANSPORT_TYPES)
  transport!: TransportType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(50000)
  pricePerPerson!: number;

  @IsOptional()
  @IsIn(CURRENCY_CODES)
  currency?: CurrencyCode;

  @IsInt()
  @Min(2)
  @Max(100)
  maxMembers!: number;

  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  galleryUrls?: string[];
}
