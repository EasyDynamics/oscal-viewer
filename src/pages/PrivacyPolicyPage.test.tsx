import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PrivacyPolicyPage from "./PrivacyPolicyPage";

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

beforeEach(() => {
  stubMatchMedia(false);
  clearAllCookies();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<PrivacyPolicyPage />", () => {
  it("renders the top-level heading", () => {
    render(<PrivacyPolicyPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeInTheDocument();
  });

  it("renders the Overview, Data We Do Not Collect, and Cookies sections", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Data We Do Not Collect")).toBeInTheDocument();
    expect(screen.getByText(/Cookies.*Local Storage/)).toBeInTheDocument();
  });

  it("links to the project GitHub in the Contact section", () => {
    render(<PrivacyPolicyPage />);
    const link = screen.getByRole("link", { name: /GitHub repository/ });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/EasyDynamics/oscal-viewer",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it('shows "No preference set" when the consent cookie is absent', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText("No preference set")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Accept Cookies" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Decline Cookies" }),
    ).toBeInTheDocument();
  });

  it('flips to "Cookies accepted" and updates the Accept button after clicking Accept', () => {
    render(<PrivacyPolicyPage />);
    fireEvent.click(screen.getByRole("button", { name: "Accept Cookies" }));
    expect(screen.getByText("Cookies accepted")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cookies Accepted/ }),
    ).toBeInTheDocument();
  });

  it('flips to "Cookies declined" and updates the Decline button after clicking Decline', () => {
    render(<PrivacyPolicyPage />);
    fireEvent.click(screen.getByRole("button", { name: "Decline Cookies" }));
    expect(screen.getByText("Cookies declined")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cookies Declined/ }),
    ).toBeInTheDocument();
  });

  it("reads an existing accepted cookie on initial mount", () => {
    document.cookie = "cookie_consent=accepted; Path=/";
    render(<PrivacyPolicyPage />);
    expect(screen.getByText("Cookies accepted")).toBeInTheDocument();
  });

  it("reads an existing declined cookie on initial mount", () => {
    document.cookie = "cookie_consent=declined; Path=/";
    render(<PrivacyPolicyPage />);
    expect(screen.getByText("Cookies declined")).toBeInTheDocument();
  });

  it("uses reduced horizontal padding on mobile", () => {
    stubMatchMedia(true);
    const { container } = render(<PrivacyPolicyPage />);
    const outer = container.firstChild as HTMLElement;
    // Mobile padding is 20px 14px vs desktop 36px 24px
    expect(outer.style.padding).toBe("20px 14px");
  });

  it("uses standard horizontal padding on desktop", () => {
    stubMatchMedia(false);
    const { container } = render(<PrivacyPolicyPage />);
    const outer = container.firstChild as HTMLElement;
    expect(outer.style.padding).toBe("36px 24px");
  });
});
