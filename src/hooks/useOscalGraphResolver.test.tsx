import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOscalGraphResolver } from "./useOscalGraphResolver";

const authFetchMock = vi.hoisted(() => vi.fn());

vi.mock("../context/AuthContext", () => ({
  authFetch: authFetchMock,
}));

describe("useOscalGraphResolver", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    authFetchMock.mockReset();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("marks an unreachable SSP import-profile as failed after the profile timeout", async () => {
    authFetchMock.mockReturnValue(new Promise<Response>(() => undefined));

    const ssp = {
      "system-security-plan": {
        uuid: "d8784013-b641-4c0b-810d-7b3a7caf1fb9",
        metadata: { title: "U.S. Department of Agriculture Enterprise ICAM Program System Security Plan" },
        "import-profile": {
          href: "https://registry.oscal.io/api/v1/pirooz-javan/profiles/e6d7ea45-0d45-481a-8d02-855cfd60d8a8",
        },
        "system-implementation": {
          "leveraged-authorizations": [],
        },
      },
    };

    const { result } = renderHook(() => useOscalGraphResolver({
      root: ssp,
      rootModelKey: "system-security-plan",
      rootBaseUrl: null,
      token: null,
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.items.some((item) => item.modelKey === "profile" && item.status === "loading")).toBe(true);

    expect(authFetchMock).toHaveBeenCalledWith(
      "https://registry.oscal.io/api/v1/pirooz-javan/profiles/e6d7ea45-0d45-481a-8d02-855cfd60d8a8",
      null,
      expect.objectContaining({ timeoutMs: 8000 }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_500);
    });

    const profileItem = result.current.items.find((item) => item.modelKey === "profile");
    expect(profileItem?.status).toBe("error");
    expect(profileItem?.error).toContain("Timed out resolving profile");
  });
});
