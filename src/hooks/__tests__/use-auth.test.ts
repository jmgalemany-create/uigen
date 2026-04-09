import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAuth } from "../use-auth";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock server actions
const mockSignInAction = vi.fn();
const mockSignUpAction = vi.fn();
vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => mockSignInAction(...args),
  signUp: (...args: unknown[]) => mockSignUpAction(...args),
}));

// Mock anon work tracker
const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

// Mock project actions
const mockGetProjects = vi.fn();
const mockCreateProject = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));
vi.mock("@/actions/create-project", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" });
});

afterEach(() => {
  cleanup();
});

test("returns isLoading as false initially", () => {
  const { result } = renderHook(() => useAuth());
  expect(result.current.isLoading).toBe(false);
});

test("exposes signIn and signUp functions", () => {
  const { result } = renderHook(() => useAuth());
  expect(typeof result.current.signIn).toBe("function");
  expect(typeof result.current.signUp).toBe("function");
});

test("signIn sets isLoading to true during execution then false after", async () => {
  let resolveSignIn!: (v: unknown) => void;
  mockSignInAction.mockReturnValue(new Promise((r) => (resolveSignIn = r)));

  const { result } = renderHook(() => useAuth());

  act(() => {
    result.current.signIn("user@example.com", "password123");
  });

  expect(result.current.isLoading).toBe(true);

  await act(async () => {
    resolveSignIn({ success: false, error: "Invalid credentials" });
  });

  expect(result.current.isLoading).toBe(false);
});

test("signUp sets isLoading to true during execution then false after", async () => {
  let resolveSignUp!: (v: unknown) => void;
  mockSignUpAction.mockReturnValue(new Promise((r) => (resolveSignUp = r)));

  const { result } = renderHook(() => useAuth());

  act(() => {
    result.current.signUp("user@example.com", "password123");
  });

  expect(result.current.isLoading).toBe(true);

  await act(async () => {
    resolveSignUp({ success: false, error: "Email already registered" });
  });

  expect(result.current.isLoading).toBe(false);
});

test("signIn returns the result from the action", async () => {
  const mockResult = { success: false, error: "Invalid credentials" };
  mockSignInAction.mockResolvedValue(mockResult);

  const { result } = renderHook(() => useAuth());
  let returnValue: unknown;

  await act(async () => {
    returnValue = await result.current.signIn("user@example.com", "wrongpass");
  });

  expect(returnValue).toEqual(mockResult);
});

test("signUp returns the result from the action", async () => {
  const mockResult = { success: false, error: "Email already registered" };
  mockSignUpAction.mockResolvedValue(mockResult);

  const { result } = renderHook(() => useAuth());
  let returnValue: unknown;

  await act(async () => {
    returnValue = await result.current.signUp("user@example.com", "password123");
  });

  expect(returnValue).toEqual(mockResult);
});

test("signIn does not call handlePostSignIn when result is not successful", async () => {
  mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@example.com", "wrongpass");
  });

  expect(mockGetAnonWorkData).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

test("signUp does not call handlePostSignIn when result is not successful", async () => {
  mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signUp("user@example.com", "password123");
  });

  expect(mockGetAnonWorkData).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

// handlePostSignIn: anon work with messages
test("after successful signIn with anon work, creates project from anon data and navigates", async () => {
  const anonWork = {
    messages: [{ role: "user", content: "Build a button" }],
    fileSystemData: { "/App.jsx": { content: "export default () => <button/>" } },
  };
  mockGetAnonWorkData.mockReturnValue(anonWork);
  mockSignInAction.mockResolvedValue({ success: true });
  mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@example.com", "password123");
  });

  expect(mockCreateProject).toHaveBeenCalledWith({
    name: expect.stringContaining("Design from"),
    messages: anonWork.messages,
    data: anonWork.fileSystemData,
  });
  expect(mockClearAnonWork).toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
  expect(mockGetProjects).not.toHaveBeenCalled();
});

test("after successful signUp with anon work, creates project from anon data and navigates", async () => {
  const anonWork = {
    messages: [{ role: "user", content: "Build a button" }],
    fileSystemData: {},
  };
  mockGetAnonWorkData.mockReturnValue(anonWork);
  mockSignUpAction.mockResolvedValue({ success: true });
  mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signUp("user@example.com", "password123");
  });

  expect(mockCreateProject).toHaveBeenCalledWith(
    expect.objectContaining({ messages: anonWork.messages, data: anonWork.fileSystemData })
  );
  expect(mockClearAnonWork).toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
});

// handlePostSignIn: anon work with no messages
test("after successful signIn, skips anon work when messages array is empty", async () => {
  mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
  mockSignInAction.mockResolvedValue({ success: true });
  mockGetProjects.mockResolvedValue([{ id: "existing-project-id" }]);

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@example.com", "password123");
  });

  expect(mockCreateProject).not.toHaveBeenCalled();
  expect(mockGetProjects).toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/existing-project-id");
});

// handlePostSignIn: no anon work, existing projects
test("after successful signIn with no anon work, navigates to most recent project", async () => {
  mockGetAnonWorkData.mockReturnValue(null);
  mockSignInAction.mockResolvedValue({ success: true });
  mockGetProjects.mockResolvedValue([
    { id: "recent-project-id" },
    { id: "older-project-id" },
  ]);

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@example.com", "password123");
  });

  expect(mockPush).toHaveBeenCalledWith("/recent-project-id");
  expect(mockCreateProject).not.toHaveBeenCalled();
});

// handlePostSignIn: no anon work, no existing projects
test("after successful signIn with no anon work and no projects, creates new project and navigates", async () => {
  mockGetAnonWorkData.mockReturnValue(null);
  mockSignInAction.mockResolvedValue({ success: true });
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "brand-new-id" });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@example.com", "password123");
  });

  expect(mockCreateProject).toHaveBeenCalledWith({
    name: expect.stringMatching(/^New Design #\d+$/),
    messages: [],
    data: {},
  });
  expect(mockPush).toHaveBeenCalledWith("/brand-new-id");
});

test("signIn calls signInAction with the provided email and password", async () => {
  mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("test@example.com", "mypassword");
  });

  expect(mockSignInAction).toHaveBeenCalledWith("test@example.com", "mypassword");
});

test("signUp calls signUpAction with the provided email and password", async () => {
  mockSignUpAction.mockResolvedValue({ success: false, error: "An error occurred" });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signUp("new@example.com", "securepass");
  });

  expect(mockSignUpAction).toHaveBeenCalledWith("new@example.com", "securepass");
});

test("isLoading resets to false even when signIn action throws", async () => {
  mockSignInAction.mockRejectedValue(new Error("Network error"));

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    try {
      await result.current.signIn("user@example.com", "password123");
    } catch {
      // expected
    }
  });

  expect(result.current.isLoading).toBe(false);
});

test("isLoading resets to false even when signUp action throws", async () => {
  mockSignUpAction.mockRejectedValue(new Error("Network error"));

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    try {
      await result.current.signUp("user@example.com", "password123");
    } catch {
      // expected
    }
  });

  expect(result.current.isLoading).toBe(false);
});
