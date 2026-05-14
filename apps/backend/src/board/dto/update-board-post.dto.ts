import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateBoardPostDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text?: string;
}
