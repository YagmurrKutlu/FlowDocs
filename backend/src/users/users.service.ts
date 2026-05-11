import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(userId: string, payload: UpdateProfileDto) {
    const data: { fullName?: string; avatarUrl?: string | null } = {};

    if (payload.fullName !== undefined) {
      data.fullName = payload.fullName.trim();
    }

    if (payload.avatarUrl !== undefined) {
      data.avatarUrl =
        payload.avatarUrl.trim() === '' ? null : payload.avatarUrl.trim();
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
      },
    });

    return {
      user,
    };
  }
}
