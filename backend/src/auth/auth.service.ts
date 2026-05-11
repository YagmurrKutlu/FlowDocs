import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcryptjs';
import type { StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async login(payload: LoginDto) {
    const email = payload.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await compare(payload.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const safeUser = this.toAuthenticatedUser(user);
    const token = await this.signToken(safeUser);

    return {
      user: safeUser,
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: this.configService.getOrThrow<string>('auth.jwtExpiresIn'),
    };
  }

  async register(payload: RegisterDto) {
    const email = payload.email.trim().toLowerCase();
    const fullName = payload.fullName.trim();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await hash(payload.password, 12);
    const createdUser = await this.prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash,
      },
    });
    const safeUser = this.toAuthenticatedUser(createdUser);
    const token = await this.signToken(safeUser);

    return {
      user: safeUser,
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: this.configService.getOrThrow<string>('auth.jwtExpiresIn'),
    };
  }

  private async signToken(user: AuthenticatedUser): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
      },
      {
        expiresIn: this.configService.getOrThrow<string>(
          'auth.jwtExpiresIn',
        ) as StringValue,
      },
    );
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
    };
  }
}
