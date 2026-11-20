import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthService, AuthResponse } from './auth.service';
import { GoogleAuthDto, DevLoginDto } from './dto/google-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() dto: GoogleAuthDto): Promise<AuthResponse> {
    return this.authService.authenticateWithGoogle(dto);
  }

  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  async devLogin(@Body() dto: DevLoginDto): Promise<AuthResponse> {
    return this.authService.authenticateDevUser(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<AuthenticatedUser> {
    return this.authService.getProfile(user.id);
  }
}
