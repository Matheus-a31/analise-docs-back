import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AuthService, AuthResponse } from './auth.service';
import {
  AuthResponseSwaggerDto,
  DevLoginDto,
  GoogleAuthDto,
  UserProfileSwaggerDto,
} from './dto/google-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autenticar com Google OAuth 2.0',
    description:
      'Valida o ID Token (`credential`) ou `accessToken` emitido pelo Google, cria ou atualiza o perfil do usuário (foto, nome e e-mail) no PostgreSQL e retorna um JWT da aplicação.',
  })
  @ApiOkResponse({
    description: 'Usuário autenticado com sucesso.',
    type: AuthResponseSwaggerDto,
  })
  @ApiBadRequestResponse({
    description: 'Nenhum token (`credential` ou `accessToken`) informado.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token do Google inválido ou expirado.',
  })
  async googleLogin(@Body() dto: GoogleAuthDto): Promise<AuthResponse> {
    return this.authService.authenticateWithGoogle(dto);
  }

  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login rápido de desenvolvimento (desabilitado em produção)',
    description:
      'Disponível apenas quando `NODE_ENV !== production` e `ENABLE_DEV_LOGIN=true`, criando uma sessão JWT de demonstração.',
  })
  @ApiOkResponse({
    description: 'Sessão de desenvolvimento iniciada.',
    type: AuthResponseSwaggerDto,
  })
  @ApiForbiddenResponse({
    description: 'Login de desenvolvimento desabilitado neste ambiente.',
  })
  async devLogin(@Body() dto: DevLoginDto): Promise<AuthResponse> {
    return this.authService.authenticateDevUser(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obter perfil do usuário autenticado',
    description:
      'Retorna os dados sincronizados da conta Google (foto, nome e e-mail) para exibição na sidebar.',
  })
  @ApiOkResponse({
    description: 'Perfil do usuário retornado com sucesso.',
    type: UserProfileSwaggerDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token JWT ausente, inválido ou expirado.',
  })
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<AuthenticatedUser> {
    return this.authService.getProfile(user.id);
  }
}
