import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { BusinessContextRequest } from '../types/business-context-request.type';
import type { CurrentMembershipData } from '../types/business-context.type';

export const CurrentMembership = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentMembershipData => {
    const request = context.switchToHttp().getRequest<BusinessContextRequest>();

    if (!request.businessContext) {
      throw new InternalServerErrorException(
        'Validated business membership was not found',
      );
    }

    return request.businessContext.membership;
  },
);
