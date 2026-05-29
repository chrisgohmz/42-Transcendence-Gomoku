import { ProfileVisibility } from "../../generated/prisma/enums";

export type ProfileRelationshipState =
  | "NOT_FRIENDS"
  | "FRIENDS"
  | "REQUEST_SENT"
  | "REQUEST_RECEIVED"
  | "SELF";

export function canViewProfileDetails({
  relationshipState,
  visibility,
}: {
  relationshipState: ProfileRelationshipState;
  visibility: ProfileVisibility;
}) {
  if (relationshipState === "SELF") {
    return true;
  }

  if (visibility === ProfileVisibility.PUBLIC) {
    return true;
  }

  return visibility === ProfileVisibility.FRIENDS && relationshipState === "FRIENDS";
}
