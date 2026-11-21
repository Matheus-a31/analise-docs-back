import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GoogleAuthDto {
  @ApiPropertyOptional({
    description: 'ID Token JWT retornado pelo componente Google Login (@react-oauth/google).',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2Nz...',
  })
  @IsOptional()
  @IsString()
  credential?: string;

  @ApiPropertyOptional({
    description: 'Access Token OAuth 2.0 retornado pelo fluxo implícito do Google.',
    example: 'ya29.a0AfH6SMC...',
  })
  @IsOptional()
  @IsString()
  accessToken?: string;
}

export class DevLoginDto {
  @ApiPropertyOptional({
    description: 'E-mail do perfil de demonstração (apenas ambiente de desenvolvimento).',
    example: 'mariana@silvagomes.com',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: 'Nome completo exibido na sidebar.',
    example: 'Dra. Mariana Gomes',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'URL da foto de perfil do usuário.',
    example: 'https://lh3.googleusercontent.com/a/avatar-example',
  })
  @IsOptional()
  @IsString()
  picture?: string;
}

export class UserProfileSwaggerDto {
  @ApiProperty({ example: '7b9e6c1a-4d2f-4e8a-9b3c-1234567890ab' })
  id!: string;

  @ApiProperty({ example: 'mariana@silvagomes.com' })
  email!: string;

  @ApiProperty({ example: 'Dra. Mariana Gomes' })
  name!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'https://lh3.googleusercontent.com/a/avatar-example',
  })
  picture!: string | null;
}

export class AuthResponseSwaggerDto {
  @ApiProperty({
    description: 'Token JWT Bearer para autenticar as requisições protegidas.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({ type: UserProfileSwaggerDto })
  user!: UserProfileSwaggerDto;
}
