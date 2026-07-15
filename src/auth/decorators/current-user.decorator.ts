import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { JwtUser } from '../types/jwt-user.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtUser => {
    const request = context.switchToHttp().getRequest<{
      user?: JwtUser;
    }>();

    if (!request.user) {
      throw new UnauthorizedException('Authenticated user was not found');
    }

    return request.user;
  },
);
