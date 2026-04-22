import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import {
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { ReactNode } from "react";
import Layout from "./Layout";
import { ThemeProvider } from "../context/ThemeContext";
import { AuthProvider } from "../context/AuthContext";
import { OscalProvider } from "../context/OscalContext";

/* ───────── test helpers ───────── */

interface MqlStub {
  matches: boolean;
  listeners: Array<(e: MediaQueryListEvent) => void>;
  addEventListener: (t: "change", cb: (e: MediaQueryListEvent) => void) => void;
  removeEventListener: (t: "change", cb: (e: MediaQueryListEvent) => void) => void;
}

function makeMql(matches = false): MqlStub {
  const m: MqlStub = {
    matches,
    listeners: [],
    addEventListener: (_t, cb) => void m.listeners.push(cb),
    removeEventListener: (_t, cb) => {
      m.listeners = m.listeners.filter((l) => l !== cb);
    },
  };
  return m;
}

function stubMatchMedia(matches = false) {
  vi.stubGlobal("matchMedia", () => makeMql(matches));
}

function renderLayout(
  opts: {
    mobile?: boolean;
    initialPath?: string;
  } = {},
) {
  stubMatchMedia(opts.mobile ?? false);
  return render(
    <ThemeProvider>
      <AuthProvider>
        <OscalProvider>
          <MemoryRouter initialEntries={[opts.initialPath ?? "/"]}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<div>page: home</div>} />
                <Route
                  path="catalog"
                  element={<div>page: catalog</div>}
                />
                <Route
                  path="privacy"
                  element={<div>page: privacy</div>}
                />
              </Route>
            </Routes>
          </MemoryRouter>
        </OscalProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
}

const VALID_JWS = "hdr.payload.sig";

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ─────────────── Desktop shell ─────────────── */

describe("<Layout /> desktop shell", () => {
  it("renders the desktop tab bar with a Home tab and model tabs", () => {
    renderLayout();
    // Find the nav (tab bar) specifically to avoid the footer / other NavLinks
    const nav = document.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(within(nav as HTMLElement).getByText("Home")).toBeInTheDocument();
    // Catalog tab from oscalModels
    expect(within(nav as HTMLElement).getByText("Catalog")).toBeInTheDocument();
  });

  it("does not render the hamburger button on desktop", () => {
    renderLayout();
    expect(
      screen.queryByRole("button", { name: /Toggle navigation menu/ }),
    ).not.toBeInTheDocument();
  });

  it("renders the default route via <Outlet />", () => {
    renderLayout();
    expect(screen.getByText("page: home")).toBeInTheDocument();
  });

  it("includes a Content Registry link in the desktop tab bar", () => {
    renderLayout();
    const nav = document.querySelector("nav") as HTMLElement;
    const link = within(nav).getByRole("link", {
      name: /Content Registry/,
    });
    expect(link).toHaveAttribute("href", "https://registry.oscal.io");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders a Privacy Policy link in the footer", () => {
    renderLayout();
    const footer = document.querySelector("footer") as HTMLElement;
    expect(
      within(footer).getByRole("link", { name: /Privacy Policy/ }),
    ).toBeInTheDocument();
  });

  it("renders the CookieBanner (visible when consent is unset)", () => {
    renderLayout();
    expect(screen.getByText(/This site uses a cookie/)).toBeInTheDocument();
  });
});

/* ─────────────── Mobile shell ─────────────── */

describe("<Layout /> mobile shell", () => {
  it("renders the hamburger toggle button", () => {
    renderLayout({ mobile: true });
    expect(
      screen.getByRole("button", { name: /Toggle navigation menu/ }),
    ).toBeInTheDocument();
  });

  it("does not render the desktop tab bar on mobile", () => {
    renderLayout({ mobile: true });
    // There's no <nav> in the mobile layout; the mobile menu isn't rendered
    // until the hamburger is clicked.
    expect(document.querySelector("nav")).toBeNull();
  });

  it("opens the menu overlay when the hamburger is clicked", () => {
    renderLayout({ mobile: true });
    fireEvent.click(
      screen.getByRole("button", { name: /Toggle navigation menu/ }),
    );
    // The mobile menu renders its own Home link
    expect(screen.getAllByText("Home").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/Content Registry/).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("closes the menu on a mousedown outside of it", () => {
    renderLayout({ mobile: true });
    const toggle = screen.getByRole("button", {
      name: /Toggle navigation menu/,
    });
    fireEvent.click(toggle);
    // Menu is open; Home appears (along with its original in the header)
    expect(screen.getByText("Home")).toBeInTheDocument();

    // Fire a mousedown on body (outside the hamburger and menu)
    fireEvent.mouseDown(document.body);
    // Home text from the mobile menu should now be gone
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });

  it("closes the menu on a touchstart outside of it", () => {
    renderLayout({ mobile: true });
    fireEvent.click(
      screen.getByRole("button", { name: /Toggle navigation menu/ }),
    );
    fireEvent.touchStart(document.body);
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });

  it("keeps the menu open when the hamburger is the tap target", () => {
    renderLayout({ mobile: true });
    const toggle = screen.getByRole("button", {
      name: /Toggle navigation menu/,
    });
    fireEvent.click(toggle);
    // The handler early-returns when the target is inside the hamburger
    fireEvent.mouseDown(toggle);
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("closes the menu when a route-change NavLink is activated", () => {
    renderLayout({ mobile: true });
    fireEvent.click(
      screen.getByRole("button", { name: /Toggle navigation menu/ }),
    );
    // Find the Catalog menu item (rendered in the mobile overlay) and click
    const catalogLink = screen.getByRole("link", { name: /Catalog/ });
    fireEvent.click(catalogLink);
    // The location-change effect collapses the menu
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });

  it("renders the page content on mobile too", () => {
    renderLayout({ mobile: true, initialPath: "/catalog" });
    expect(screen.getByText("page: catalog")).toBeInTheDocument();
  });
});

/* ─────────────── JWT popover ─────────────── */

describe("<Layout /> JWT popover", () => {
  function findJwtButton() {
    return screen.getByRole("button", {
      name: /JWT|Load JWT|JWT loaded/i,
    });
  }

  it("opens the popover on click and shows a Save-disabled prompt when empty", () => {
    renderLayout();
    fireEvent.click(findJwtButton());
    expect(screen.getByText(/Load JWT Token/)).toBeInTheDocument();
    // Save button is disabled while the draft is empty
    const save = screen.getByRole("button", { name: /Save Token/ });
    expect(save).toBeDisabled();
  });

  it("stores a valid JWT via Save", () => {
    renderLayout();
    fireEvent.click(findJwtButton());
    const textarea = screen.getByPlaceholderText(/Paste your JWT here/);
    fireEvent.change(textarea, { target: { value: VALID_JWS } });
    fireEvent.click(screen.getByRole("button", { name: /Save Token/ }));
    // After save, popover closes and the icon now says "JWT loaded"
    expect(
      screen.getByRole("button", { name: /JWT loaded/ }),
    ).toBeInTheDocument();
  });

  it("rejects an obviously malformed JWT with an inline hint", () => {
    renderLayout();
    fireEvent.click(findJwtButton());
    const textarea = screen.getByPlaceholderText(/Paste your JWT here/);
    fireEvent.change(textarea, { target: { value: "not a jwt" } });
    // Inline validation message appears
    expect(
      screen.getByText(/Not a valid JWT format/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Token/ })).toBeDisabled();
  });

  it("saves when the user presses Enter in the textarea", () => {
    renderLayout();
    fireEvent.click(findJwtButton());
    const textarea = screen.getByPlaceholderText(/Paste your JWT here/);
    fireEvent.change(textarea, { target: { value: VALID_JWS } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(
      screen.getByRole("button", { name: /JWT loaded/ }),
    ).toBeInTheDocument();
  });

  it("allows Shift+Enter for newlines without submitting", () => {
    renderLayout();
    fireEvent.click(findJwtButton());
    const textarea = screen.getByPlaceholderText(/Paste your JWT here/);
    fireEvent.change(textarea, { target: { value: VALID_JWS } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    // Still in "Load JWT" mode; popover did not submit
    expect(screen.getByText(/Load JWT Token/)).toBeInTheDocument();
  });

  it("shows the loaded view and clears the token via the Clear button", () => {
    // Pre-seed a valid token
    sessionStorage.setItem("oscal_jwt", VALID_JWS);
    renderLayout();

    fireEvent.click(
      screen.getByRole("button", { name: /JWT loaded/ }),
    );
    expect(screen.getByText(/JWT Token Loaded/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Clear Token/ }));
    // After clear, the button reverts to "Load JWT token"
    expect(
      screen.getByRole("button", { name: /Load JWT token/ }),
    ).toBeInTheDocument();
  });

  it("closes the popover on outside mousedown", () => {
    renderLayout();
    fireEvent.click(findJwtButton());
    expect(screen.getByText(/Load JWT Token/)).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText(/Load JWT Token/)).not.toBeInTheDocument();
  });
});

/* ─────────────── Theme toggle ─────────────── */

describe("<Layout /> theme toggle", () => {
  it("renders the theme toggle button with an accessible label", () => {
    renderLayout();
    expect(
      screen.getByRole("button", { name: /Switch to (light|dark) mode/ }),
    ).toBeInTheDocument();
  });

  it("flips the theme when clicked", () => {
    renderLayout();
    const toggle = screen.getByRole("button", {
      name: /Switch to (light|dark) mode/,
    });
    const before = document.documentElement.getAttribute("data-theme");
    fireEvent.click(toggle);
    const after = document.documentElement.getAttribute("data-theme");
    expect(before).not.toBe(after);
  });
});
