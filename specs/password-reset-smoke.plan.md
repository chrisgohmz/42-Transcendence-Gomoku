# Password Reset Smoke

## Scenarios

- Forgot password page: visit `/en/forgot-password`, assert the request form renders, and verify the email field rejects an invalid email before submit.
- Reset password page: visit `/en/reset-password?token=fake-reset-token`, assert the reset form renders with both password fields, keeps the reset token as a submitted form control, and posts from the token-scoped route.
- Reset validation: submit mismatched new passwords and assert the server action returns the public validation error without calling a real reset.
- Missing token guard: visit `/en/reset-password` and assert the invalid-link state renders with a route back to request a fresh link.

## Notes

- The suite uses a fake reset token and validation failure paths, so it does not send email or mutate a real user password.
