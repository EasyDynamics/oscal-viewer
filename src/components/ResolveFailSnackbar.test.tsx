import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ResolveFailSnackbar, { type FailableItem } from "./ResolveFailSnackbar";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("<ResolveFailSnackbar />", () => {
  it("renders nothing when no items have errored", () => {
    const items: FailableItem[] = [
      { label: "Profile", status: "success" },
      { label: "Catalog", status: "idle" },
    ];
    const { container } = render(<ResolveFailSnackbar items={items} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders an alert with the failed item's resolvedUrl when present", () => {
    const items: FailableItem[] = [
      {
        label: "Profile",
        status: "error",
        resolvedUrl: "https://example.com/p.json",
      },
    ];
    render(<ResolveFailSnackbar items={items} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      /Could not resolve:.*https:\/\/example\.com\/p\.json/,
    );
  });

  it("falls back to label when resolvedUrl is missing", () => {
    const items: FailableItem[] = [
      { label: "Catalog", status: "error" },
    ];
    render(<ResolveFailSnackbar items={items} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Could not resolve:.*Catalog/,
    );
  });

  it("lists multiple failures joined by commas", () => {
    const items: FailableItem[] = [
      { label: "Profile", status: "error", resolvedUrl: "p.json" },
      { label: "Catalog", status: "error" },
    ];
    render(<ResolveFailSnackbar items={items} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /p\.json, Catalog/,
    );
  });

  it("auto-dismisses after 3 seconds", () => {
    const items: FailableItem[] = [
      { label: "X", status: "error" },
    ];
    const { queryByRole } = render(<ResolveFailSnackbar items={items} />);
    expect(queryByRole("alert")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(queryByRole("alert")).toBeNull();
  });

  it("dismiss button hides the snackbar immediately", () => {
    const items: FailableItem[] = [
      { label: "X", status: "error" },
    ];
    const { queryByRole } = render(<ResolveFailSnackbar items={items} />);
    const close = screen.getByRole("button", { name: "Dismiss" });
    fireEvent.click(close);
    expect(queryByRole("alert")).toBeNull();
  });

  it("resets the timer when items change to a new failure", () => {
    const first: FailableItem[] = [{ label: "A", status: "error" }];
    const { rerender, queryByRole } = render(
      <ResolveFailSnackbar items={first} />,
    );
    expect(queryByRole("alert")).not.toBeNull();

    // Advance almost to the original 3s threshold
    act(() => vi.advanceTimersByTime(2000));

    // New error item — timer should restart
    const second: FailableItem[] = [{ label: "B", status: "error" }];
    rerender(<ResolveFailSnackbar items={second} />);
    expect(queryByRole("alert")).toHaveTextContent(/B/);

    // Just past the original threshold — should still be visible because
    // the timer was reset
    act(() => vi.advanceTimersByTime(1500));
    expect(queryByRole("alert")).not.toBeNull();

    // Past the new threshold
    act(() => vi.advanceTimersByTime(2000));
    expect(queryByRole("alert")).toBeNull();
  });
});
