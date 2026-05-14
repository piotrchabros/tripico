import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  BOARD_POST_TYPES,
  BoardPostType,
} from '../../shared/constants/enums';

export class CreateBoardPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text!: string;

  @IsOptional()
  @IsIn(BOARD_POST_TYPES)
  type?: BoardPostType;
}
