"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

async function signOutViaSameOriginRoute() {
  const response = await fetch("/api/auth/logout", {
    credentials: "same-origin",
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Logout request failed.");
  }
}

export async function signOutCurrentSession() {
  try {
    const { error } = await authClient.signOut();

    if (!error) {
      return;
    }
  } catch {
    // Fall through to the same-origin route below.
  }

  await signOutViaSameOriginRoute();
}
