import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Onboarding regression tests for the "Tejline poruke" step.
 * Core rule: Tejla's messages are a pure preference — the step must never
 * touch push permission, subscriptions or the user's own reminders.
 */

const mocks = vi.hoisted(() => ({
  installApplies: true,
  push: "default" as string,
  clientKind: "web" as "web" | "native",
  enabled: false as boolean | undefined,
  setEnabled: vi.fn(),
  enablePush: vi.fn(),
  syncSubscription: vi.fn(),
}));

vi.mock("@/lib/push", () => ({
  enablePush: mocks.enablePush,
  syncSubscription: mocks.syncSubscription,
  pushStatus: () => mocks.push,
}));

vi.mock("@/lib/pwa-install", () => ({
  canPromptInstall: () => false,
  detectPlatform: () => "ios",
  getClientKind: () => mocks.clientKind,
  installStepApplies: () => mocks.installApplies,
  isInstalled: () => !mocks.installApplies,
  onInstallAvailabilityChange: () => () => {},
  promptInstall: vi.fn(),
}));

vi.mock("@/lib/family-workspace", () => ({
  useMyUserId: () => ({ data: "user-1" }),
}));

vi.mock("@/lib/notification-prefs", () => ({
  TEJLA_MESSAGES_DEFAULT: false,
  useTejlaMessagesEnabled: () => ({ data: mocks.enabled, isLoading: false }),
  useSetTejlaMessages: () => ({
    mutate: mocks.setEnabled,
    mutateAsync: mocks.setEnabled,
    isPending: false,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

import { OnboardingGate } from "./Onboarding";

function renderGate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <OnboardingGate>
        <div>APP_CONTENT</div>
      </OnboardingGate>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  mocks.installApplies = true;
  mocks.push = "default";
  mocks.clientKind = "web";
  mocks.enabled = false;
  mocks.setEnabled.mockReset().mockResolvedValue(true);
  mocks.enablePush.mockReset();
});

describe("Onboarding — Tejline poruke step", () => {
  it("a new user sees the step", async () => {
    renderGate();
    expect(await screen.findByText("Tejline poruke ✨")).toBeInTheDocument();
    expect(screen.getByText("Ovo nisu podsjetnici za tvoje obveze.")).toBeInTheDocument();
    expect(
      screen.getByText("Podsjetnici za tvoje obveze rade neovisno o ovoj postavci."),
    ).toBeInTheDocument();
  });

  it("„Želim Tejline poruke” enables the preference", async () => {
    renderGate();
    await userEvent.click(await screen.findByRole("button", { name: "Želim Tejline poruke" }));
    await waitFor(() => expect(mocks.setEnabled).toHaveBeenCalledWith(true));
    expect(mocks.enablePush).not.toHaveBeenCalled();
  });

  it("„Ne sada” leaves it false and onboarding still finishes", async () => {
    renderGate();
    await userEvent.click(await screen.findByRole("button", { name: "Ne sada" }));
    expect(mocks.setEnabled).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Gotovo, nastavi|Nastavi/ }));
    await userEvent.click(await screen.findByRole("link", { name: "Daj Tejli prvu stvar" }));
    expect(await screen.findByText("APP_CONTENT")).toBeInTheDocument();
    expect(window.localStorage.getItem("tejla-onboarding-user-1")).toBe("done");
  });

  it("an existing user with status 'done' never sees onboarding", async () => {
    window.localStorage.setItem("tejla-onboarding-user-1", "done");
    renderGate();
    expect(await screen.findByText("APP_CONTENT")).toBeInTheDocument();
    expect(screen.queryByText("Tejline poruke ✨")).not.toBeInTheDocument();
  });

  it("an existing user with status 'skipped' never sees onboarding", async () => {
    window.localStorage.setItem("tejla-onboarding-user-1", "skipped");
    renderGate();
    expect(await screen.findByText("APP_CONTENT")).toBeInTheDocument();
    expect(screen.queryByText("Tejline poruke ✨")).not.toBeInTheDocument();
  });

  it("new device + preference already true does not ask again", async () => {
    mocks.enabled = true;
    renderGate();
    expect(await screen.findByText("Tejline poruke ✨")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Želim Tejline poruke" })).not.toBeInTheDocument();
    expect(screen.getByText(/Uključene su/)).toBeInTheDocument();
    expect(mocks.setEnabled).not.toHaveBeenCalled();
  });

  it("auto-skip does not fire before the messages question was answered", async () => {
    mocks.installApplies = false;
    mocks.push = "granted";
    renderGate();
    expect(await screen.findByText("Tejline poruke ✨")).toBeInTheDocument();
    expect(window.localStorage.getItem("tejla-onboarding-user-1")).toBeNull();
  });

  it("auto-skips once install, push and the messages question are all settled", async () => {
    mocks.installApplies = false;
    mocks.push = "granted";
    window.localStorage.setItem("tejla-onboarding-messages-user-1", "answered");
    renderGate();
    expect(await screen.findByText("APP_CONTENT")).toBeInTheDocument();
    expect(window.localStorage.getItem("tejla-onboarding-user-1")).toBe("done");
  });

  it("iOS/PWA order: install, then notifications, then Tejla messages", async () => {
    renderGate();
    await screen.findByText("Tejline poruke ✨");
    const html = document.body.innerHTML;
    expect(html.indexOf("Uključi obavijesti")).toBeLessThan(html.indexOf("Tejline poruke"));
  });
});
