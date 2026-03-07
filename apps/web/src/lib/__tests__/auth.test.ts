import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_WRITE_ROUTES,
  clearStoredTokens,
  getAccessToken,
  getRefreshToken,
  getStoredTokens,
  setStoredTokens,
} from "../auth";

// Mock env
vi.mock("@/config/env", () => ({
  env: {
    API_UPSTREAM_BASE_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

describe("AUTH_WRITE_ROUTES", () => {
  it("should contain all auth routes that modify cookies", () => {
    expect(AUTH_WRITE_ROUTES).toContain("/api/auth/login");
    expect(AUTH_WRITE_ROUTES).toContain("/api/auth/logout");
    expect(AUTH_WRITE_ROUTES).toContain("/api/auth/refresh-token");
    expect(AUTH_WRITE_ROUTES).toContain("/api/auth/register");
    expect(AUTH_WRITE_ROUTES).toContain("/api/auth/webauthn/register/verify");
    expect(AUTH_WRITE_ROUTES).toContain("/api/auth/webauthn/login/verify");
    expect(AUTH_WRITE_ROUTES).toHaveLength(6);
  });
});

describe("localStorage tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("should store and read tokens", () => {
    setStoredTokens({ accessToken: "access-123", refreshToken: "refresh-456" });

    expect(getStoredTokens()).toEqual({
      accessToken: "access-123",
      refreshToken: "refresh-456",
    });
    expect(getAccessToken()).toBe("access-123");
    expect(getRefreshToken()).toBe("refresh-456");
  });

  it("should clear tokens", () => {
    setStoredTokens({ accessToken: "access-123", refreshToken: "refresh-456" });
    clearStoredTokens();

    expect(getStoredTokens()).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
