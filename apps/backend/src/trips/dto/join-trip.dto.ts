import { IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinTripDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  requestMessage?: string;
}
