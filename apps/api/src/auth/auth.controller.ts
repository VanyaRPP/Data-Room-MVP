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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  apiErrorShape,
  loginSchema,
  registerSchema,
  userDtoSchema,
  type LoginInput,
  type RegisterInput,
  type UserDto,
} from '@dataroom/shared';
import { ApiZodBody, ApiZodResponse } from '../common/api-docs';
import { zodPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { CurrentUser, Public, type RequestUser } from './decorators';
import { clearSessionCookie, setSessionCookie } from './session-cookie';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Create an account',
    description:
      'Also creates the data room and its root folder, and claims any shares ' +
      'already granted to this email address. Sets the session cookie.',
  })
  @ApiZodBody(registerSchema)
  @ApiZodResponse(201, userDtoSchema, 'Account created and signed in')
  @ApiZodResponse(409, apiErrorShape, 'That email is already registered')
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
  @ApiOperation({ summary: 'Sign in and receive the session cookie' })
  @ApiZodBody(loginSchema)
  @ApiZodResponse(201, userDtoSchema, 'Signed in')
  @ApiZodResponse(401, apiErrorShape, 'Wrong email or password')
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
  @ApiOperation({ summary: 'Clear the session cookie' })
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    clearSessionCookie(res);
    return { success: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'The signed-in user' })
  @ApiZodResponse(200, userDtoSchema, 'The current user')
  me(@CurrentUser() user: RequestUser): Promise<UserDto> {
    return this.authService.me(user.id);
  }
}
