import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { BusinessContextRequest } from '../types/business-context-request.type';
import type { CurrentBusinessData } from '../types/business-context.type';

export const CurrentBusiness = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentBusinessData => {
    const request = context.switchToHttp().getRequest<BusinessContextRequest>();

    if (!request.businessContext) {
      throw new InternalServerErrorException(
        'Validated business context was not found',
      );
    }

    return request.businessContext.business;
  },
);
