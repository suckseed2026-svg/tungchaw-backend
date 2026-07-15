import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '../../generated/prisma/enums';

export class ProfileResponseDto {
  @ApiProperty({
    example: '1110b9d7-9905-4b18-aba9-f6d760d3a0f6',
  })
  id!: string;

  @ApiProperty({
    example: 'John Doe',
  })
  name!: string;

  @ApiProperty({
    example: 'john@example.com',
  })
  email!: string;

  @ApiProperty({
    example: '+919876543210',
    nullable: true,
  })
  phone!: string | null;

  @ApiProperty({
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  status!: UserStatus;

  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
    format: 'date-time',
  })
  emailVerifiedAt!: Date | null;

  @ApiProperty({
    example: '2026-07-12T17:40:22.702Z',
    nullable: true,
    type: String,
    format: 'date-time',
  })
  lastLoginAt!: Date | null;

  @ApiProperty({
    example: '2026-07-11T06:20:00.173Z',
    type: String,
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-07-12T17:40:22.702Z',
    type: String,
    format: 'date-time',
  })
  updatedAt!: Date;
}
