import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { User } from '@prisma/client';
import type { LoginInput, RegisterInput, UserDto } from '@dataroom/shared';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueConstraintViolation } from '../common/prisma-errors';

export interface AuthResult {
  user: UserDto;
  token: string;
}

const DEFAULT_ROOM_NAME = 'My Data Room';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });

    let user: User;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { email, passwordHash, name: input.name },
        });

        const room = await tx.dataRoom.create({
          data: { name: DEFAULT_ROOM_NAME, ownerId: created.id },
        });

        // The room's root FOLDER node: every other node in this room will
        // have a non-null parentId, ultimately tracing back to this one.
        const rootNode = await tx.node.create({
          data: {
            roomId: room.id,
            parentId: null,
            type: 'FOLDER',
            name: DEFAULT_ROOM_NAME,
          },
        });

        await tx.dataRoom.update({
          where: { id: room.id },
          data: { rootNodeId: rootNode.id },
        });

        // Someone may have shared a node with this email before this account
        // existed (ShareGrant.userId stays null until then) - claim those now.
        await tx.shareGrant.updateMany({
          where: { email, userId: null },
          data: { userId: created.id },
        });

        return created;
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }

    return { user: toUserDto(user), token: await this.signToken(user) };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const passwordMatches = user
      ? await argon2.verify(user.passwordHash, input.password)
      : false;

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return { user: toUserDto(user), token: await this.signToken(user) };
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return toUserDto(user);
  }

  private signToken(user: User): Promise<string> {
    return this.jwtService.signAsync({ sub: user.id, email: user.email });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toUserDto(user: User): UserDto {
  return { id: user.id, email: user.email, name: user.name };
}
