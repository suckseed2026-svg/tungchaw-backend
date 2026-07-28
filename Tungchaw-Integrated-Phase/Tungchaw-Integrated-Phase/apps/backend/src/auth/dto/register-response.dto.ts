import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class RegisterResponseDto {
  @ApiProperty({
    example: 'User registered successfully',
  })
  message!: string;

  @ApiProperty({
    type: UserResponseDto,
  })
  user!: UserResponseDto;
}
