import { describe, it, expect } from "vitest";
import {
  mapAuth0RoleNames,
  staffRoleToAuth0Name,
  getDefaultDashboardForStaffRole,
  getDashboardsForStaffRole,
} from "@/server/auth/roles.definition";

describe("mapAuth0RoleNames", () => {
  it("sans rôle reconnu → MEMBER / staffRole null", () => {
    expect(mapAuth0RoleNames([])).toEqual({ staffRole: null, userRole: "MEMBER" });
    expect(mapAuth0RoleNames(["role_inconnu"])).toEqual({ staffRole: null, userRole: "MEMBER" });
  });

  it("mappe un rôle unique", () => {
    expect(mapAuth0RoleNames(["park_support"])).toEqual({ staffRole: "SUPPORT", userRole: "ADMIN" });
    expect(mapAuth0RoleNames(["park_moderator"])).toEqual({ staffRole: "MODERATOR", userRole: "MODERATOR" });
  });

  it("respecte STAFF_ROLE_PRIORITY si plusieurs rôles", () => {
    // OWNER prime sur SUPPORT quel que soit l'ordre d'entrée.
    expect(mapAuth0RoleNames(["park_support", "park_owner"]).staffRole).toBe("OWNER");
    expect(mapAuth0RoleNames(["park_catalog_manager", "park_moderator"]).staffRole).toBe("MODERATOR");
  });

  it("ignore les noms inconnus mais garde les valides", () => {
    expect(mapAuth0RoleNames(["xxx", "park_shop_manager"]).staffRole).toBe("SHOP_MANAGER");
  });
});

describe("staffRoleToAuth0Name", () => {
  it("renvoie le nom Auth0 attendu", () => {
    expect(staffRoleToAuth0Name("OWNER")).toBe("park_owner");
    expect(staffRoleToAuth0Name("CATALOG_MANAGER")).toBe("park_catalog_manager");
  });
});

describe("getDefaultDashboardForStaffRole", () => {
  it("null → /admin", () => {
    expect(getDefaultDashboardForStaffRole(null)).toBe("/admin");
  });

  it("rôle → dashboard dédié", () => {
    expect(getDefaultDashboardForStaffRole("MODERATOR")).toBe("/admin/moderation");
    expect(getDefaultDashboardForStaffRole("SHOP_MANAGER")).toBe("/admin/boutique");
  });
});

describe("getDashboardsForStaffRole", () => {
  it("OWNER voit tous les dashboards", () => {
    const hrefs = getDashboardsForStaffRole("OWNER").map((d) => d.href);
    expect(hrefs).toContain("/admin/roles");
    expect(hrefs).toContain("/admin/boutique");
  });

  it("SUPPORT ne voit ni boutique ni staff", () => {
    const hrefs = getDashboardsForStaffRole("SUPPORT").map((d) => d.href);
    expect(hrefs).not.toContain("/admin/boutique");
    expect(hrefs).not.toContain("/admin/roles");
    expect(hrefs).toContain("/admin/support");
  });
});
