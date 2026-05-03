import { describe, expect, test } from "bun:test";

import {
  validateLoginInput,
  validateProfileSettingsInput,
  validateSignupInput,
} from "./auth-profile";

describe("auth/profile validation", () => {
  test("normalizes valid signup input", () => {
    const result = validateSignupInput({
      displayName: "Max",
      email: "MAX@example.COM",
      password: "password123",
      username: "max_player",
    });

    expect(result).toMatchObject({
      data: {
        displayName: "Max",
        email: "max@example.com",
        password: "password123",
        username: "max_player",
      },
      ok: true,
    });
  });

  test("preserves display name whitespace", () => {
    const signupResult = validateSignupInput({
      displayName: "  Max  ",
      email: "max@example.com",
      password: "password123",
      username: "max_player",
    });
    const profileResult = validateProfileSettingsInput({
      displayName: "  Max J  ",
    });

    expect(signupResult).toMatchObject({
      data: {
        displayName: "  Max  ",
      },
      ok: true,
    });
    expect(profileResult).toMatchObject({
      data: {
        displayName: "  Max J  ",
      },
      ok: true,
    });
  });

  test("rejects usernames with surrounding whitespace", () => {
    const result = validateSignupInput({
      displayName: "Max",
      email: "max@example.com",
      password: "password123",
      username: " max_player ",
    });

    expect(result).toMatchObject({
      issues: [{ code: "invalidUsername", field: "username" }],
      ok: false,
    });
  });

  test("rejects emails with surrounding whitespace", () => {
    const result = validateSignupInput({
      displayName: "Max",
      email: " max@example.com ",
      password: "password123",
      username: "max_player",
    });

    expect(result).toMatchObject({
      issues: [{ code: "invalidEmail", field: "email" }],
      ok: false,
    });
  });

  test("preserves leading and trailing password spaces", () => {
    const signupResult = validateSignupInput({
      displayName: "Max",
      email: "max@example.com",
      password: "  password123  ",
      username: "max_player",
    });
    const loginResult = validateLoginInput({
      email: "max@example.com",
      password: "  password123  ",
    });

    expect(signupResult).toMatchObject({
      data: {
        password: "  password123  ",
      },
      ok: true,
    });
    expect(loginResult).toMatchObject({
      data: {
        password: "  password123  ",
      },
      ok: true,
    });
  });

  test("reports field-level signup issues", () => {
    const result = validateSignupInput({
      email: "not-an-email",
      password: "short",
      username: "a b",
    });

    expect(result).toMatchObject({
      issues: [
        { code: "invalidEmail", field: "email" },
        { code: "invalidUsername", field: "username" },
        { code: "shortPassword", field: "password" },
      ],
      ok: false,
    });
  });

  test("rejects incomplete login payloads before credential lookup", () => {
    const result = validateLoginInput({
      email: "",
      password: "",
    });

    expect(result).toMatchObject({
      issues: [
        { code: "emailRequired", field: "email" },
        { code: "shortPassword", field: "password" },
      ],
      ok: false,
    });
  });

  test("allows profile updates without a password change", () => {
    const result = validateProfileSettingsInput({
      displayName: "Max J",
    });

    expect(result).toMatchObject({
      data: {
        displayName: "Max J",
        wantsToChangePassword: false,
      },
      ok: true,
    });
  });

  test("reports profile password field issues", () => {
    const result = validateProfileSettingsInput({
      confirmPassword: "password999",
      displayName: "Max",
      newPassword: "password123",
    });

    expect(result).toMatchObject({
      issues: [
        { code: "currentPasswordRequired", field: "currentPassword" },
        { code: "passwordMismatch", field: "confirmPassword" },
      ],
      ok: false,
    });
  });
});
