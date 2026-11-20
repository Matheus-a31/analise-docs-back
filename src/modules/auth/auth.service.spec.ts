import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: {
    user: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let jwtService: { sign: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    prismaService = {
      user: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-jwt-token'),
    };
    configService = {
      get: jest.fn((key: string, defaultVal?: string) => {
        const map: Record<string, string> = {
          NODE_ENV: 'development',
          ENABLE_DEV_LOGIN: 'true',
          GOOGLE_CLIENT_ID: 'test-google-client-id',
        };
        return map[key] ?? defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('deve autenticar usuário de desenvolvimento quando ENABLE_DEV_LOGIN=true', async () => {
    prismaService.user.upsert.mockResolvedValue({
      id: 'user-uuid-1',
      email: 'mariana@silvagomes.com',
      name: 'Dra. Mariana Gomes',
      picture: 'https://avatar.url/mariana.jpg',
    });

    const result = await authService.authenticateDevUser({});

    expect(result.accessToken).toBe('signed-jwt-token');
    expect(result.user.name).toBe('Dra. Mariana Gomes');
    expect(result.user.email).toBe('mariana@silvagomes.com');
  });

  it('deve bloquear dev-login quando NODE_ENV=production', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      return 'true';
    });

    await expect(authService.authenticateDevUser({})).rejects.toThrow(ForbiddenException);
  });

  it('deve exigir credential ou accessToken no login com Google', async () => {
    await expect(authService.authenticateWithGoogle({})).rejects.toThrow(BadRequestException);
  });
});
