import { describe, expect, test } from "bun:test";

import { ProfileVisibility } from "../../generated/prisma/enums";
import { canViewProfileDetails } from "./profile-visibility";

describe("profile visibility", () => {
  test("allows everyone to view public profile details", () => {
    expect(
      canViewProfileDetails({
        relationshipState: "NOT_FRIENDS",
        visibility: ProfileVisibility.PUBLIC,
      }),
    ).toBe(true);
  });

  test("allows friends and the owner to view friends-only profile details", () => {
    expect(
      canViewProfileDetails({
        relationshipState: "FRIENDS",
        visibility: ProfileVisibility.FRIENDS,
      }),
    ).toBe(true);
    expect(
      canViewProfileDetails({
        relationshipState: "SELF",
        visibility: ProfileVisibility.FRIENDS,
      }),
    ).toBe(true);
  });

  test("hides friends-only profile details from non-friends and pending requests", () => {
    for (const relationshipState of ["NOT_FRIENDS", "REQUEST_SENT", "REQUEST_RECEIVED"] as const) {
      expect(
        canViewProfileDetails({
          relationshipState,
          visibility: ProfileVisibility.FRIENDS,
        }),
      ).toBe(false);
    }
  });

  test("hides private profile details from everyone except the owner", () => {
    expect(
      canViewProfileDetails({
        relationshipState: "FRIENDS",
        visibility: ProfileVisibility.PRIVATE,
      }),
    ).toBe(false);
    expect(
      canViewProfileDetails({
        relationshipState: "SELF",
        visibility: ProfileVisibility.PRIVATE,
      }),
    ).toBe(true);
  });
});
