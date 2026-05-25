"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, MagnifyingGlass, Code, Book, GithubLogo, CaretDown, CaretRight, Gear, Lightning, Compass, Lightbulb, UserFocus } from "phosphor-react";
import { useThemeContext } from "../../../../styles/ThemeContext";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const pathname = usePathname();
  const { theme, palette: colors } = useThemeContext();
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const [setupSubmenuOpen, setSetupSubmenuOpen] = useState(false);
  // When the user clicks Setup, pin the sub-flyout open so the cursor can
  // leave the row to reach an option without the menu collapsing. Pin clears
  // on outside-click, Esc, a sub-option click, or a second click on Setup.
  const [setupPinned, setSetupPinned] = useState(false);
  const searchMenuRef = useRef<HTMLDivElement>(null);
  // Small delay on hover-close so the cursor can traverse the gap between
  // the trigger and the panel (and between Setup and its sub-flyout) without
  // the menu collapsing under it.
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      // A pinned Setup keeps both the parent dropdown and the sub-flyout
      // open until the user explicitly dismisses it.
      if (setupPinned) return;
      setSearchMenuOpen(false);
      setSetupSubmenuOpen(false);
    }, 150);
  };
  // Separate timer for the Setup sub-flyout so the user can click Setup
  // without the hover-close racing the click. Without this, leaving the
  // Setup row to reach the sub-flyout (or just slowing down the click
  // gesture itself) would collapse the sub-menu before the click lands.
  const setupCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelSetupClose = () => {
    if (setupCloseTimerRef.current) {
      clearTimeout(setupCloseTimerRef.current);
      setupCloseTimerRef.current = null;
    }
  };
  const scheduleSetupClose = () => {
    cancelSetupClose();
    setupCloseTimerRef.current = setTimeout(() => {
      if (setupPinned) return;
      setSetupSubmenuOpen(false);
    }, 200);
  };

  // Keyboard nav helpers. Menu items are tabIndex={-1} so Tab from the
  // Search trigger goes straight to the next nav tab (Guide). Arrow keys
  // are the way into and around the menu.
  const focusItem = (selector: string) => {
    const root = searchMenuRef.current;
    if (!root) return;
    const el = root.querySelector(selector) as HTMLElement | null;
    el?.focus();
  };
  const focusSiblingMenuitem = (
    section: "root" | "sub",
    current: HTMLElement,
    dir: 1 | -1
  ) => {
    const root = searchMenuRef.current;
    if (!root) return;
    const items = Array.from(
      root.querySelectorAll(`[data-menu-section="${section}"]`)
    ) as HTMLElement[];
    const idx = items.indexOf(current);
    if (idx < 0 || items.length === 0) return;
    const next = items[(idx + dir + items.length) % items.length];
    next?.focus();
  };
  const closeAndRefocusTrigger = () => {
    setSearchMenuOpen(false);
    setSetupSubmenuOpen(false);
    setSetupPinned(false);
    focusItem('button[aria-haspopup="menu"][aria-expanded]');
  };

  // Close the Search dropdown when clicking outside or pressing Esc. Same
  // pattern as the "New Search" popover in PairSideMenu.
  useEffect(() => {
    if (!searchMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      const root = searchMenuRef.current;
      if (root && !root.contains(e.target as Node)) {
        setSearchMenuOpen(false);
        setSetupSubmenuOpen(false);
        setSetupPinned(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchMenuOpen(false);
        setSetupSubmenuOpen(false);
        setSetupPinned(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [searchMenuOpen]);

  // Neutral persona accent is theme-dependent, mirror the mapping used in
  // /pages/profile and PairSideMenu so the side-panel symbol matches.
  const neutralAccent =
    theme === "legacy" ? colors.fourthColor : colors.headingAccents[6];
  const neutralHref = `/pages/task?${new URLSearchParams({
    persona: "neutral_evaluator",
    personaName: "Neutral",
    accentColor: neutralAccent,
    icon: "Lightbulb",
  }).toString()}`;

  const tabs = useMemo(
    () => [
      {
        label: "Home",
        href: "/",
        icon: <House size={16} weight="bold" color={colors.white} aria-hidden="true" />,
      },
      {
        label: "Search",
        href: "/pages/profile",
        icon: <MagnifyingGlass size={16} weight="bold" color={colors.white} aria-hidden="true" />,
        matchPaths: [
          "/pages/profile",
          "/pages/profile/manual",
          "/pages/task",
          "/pages/search",
        ],
        dropdown: [
          {
            label: "Setup",
            icon: <Gear size={16} weight="bold" color={colors.white} aria-hidden="true" />,
            description: "Pick neutral explanations or run the questionnaire.",
            submenu: [
              {
                label: "Neutral",
                href: neutralHref,
                icon: <Lightbulb size={16} weight="bold" color={colors.white} aria-hidden="true" />,
                description: "Skip the questionnaire and use balanced, general-purpose explanations.",
              },
              {
                label: "Explanation Mode",
                href: "/pages/profile",
                icon: <UserFocus size={16} weight="bold" color={colors.white} aria-hidden="true" />,
                description: "Answer a few quick questions to find a profile that fits.",
              },
            ],
          },
          {
            label: "Quick Search",
            href: "/pages/search?viaQuickSkip=true",
            icon: <Lightning size={16} weight="bold" color={colors.white} aria-hidden="true" />,
            description: "Go straight to the search panel and set up your own run.",
          },
        ],
      },
      {
        label: "Guide",
        href: "/pages/guide",
        icon: <Compass size={16} weight="bold" color={colors.white} aria-hidden="true" />,
      },
      {
        label: "Software",
        href: "/pages/software",
        icon: <Code size={16} weight="bold" color={colors.white} aria-hidden="true" />,
      },
      {
        label: "Research",
        href: "/pages/about",
        icon: <Book size={16} weight="bold" color={colors.white} aria-hidden="true" />,
      },
      {
        label: "GitHub",
        href: "https://github.com/liseda-lab/ADDEx",
        external: true,
        icon: <GithubLogo size={16} weight="bold" color={colors.white} aria-hidden="true" />,
      },
    ],
    [colors.white, neutralHref]
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 900);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const activeTab =
    tabs.find((t) =>
      !t.external &&
      (t.matchPaths ? t.matchPaths.includes(pathname) : t.href === pathname)
    )?.label || "Home";

  const styles = {
    nav: {
      position: "fixed" as const,
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      height: 60,
      padding: "0 2rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background:
        theme === "dark"
          ? "#1F1F1F"
          : theme === "light"
            ? colors.card
            : theme === "highContrast"
              ? colors.black
              : `linear-gradient(to right, ${colors.darkblue} 30%, ${colors.secondColor} 70%, ${colors.secondColor} 100%)`,
      color: colors.white,
      boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
    },
    leftSection: {
      display: "flex",
      alignItems: "center",
      gap: "1rem",
    },
    tabsContainer: {
      display: isMobile ? "none" : "flex",
      alignItems: "center",
      gap: "1.25rem",
    },
    tab: (isActive: boolean) => ({
      display: "flex",
      alignItems: "center",
      justifyContent: "center" as const,
      gap: "0.45rem",
      padding: "0.45rem 0.9rem",
      cursor: "pointer",
      backgroundColor: isActive
        ? "color-mix(in srgb, currentColor 14%, transparent)"
        : "transparent",
      borderRadius: 6,
      fontWeight: 500,
      fontSize: "0.875rem",
      transition: "background-color 0.15s",
      whiteSpace: "nowrap" as const,
      minWidth: 120,
      boxSizing: "border-box" as const,
    }),
    burger: {
      display: isMobile ? "flex" : "none",
      flexDirection: "column" as const,
      gap: 4,
      cursor: "pointer",
      // Real <button> needs these resets so it matches the old <div> styling.
      background: "transparent",
      border: "none",
      padding: "12px 10px",
      // Meets WCAG 2.5.5 minimum 44×44 touch target on mobile.
      minWidth: 44,
      minHeight: 44,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      position: "absolute" as const,
      right: "1rem",
      top: "50%",
      transform: "translateY(-50%)",
    },
    mobileMenu: {
      position: "fixed" as const,
      top: 60,
      left: 0,
      right: 0,
      background: `linear-gradient(to bottom, ${colors.black} 20%, ${colors.blue} 60%, ${colors.blue} 100%)`,
      padding: "1rem 2rem",
      display: menuOpen ? "flex" : "none",
      flexDirection: "column" as const,
      gap: "0.5rem",
      zIndex: 45,
    },
  };

  return (
    <>
      <style>{`
        .addex-nav-tab {
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .addex-nav-tab:not([aria-current="page"]):hover {
          background-color: color-mix(in srgb, currentColor 14%, transparent) !important;
        }
        .addex-nav-tab:not([aria-current="page"]):focus-visible {
          outline: none;
          background-color: color-mix(in srgb, currentColor 14%, transparent) !important;
        }
      `}</style>
      <nav style={styles.nav}>
        <div style={styles.leftSection}>
          <div style={{ ...styles.tabsContainer, justifyContent: "center" }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.label;

              if ("dropdown" in tab && tab.dropdown) {
                const open = searchMenuOpen;
                const menuBg =
                  theme === "dark"
                    ? "#2A2A2A"
                    : theme === "light"
                      ? colors.card
                      : theme === "highContrast"
                        ? colors.black
                        : colors.darkblue;
                return (
                  <div
                    key={tab.label}
                    ref={searchMenuRef}
                    style={{ position: "relative" }}
                    onMouseEnter={() => {
                      cancelClose();
                      setSearchMenuOpen(true);
                    }}
                    onMouseLeave={scheduleClose}
                    onBlur={(e) => {
                      // Close when keyboard focus leaves the whole
                      // dropdown wrapper, otherwise tabbing out of the
                      // last menuitem leaves the panel hanging open.
                      const next = e.relatedTarget as Node | null;
                      if (
                        !searchMenuRef.current ||
                        !next ||
                        !searchMenuRef.current.contains(next)
                      ) {
                        if (setupPinned) return;
                        setSearchMenuOpen(false);
                        setSetupSubmenuOpen(false);
                      }
                    }}
                  >
                    <button
                      type="button"
                      className="addex-nav-tab"
                      // Hover is the trigger; mouse-click is a no-op so the
                      // menu doesn't toggle shut from under the cursor when
                      // the user clicks toward an option. Keyboard users open
                      // it by focusing the button or pressing Enter/Space.
                      onFocus={() => {
                        cancelClose();
                        setSearchMenuOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          cancelClose();
                          setSearchMenuOpen((v) => !v);
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          cancelClose();
                          setSearchMenuOpen(true);
                          // Defer so the menu has rendered before we focus.
                          requestAnimationFrame(() =>
                            focusItem('[data-menu-section="root"]')
                          );
                        } else if (e.key === "Escape") {
                          setSearchMenuOpen(false);
                          setSetupSubmenuOpen(false);
                          setSetupPinned(false);
                        }
                      }}
                      aria-haspopup="menu"
                      aria-expanded={open}
                      aria-current={isActive ? "page" : undefined}
                      style={{
                        ...styles.tab(isActive),
                        border: "none",
                        color: colors.white,
                      }}
                    >
                      {tab.icon}
                      {tab.label}
                      <CaretDown
                        size={12}
                        weight="bold"
                        color={colors.white}
                        aria-hidden="true"
                        style={{
                          transform: open ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.15s ease",
                        }}
                      />
                    </button>

                    {open && (
                      <div
                        role="menu"
                        aria-label={tab.label}
                        style={{
                          position: "absolute",
                          top: "calc(100% + 0.35rem)",
                          left: 0,
                          minWidth: 240,
                          background: menuBg,
                          border: `1px solid ${colors.grayDark}`,
                          borderRadius: 10,
                          boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
                          padding: "0.35rem",
                          zIndex: 60,
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        {tab.dropdown.map((item) => {
                          if ("submenu" in item && item.submenu) {
                            const subOpen = setupSubmenuOpen;
                            return (
                              <div
                                key={item.label}
                                style={{ position: "relative" }}
                                onMouseEnter={() => {
                                  cancelClose();
                                  cancelSetupClose();
                                  setSetupSubmenuOpen(true);
                                }}
                                onMouseLeave={() => {
                                  if (setupPinned) return;
                                  scheduleSetupClose();
                                }}
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  tabIndex={-1}
                                  data-menu-section="root"
                                  aria-haspopup="menu"
                                  aria-expanded={subOpen}
                                  onClick={() => {
                                    // Click pins the sub-flyout open so the
                                    // cursor can leave the Setup row to reach
                                    // an option without it auto-collapsing.
                                    // A second click unpins and closes it.
                                    cancelClose();
                                    cancelSetupClose();
                                    if (setupPinned) {
                                      setSetupPinned(false);
                                      setSetupSubmenuOpen(false);
                                    } else {
                                      setSetupPinned(true);
                                      setSetupSubmenuOpen(true);
                                    }
                                  }}
                                  onFocus={() => setSetupSubmenuOpen(true)}
                                  onKeyDown={(e) => {
                                    if (e.key === "ArrowDown") {
                                      e.preventDefault();
                                      focusSiblingMenuitem(
                                        "root",
                                        e.currentTarget,
                                        1
                                      );
                                    } else if (e.key === "ArrowUp") {
                                      e.preventDefault();
                                      focusSiblingMenuitem(
                                        "root",
                                        e.currentTarget,
                                        -1
                                      );
                                    } else if (e.key === "ArrowRight") {
                                      e.preventDefault();
                                      cancelSetupClose();
                                      setSetupSubmenuOpen(true);
                                      requestAnimationFrame(() =>
                                        focusItem('[data-menu-section="sub"]')
                                      );
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      closeAndRefocusTrigger();
                                    }
                                  }}
                                  style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: "0.6rem",
                                    padding: "0.6rem 0.75rem",
                                    borderRadius: 8,
                                    background: subOpen
                                      ? "color-mix(in srgb, currentColor 14%, transparent)"
                                      : "transparent",
                                    border: "none",
                                    textAlign: "left",
                                    color: colors.white,
                                    fontSize: "0.88rem",
                                    cursor: "pointer",
                                    transition: "background 0.15s ease",
                                  }}
                                >
                                  <span
                                    aria-hidden="true"
                                    style={{ marginTop: 2, flexShrink: 0 }}
                                  >
                                    {item.icon}
                                  </span>
                                  <span
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 2,
                                      minWidth: 0,
                                      flex: 1,
                                    }}
                                  >
                                    <span style={{ fontWeight: 600 }}>{item.label}</span>
                                    {item.description && (
                                      <span
                                        style={{
                                          color: `${colors.white}99`,
                                          fontSize: "0.76rem",
                                          lineHeight: 1.4,
                                        }}
                                      >
                                        {item.description}
                                      </span>
                                    )}
                                  </span>
                                  <CaretRight
                                    size={12}
                                    weight="bold"
                                    color={colors.white}
                                    aria-hidden="true"
                                    style={{ marginTop: 4, flexShrink: 0 }}
                                  />
                                </button>

                                {subOpen && (
                                  <div
                                    role="menu"
                                    aria-label={item.label}
                                    style={{
                                      position: "absolute",
                                      top: 0,
                                      left: "calc(100% + 0.35rem)",
                                      minWidth: 240,
                                      background: menuBg,
                                      border: `1px solid ${colors.grayDark}`,
                                      borderRadius: 10,
                                      boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
                                      padding: "0.35rem",
                                      zIndex: 70,
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 2,
                                    }}
                                  >
                                    {item.submenu.map((sub) => (
                                      <Link
                                        key={sub.label}
                                        href={sub.href}
                                        role="menuitem"
                                        tabIndex={-1}
                                        data-menu-section="sub"
                                        onClick={() => {
                                          cancelClose();
                                          cancelSetupClose();
                                          setSearchMenuOpen(false);
                                          setSetupSubmenuOpen(false);
                                          setSetupPinned(false);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "ArrowDown") {
                                            e.preventDefault();
                                            focusSiblingMenuitem(
                                              "sub",
                                              e.currentTarget,
                                              1
                                            );
                                          } else if (e.key === "ArrowUp") {
                                            e.preventDefault();
                                            focusSiblingMenuitem(
                                              "sub",
                                              e.currentTarget,
                                              -1
                                            );
                                          } else if (
                                            e.key === "ArrowLeft" ||
                                            e.key === "Escape"
                                          ) {
                                            e.preventDefault();
                                            setSetupSubmenuOpen(false);
                                            requestAnimationFrame(() =>
                                              focusItem(
                                                '[data-menu-section="root"][aria-haspopup="menu"]'
                                              )
                                            );
                                          }
                                        }}
                                        style={{
                                          display: "flex",
                                          alignItems: "flex-start",
                                          gap: "0.6rem",
                                          padding: "0.6rem 0.75rem",
                                          borderRadius: 8,
                                          textDecoration: "none",
                                          color: colors.white,
                                          fontSize: "0.88rem",
                                          transition: "background 0.15s ease",
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background =
                                            "color-mix(in srgb, currentColor 14%, transparent)";
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.background = "transparent";
                                        }}
                                      >
                                        <span
                                          aria-hidden="true"
                                          style={{ marginTop: 2, flexShrink: 0 }}
                                        >
                                          {sub.icon}
                                        </span>
                                        <span
                                          style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 2,
                                            minWidth: 0,
                                          }}
                                        >
                                          <span style={{ fontWeight: 600 }}>{sub.label}</span>
                                          {sub.description && (
                                            <span
                                              style={{
                                                color: `${colors.white}99`,
                                                fontSize: "0.76rem",
                                                lineHeight: 1.4,
                                              }}
                                            >
                                              {sub.description}
                                            </span>
                                          )}
                                        </span>
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return (
                            <Link
                              key={item.label}
                              href={item.href!}
                              role="menuitem"
                              tabIndex={-1}
                              data-menu-section="root"
                              onClick={() => setSearchMenuOpen(false)}
                              onKeyDown={(e) => {
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  focusSiblingMenuitem(
                                    "root",
                                    e.currentTarget,
                                    1
                                  );
                                } else if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  focusSiblingMenuitem(
                                    "root",
                                    e.currentTarget,
                                    -1
                                  );
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  closeAndRefocusTrigger();
                                }
                              }}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "0.6rem",
                                padding: "0.6rem 0.75rem",
                                borderRadius: 8,
                                textDecoration: "none",
                                color: colors.white,
                                fontSize: "0.88rem",
                                transition: "background 0.15s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background =
                                  "color-mix(in srgb, currentColor 14%, transparent)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{ marginTop: 2, flexShrink: 0 }}
                              >
                                {item.icon}
                              </span>
                              <span
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 2,
                                  minWidth: 0,
                                }}
                              >
                                <span style={{ fontWeight: 600 }}>{item.label}</span>
                                {item.description && (
                                  <span
                                    style={{
                                      color: `${colors.white}99`,
                                      fontSize: "0.76rem",
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    {item.description}
                                  </span>
                                )}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return tab.external ? (
                <a
                  key={tab.label}
                  href={tab.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="addex-nav-tab"
                  style={styles.tab(isActive)}
                >
                  {tab.icon}
                  {tab.label}
                </a>
              ) : (
                <Link
                  key={tab.label}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className="addex-nav-tab"
                  style={styles.tab(isActive)}
                >
                  {tab.icon}
                  {tab.label}
                </Link>
              );
            })}
            {!isMobile && <ThemeToggle />}
          </div>
        </div>

        <button
          type="button"
          style={styles.burger}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-menu"
        >
          <span style={{ width: 22, height: 2, background: colors.white, display: "block" }} />
          <span style={{ width: 22, height: 2, background: colors.white, display: "block" }} />
          <span style={{ width: 22, height: 2, background: colors.white, display: "block" }} />
        </button>
      </nav>

      <div id="mobile-nav-menu" style={styles.mobileMenu}>
        {tabs.flatMap((tab) => {
          const isActive = activeTab === tab.label;

          if ("dropdown" in tab && tab.dropdown) {
            // Flatten submenus so the mobile drawer stays a single tap
            // away from any destination — no nested flyouts on touch.
            return tab.dropdown.flatMap((item) => {
              if ("submenu" in item && item.submenu) {
                return item.submenu.map((sub) => (
                  <Link
                    key={`${tab.label}:${item.label}:${sub.label}`}
                    href={sub.href}
                    style={styles.tab(false)}
                    onClick={() => setMenuOpen(false)}
                  >
                    {sub.icon}
                    {sub.label}
                  </Link>
                ));
              }
              return [
                <Link
                  key={`${tab.label}:${item.label}`}
                  href={item.href!}
                  style={styles.tab(false)}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.icon}
                  {item.label}
                </Link>,
              ];
            });
          }

          return [
            tab.external ? (
              <a
                key={tab.label}
                href={tab.href}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.tab(isActive)}
                onClick={() => setMenuOpen(false)}
              >
                {tab.icon}
                {tab.label}
              </a>
            ) : (
              <Link
                key={tab.label}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                style={styles.tab(isActive)}
                onClick={() => setMenuOpen(false)}
              >
                {tab.icon}
                {tab.label}
              </Link>
            ),
          ];
        })}
      </div>
    </>
  );
}
