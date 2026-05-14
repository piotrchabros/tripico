import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must be lowercase letters, digits, and hyphens only',
  })
  slug!: string;
}
