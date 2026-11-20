import { IsOptional, IsString } from 'class-validator';

export class GoogleAuthDto {
  @IsOptional()
  @IsString()
  credential?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;
}

export class DevLoginDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  picture?: string;
}
