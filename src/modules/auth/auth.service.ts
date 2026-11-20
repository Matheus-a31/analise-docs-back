import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleAuthDto, DevLoginDto } from './dto/google-auth.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

export interface AuthResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;
  private readonly googleClientId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID', '');
    this.googleClient = new OAuth2Client(this.googleClientId);
  }

  async authenticateWithGoogle(dto: GoogleAuthDto): Promise<AuthResponse> {
    if (!dto.credential && !dto.accessToken) {
      throw new BadRequestException(
        'É necessário informar o token de credencial (credential) ou accessToken do Google OAuth.',
      );
    }

    const googleProfile = dto.credential
      ? await this.verifyGoogleIdToken(dto.credential)
      : await this.verifyGoogleAccessToken(dto.accessToken!);

    const user = await this.prisma.user.upsert({
      where: { email: googleProfile.email },
      update: {
        name: googleProfile.name,
        picture: googleProfile.picture ?? null,
        googleId: googleProfile.sub,
      },
      create: {
        email: googleProfile.email,
        name: googleProfile.name,
        picture: googleProfile.picture ?? null,
        googleId: googleProfile.sub,
      },
    });

    return this.buildAuthResponse(user);
  }

  async authenticateDevUser(dto?: DevLoginDto): Promise<AuthResponse> {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const enableDevLogin = this.configService.get<string>('ENABLE_DEV_LOGIN', 'false') === 'true';

    if (nodeEnv === 'production' || !enableDevLogin) {
      throw new ForbiddenException('Login de desenvolvimento está desabilitado neste ambiente.');
    }

    const email = dto?.email || 'mariana@silvagomes.com';
    const name = dto?.name || 'Dra. Mariana Gomes';
    const picture =
      dto?.picture ||
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80';

    const user = await this.prisma.user.upsert({
      where: { email },
      update: { name, picture },
      create: {
        email,
        name,
        picture,
        googleId: `dev-google-${email}`,
      },
    });

    return this.buildAuthResponse(user);
  }

  async getProfile(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    };
  }

  private async verifyGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.googleClientId || undefined,
      });
      const payload = ticket.getPayload();

      if (!payload || !payload.sub || !payload.email) {
        throw new UnauthorizedException('Token do Google não contém informações de perfil válidas.');
      }

      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        picture: payload.picture,
      };
    } catch (error) {
      this.logger.warn('Falha ao validar ID Token do Google:', error);
      throw new UnauthorizedException('Credencial do Google inválida ou expirada.');
    }
  }

  private async verifyGoogleAccessToken(accessToken: string): Promise<GoogleUserInfo> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new UnauthorizedException('Access Token do Google inválido ou expirado.');
      }

      const data = (await response.json()) as Partial<GoogleUserInfo>;
      if (!data.sub || !data.email) {
        throw new UnauthorizedException('Não foi possível obter o e-mail da conta Google.');
      }

      return {
        sub: data.sub,
        email: data.email,
        name: data.name || data.email.split('@')[0],
        picture: data.picture,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn('Falha ao consultar userinfo do Google OAuth:', error);
      throw new UnauthorizedException('Falha ao autenticar com o Google OAuth.');
    }
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
    name: string;
    picture: string | null;
  }): AuthResponse {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    };
  }
}
