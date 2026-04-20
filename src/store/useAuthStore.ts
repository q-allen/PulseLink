"use client";

/**
 * src/store/useAuthStore.ts
 *
 * Thin wrapper around the main Zustand auth store (currently in `src/store/index.ts`).
 * Adds helpers to sync real backend user data after login/profile updates
 * while keeping the existing store instance intact.
 */

import type { FamilyMember, User } from "@/types";
import type { BackendUserFull } from "@/services/userService";
import { mapBackendUser, mapFamilyMembers } from "@/services/userService";
import { useAuthStore as base } from "./index";

export const useAuthStore = base;

/** Sync a fully mapped frontend User + optional family members into the store. */
export function syncAuthUser(user: User | null, familyMembers?: FamilyMember[]): void {
  const { setUser, setFamilyMembers } = base.getState();
  setUser(user);
  if (familyMembers) setFamilyMembers(familyMembers);
}

/** Map backend user payload → frontend User and sync store in one call. */
export function syncAuthFromBackend(backendUser: BackendUserFull | null): void {
  if (!backendUser) {
    syncAuthUser(null, []);
    return;
  }
  syncAuthUser(mapBackendUser(backendUser), mapFamilyMembers(backendUser.family_members ?? []));
}

