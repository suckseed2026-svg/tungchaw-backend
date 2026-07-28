import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(businessId: string, dto: CreateBranchDto) {
    const normalizedCode = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    const phone = dto.phone?.trim() || null;
    const address = dto.address?.trim() || null;

    const existingBranch = await this.prisma.branch.findUnique({
      where: {
        businessId_code: {
          businessId,
          code: normalizedCode,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingBranch) {
      throw new ConflictException(
        'Branch code already exists in this business',
      );
    }

    try {
      return await this.prisma.branch.create({
        data: {
          businessId,
          name,
          code: normalizedCode,
          phone,
          address,
        },
        select: {
          id: true,
          businessId: true,
          name: true,
          code: true,
          phone: true,
          address: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: unknown) {
      /*
       * The pre-check provides a friendly response, while this P2002 check
       * protects against two concurrent requests creating the same code.
       */
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Branch code already exists in this business',
        );
      }

      throw new InternalServerErrorException(
        'Unable to create branch at this time',
      );
    }
  }

  async findAllByBusiness(businessId: string) {
    return this.prisma.branch.findMany({
      where: {
        businessId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        businessId: true,
        name: true,
        code: true,
        phone: true,
        address: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  private isUniqueConstraintError(error: unknown): error is { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
