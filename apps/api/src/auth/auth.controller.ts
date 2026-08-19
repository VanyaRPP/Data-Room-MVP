import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
  type UserDto,
} from '@dataroom/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { CurrentUser, Public, type RequestUser } from './decorators';
import { clearSessionCookie, setSessionCookie } from './session-cookie';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body(zodPipe(registerSchema)) body: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserDto> {
    const { user, token } = await this.authService.register(body);
    setSessionCookie(res, token);
    return user;
  }

  @Public()
  @Post('login')
  async login(
    @Body(zodPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserDto> {
    const { user, token } = await this.authService.login(body);
    setSessionCookie(res, token);
    return user;
  }

  // Public so a present-but-expired/invalid cookie can still be cleared -
  // the whole point of logout is to get rid of it, not to require it to
  // still be valid first.
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    clearSessionCookie(res);
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser): Promise<UserDto> {
    return this.authService.me(user.id);
  }
}
