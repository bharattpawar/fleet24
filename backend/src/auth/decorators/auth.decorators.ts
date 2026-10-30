import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';

export interface AuthenticatedUserPayload {
  userId: string;
  phone: string;
  sessionId: string;
  roles: string[];
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUserPayload;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
