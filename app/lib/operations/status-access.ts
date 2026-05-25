export const operationsStatusTokenHeader = "x-operations-status-token";

type OperationsStatusSession = {
  user: {
    id: string;
    username: string;
  };
} | null;

function readCsvSet(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

export function hasValidOperationsStatusToken(
  request: Request | undefined,
  env: NodeJS.ProcessEnv = process.env,
) {
  const configuredToken = env["OPERATIONS_STATUS_TOKEN"]?.trim();
  const suppliedToken = request?.headers.get(operationsStatusTokenHeader)?.trim();

  return Boolean(configuredToken && suppliedToken && suppliedToken === configuredToken);
}

export function canViewOperationsStatus(
  session: OperationsStatusSession,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!session) {
    return false;
  }

  const allowedUserIds = readCsvSet(env["OPERATIONS_STATUS_USER_IDS"]);
  const allowedUsernames = readCsvSet(env["OPERATIONS_STATUS_USERNAMES"]);

  return allowedUserIds.has(session.user.id) || allowedUsernames.has(session.user.username);
}
