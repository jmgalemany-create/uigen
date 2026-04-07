import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallBadge } from "../ToolCallBadge";
import type { ToolInvocation } from "ai";

afterEach(() => {
  cleanup();
});

function makeInvocation(
  toolName: string,
  args: Record<string, unknown>,
  state: "call" | "result" = "call",
  result?: unknown
): ToolInvocation {
  if (state === "result") {
    return { toolCallId: "test-id", toolName, args, state, result };
  }
  return { toolCallId: "test-id", toolName, args, state };
}

// --- str_replace_editor ---

test("shows 'Creating' label for str_replace_editor create command", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeInvocation("str_replace_editor", {
        command: "create",
        path: "/App.jsx",
      })}
    />
  );
  expect(screen.getByText("Creating /App.jsx")).toBeDefined();
});

test("shows 'Editing' label for str_replace_editor str_replace command", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeInvocation("str_replace_editor", {
        command: "str_replace",
        path: "/components/Button.tsx",
      })}
    />
  );
  expect(screen.getByText("Editing /components/Button.tsx")).toBeDefined();
});

test("shows 'Editing' label for str_replace_editor insert command", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeInvocation("str_replace_editor", {
        command: "insert",
        path: "/foo.tsx",
      })}
    />
  );
  expect(screen.getByText("Editing /foo.tsx")).toBeDefined();
});

test("shows 'Reading' label for str_replace_editor view command", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeInvocation("str_replace_editor", {
        command: "view",
        path: "/foo.tsx",
      })}
    />
  );
  expect(screen.getByText("Reading /foo.tsx")).toBeDefined();
});

// --- file_manager ---

test("shows 'Renaming' label for file_manager rename command", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeInvocation("file_manager", {
        command: "rename",
        path: "/old.tsx",
        new_path: "/new.tsx",
      })}
    />
  );
  expect(screen.getByText("Renaming /old.tsx")).toBeDefined();
});

test("shows 'Deleting' label for file_manager delete command", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeInvocation("file_manager", {
        command: "delete",
        path: "/foo.tsx",
      })}
    />
  );
  expect(screen.getByText("Deleting /foo.tsx")).toBeDefined();
});

// --- fallback ---

test("shows raw tool name for unknown tools", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeInvocation("unknown_tool", {})}
    />
  );
  expect(screen.getByText("unknown_tool")).toBeDefined();
});

// --- visual states ---

test("shows spinner when state is not result", () => {
  const { container } = render(
    <ToolCallBadge
      toolInvocation={makeInvocation("str_replace_editor", {
        command: "create",
        path: "/App.jsx",
      }, "call")}
    />
  );
  // Spinner uses animate-spin class
  expect(container.querySelector(".animate-spin")).toBeDefined();
  // No green dot
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("shows green dot when state is result with a result value", () => {
  const { container } = render(
    <ToolCallBadge
      toolInvocation={makeInvocation(
        "str_replace_editor",
        { command: "create", path: "/App.jsx" },
        "result",
        "File created: /App.jsx"
      )}
    />
  );
  expect(container.querySelector(".bg-emerald-500")).toBeDefined();
  expect(container.querySelector(".animate-spin")).toBeNull();
});
