import { describe, it, expect } from "vitest";
import {
  resolveStaffRole,
  isStaffMember,
  hasModuleAccess,
  getAccessibleModules,
  isOwner,
  type StaffIdentity,
} from "@/server/auth/permissions.service";
import { MODULES_BY_STAFF_ROLE } from "@/server/auth/roles.definition";

const id = (role: StaffIdentity["role"], staffRole: StaffIdentity["staffRole"] = null): StaffIdentity => ({
  role,
  staffRole,
});

describe("resolveStaffRole", () => {
  it("privilégie le staffRole explicite", () => {
    expect(resolveStaffRole(id("MEMBER", "CATALOG_MANAGER"))).toBe("CATALOG_MANAGER");
    expect(resolveStaffRole(id("ADMIN", "SUPPORT"))).toBe("SUPPORT");
  });

  it("applique le fallback legacy ADMIN → OWNER", () => {
    expect(resolveStaffRole(id("ADMIN"))).toBe("OWNER");
  });

  it("applique le fallback legacy MODERATOR → MODERATOR", () => {
    expect(resolveStaffRole(id("MODERATOR"))).toBe("MODERATOR");
  });

  it("renvoie null pour un simple membre", () => {
    expect(resolveStaffRole(id("MEMBER"))).toBeNull();
  });
});

describe("isStaffMember / isOwner", () => {
  it("isStaffMember vrai dès qu'un rôle effectif existe", () => {
    expect(isStaffMember(id("ADMIN"))).toBe(true);
    expect(isStaffMember(id("MEMBER", "SUPPORT"))).toBe(true);
    expect(isStaffMember(id("MEMBER"))).toBe(false);
  });

  it("isOwner uniquement pour OWNER (y compris legacy ADMIN)", () => {
    expect(isOwner(id("ADMIN"))).toBe(true);
    expect(isOwner(id("MEMBER", "OWNER"))).toBe(true);
    expect(isOwner(id("MEMBER", "MODERATOR"))).toBe(false);
    expect(isOwner(id("MEMBER"))).toBe(false);
  });
});

describe("hasModuleAccess — matrice RBAC", () => {
  it("OWNER accède à tous les modules", () => {
    for (const m of MODULES_BY_STAFF_ROLE.OWNER) {
      expect(hasModuleAccess(id("MEMBER", "OWNER"), m)).toBe(true);
    }
  });

  it("SUPPORT n'accède jamais à 'staff' ni 'catalog' (pas d'escalade)", () => {
    expect(hasModuleAccess(id("MEMBER", "SUPPORT"), "staff")).toBe(false);
    expect(hasModuleAccess(id("MEMBER", "SUPPORT"), "catalog")).toBe(false);
    expect(hasModuleAccess(id("MEMBER", "SUPPORT"), "support")).toBe(true);
  });

  it("CATALOG_MANAGER limité à overview + catalog", () => {
    expect(hasModuleAccess(id("MEMBER", "CATALOG_MANAGER"), "catalog")).toBe(true);
    expect(hasModuleAccess(id("MEMBER", "CATALOG_MANAGER"), "shop")).toBe(false);
    expect(hasModuleAccess(id("MEMBER", "CATALOG_MANAGER"), "moderation")).toBe(false);
  });

  it("MODERATOR n'a pas accès à 'shop' ni 'staff'", () => {
    expect(hasModuleAccess(id("MEMBER", "MODERATOR"), "moderation")).toBe(true);
    expect(hasModuleAccess(id("MEMBER", "MODERATOR"), "shop")).toBe(false);
    expect(hasModuleAccess(id("MEMBER", "MODERATOR"), "staff")).toBe(false);
  });

  it("un non-staff n'a accès à aucun module", () => {
    expect(hasModuleAccess(id("MEMBER"), "overview")).toBe(false);
  });
});

describe("getAccessibleModules", () => {
  it("renvoie la liste du sous-rôle résolu", () => {
    // Robuste : suit la matrice MODULES_BY_STAFF_ROLE plutôt qu'une liste figée.
    expect(getAccessibleModules(id("MEMBER", "SHOP_MANAGER"))).toEqual(MODULES_BY_STAFF_ROLE.SHOP_MANAGER);
    expect(getAccessibleModules(id("ADMIN"))).toEqual(MODULES_BY_STAFF_ROLE.OWNER);
  });

  it("renvoie une liste vide pour un membre", () => {
    expect(getAccessibleModules(id("MEMBER"))).toEqual([]);
  });
});
