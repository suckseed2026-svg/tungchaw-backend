import { ApiProperty } from '@nestjs/swagger';
import { BusinessStatus, MembershipStatus } from '../../generated/prisma/enums';

export class BusinessContextBusinessDto {
  @ApiProperty({
    example: 'f23bd92a-ff79-456d-8282-ab86035ea795',
  })
  id!: string;

  @ApiProperty({
    example: 'Zorama Enterprise',
  })
  name!: string;

  @ApiProperty({
    example: 'ZORAMA',
  })
  code!: string;

  @ApiProperty({
    enum: BusinessStatus,
    example: BusinessStatus.PENDING,
  })
  status!: BusinessStatus;

  @ApiProperty({
    example: 'Asia/Kolkata',
  })
  timezone!: string;

  @ApiProperty({
    example: 'INR',
  })
  currency!: string;
}

export class BusinessContextRoleDto {
  @ApiProperty({
    example: 'ea267dca-1d64-42fa-b55e-74577f01fd74',
  })
  id!: string;

  @ApiProperty({
    example: 'Owner',
  })
  name!: string;

  @ApiProperty({
    example: 'OWNER',
  })
  code!: string;

  @ApiProperty({
    example: true,
  })
  isSystem!: boolean;
}

export class BusinessContextMembershipDto {
  @ApiProperty({
    example: '03a77c09-7585-49e7-af68-6e2ff2388267',
  })
  id!: string;

  @ApiProperty({
    example: 'f23bd92a-ff79-456d-8282-ab86035ea795',
  })
  businessId!: string;

  @ApiProperty({
    example: '1110b9d7-9905-4b18-aba9-f6d760d3a0f6',
  })
  userId!: string;

  @ApiProperty({
    enum: MembershipStatus,
    example: MembershipStatus.ACTIVE,
  })
  status!: MembershipStatus;

  @ApiProperty({
    example: true,
  })
  isOwner!: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
  })
  joinedAt!: Date | null;

  @ApiProperty({
    type: [BusinessContextRoleDto],
  })
  roles!: BusinessContextRoleDto[];
}

export class BusinessContextResponseDto {
  @ApiProperty({
    type: BusinessContextBusinessDto,
  })
  business!: BusinessContextBusinessDto;

  @ApiProperty({
    type: BusinessContextMembershipDto,
  })
  membership!: BusinessContextMembershipDto;
}
