import { JWTPayload } from 'jose';

export interface AuthenticatedUser extends JWTPayload {
  realm_access?: {
    roles?: string[];
  };

  resource_access?: Record<
    string,
    {
      roles?: string[];
    }
  >;
}