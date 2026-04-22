import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import CookieBanner from "./CookieBanner";

/** Stub matchMedia to always report "not mobile" (unless a test overrides). */
function stubMatchMedia(mobile = false) {
  vi.stubGlobal("matchMedia", () => ({
    matches: mobile,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function clearAllCookies() {
  document.cookie
    .split("; ")
    .map((c) => c.split("=")[0])
    .filter(Boolean)
    .forEach((name) => {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    });
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

beforeEach(() => {
  clearAllCookies();
  stubMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<CookieBanner />", () => {
  it("renders the banner when no consent cookie is set", () => {
    render(<CookieBanner />, { wrapper });
    expect(screen.getByText(/This site uses a cookie/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("renders a Learn more link to /privacy", () => {
    render(<CookieBanner />, { wrapper });
    const link = screen.getByRole("link", { name: /Learn more/ });
    expect(link).toHaveAttribute("href", "/privacy");
  });

  it("hides itself once consent has been accepted", () => {
    const { container } = render(<CookieBanner />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(container.firstChild).toBeNull();
  });

  it("hides itself once consent has been declined", () => {
    const { container } = render(<CookieBanner />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(container.firstChild).toBeNull();
  });

  it("does not render when a prior consent cookie is already set", () => {
    document.cookie = "cookie_consent=accepted; Path=/";
    const { container } = render(<CookieBanner />, { wrapper });
    expect(container.firstChild).toBeNull();
  });

  it("applies mobile-specific styling when isMobile is true", () => {
    stubMatchMedia(true);
    const { container } = render(<CookieBanner />, { wrapper });
    const wrapperDiv = container.firstChild as HTMLElement;
    // Mobile flips the layout to column
    expect(wrapperDiv.style.flexDirection).toBe("column");
  });
});
