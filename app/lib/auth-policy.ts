export const authCredentialPolicy = {
  accountLinking: {
    enabled: true,
    requireLocalEmailVerified: true,
  },
  emailAndPassword: {
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignIn: true,
    sendOnSignUp: true,
  },
} as const;
