type DuplicateSignupFields = {
  email?: boolean;
  username?: boolean;
};

type UserForResponse = {
  displayName: string;
  email: string;
  emailVerified?: boolean | null;
  id: string;
  username: string;
};

type AuthModuleMock = {
  auth: {
    api: Record<string, unknown>;
  };
  getConfiguredOAuthProviders: () => string[];
  getCurrentSession: () => Promise<unknown>;
  getDuplicateSignupFields: (email: string, username: string) => Promise<DuplicateSignupFields>;
  hasCredentialPassword: (userId: string) => Promise<boolean>;
  serializeUserForResponse: (user: UserForResponse) => {
    displayName: string;
    email: string;
    emailVerified: boolean;
    id: string;
    username: string;
  };
};

export function createAuthModuleMock(overrides: Partial<AuthModuleMock> = {}): AuthModuleMock {
  return {
    auth: {
      api: {},
    },
    getConfiguredOAuthProviders: () => [],
    getCurrentSession: async () => null,
    getDuplicateSignupFields: async () => ({}),
    hasCredentialPassword: async () => false,
    serializeUserForResponse: (user) => ({
      displayName: user.displayName,
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
      id: user.id,
      username: user.username,
    }),
    ...overrides,
  };
}
