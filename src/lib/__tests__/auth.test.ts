// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { jwtVerify } from "jose";

// server-only throws at import time outside Next.js — mock it
vi.mock("server-only", () => ({}));

// Mock next/headers cookies
const mockSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ set: mockSet })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function importCreateSession() {
  const mod = await import("@/lib/auth");
  return mod.createSession;
}

test("createSession sets an httpOnly cookie named auth-token", async () => {
  const createSession = await importCreateSession();
  await createSession("user-123", "test@example.com");

  expect(mockSet).toHaveBeenCalledOnce();
  const [cookieName, , options] = mockSet.mock.calls[0];
  expect(cookieName).toBe("auth-token");
  expect(options.httpOnly).toBe(true);
});

test("createSession cookie expires in ~7 days", async () => {
  const createSession = await importCreateSession();
  const before = Date.now();
  await createSession("user-123", "test@example.com");
  const after = Date.now();

  const [, , options] = mockSet.mock.calls[0];
  const expires: Date = options.expires;

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

test("createSession cookie has correct security options", async () => {
  const createSession = await importCreateSession();
  await createSession("user-123", "test@example.com");

  const [, , options] = mockSet.mock.calls[0];
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
  // secure is false in test env (NODE_ENV !== 'production')
  expect(options.secure).toBe(false);
});

test("createSession stores a valid JWT containing userId and email", async () => {
  const createSession = await importCreateSession();
  await createSession("user-abc", "hello@example.com");

  const [, token] = mockSet.mock.calls[0];
  expect(typeof token).toBe("string");

  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || "development-secret-key"
  );
  const { payload } = await jwtVerify(token, secret);

  expect(payload.userId).toBe("user-abc");
  expect(payload.email).toBe("hello@example.com");
});

test("createSession JWT expires in 7 days", async () => {
  const createSession = await importCreateSession();
  const before = Math.floor(Date.now() / 1000);
  await createSession("user-123", "test@example.com");
  const after = Math.floor(Date.now() / 1000);

  const [, token] = mockSet.mock.calls[0];
  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || "development-secret-key"
  );
  const { payload } = await jwtVerify(token, secret);

  const sevenDays = 7 * 24 * 60 * 60;
  expect(payload.exp).toBeGreaterThanOrEqual(before + sevenDays - 5);
  expect(payload.exp).toBeLessThanOrEqual(after + sevenDays + 5);
});
