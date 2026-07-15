import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessStatus, MembershipStatus } from '../../generated/prisma/enums';

export class CreatedBusinessDto {
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

  @ApiPropertyOptional({
    example: '+919876543210',
    nullable: true,
  })
  phone!: string | null;

  @ApiPropertyOptional({
    example: 'owner@zorama.in',
    nullable: true,
  })
  email!: string | null;

  @ApiPropertyOptional({
    example: 'Champhai, Mizoram',
    nullable: true,
  })
  address!: string | null;

  @ApiProperty({
    example: 'Asia/Kolkata',
  })
  timezone!: string;

  @ApiProperty({
    example: 'INR',
  })
  currency!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
  })
  updatedAt!: Date;
}

export class OwnerMembershipDto {
  @ApiProperty({
    example: '03a77c09-7585-49e7-af68-6e2ff2388267',
  })
  id!: string;

  @ApiProperty({
    example: '1110b9d7-9905-4b18-aba9-f6d760d3a0f6',
  })
  userId!: string;

  @ApiProperty({
    example: 'f23bd92a-ff79-456d-8282-ab86035ea795',
  })
  businessId!: string;

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
  })
  joinedAt!: Date;
}

export class OwnerRoleDto {
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

  @ApiProperty({
    example: true,
  })
  isActive!: boolean;
}

export class CreateBusinessResponseDto {
  @ApiProperty({
    example: 'Business created successfully',
  })
  message!: string;

  @ApiProperty({
    type: CreatedBusinessDto,
  })
  business!: CreatedBusinessDto;

  @ApiProperty({
    type: OwnerMembershipDto,
  })
  membership!: OwnerMembershipDto;

  @ApiProperty({
    type: OwnerRoleDto,
  })
  ownerRole!: OwnerRoleDto;
}
