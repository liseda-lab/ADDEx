"use client";

import Link from "next/link";
import { ElementType } from "react";
import { useTheme } from "../../../../styles/ThemeContext";

interface BannerProps {
    title: string;
    subtitle?: string;
    description?: string;
    buttonText?: string;
    buttonHref?: string;
    buttonLabel?: string;
    icon?: ElementType;
}

export default function Banner({ title, subtitle, description, buttonText, buttonHref, buttonLabel, icon: Icon }: BannerProps) {
    const colors = useTheme();
    return (
        <div
            style={{
                padding: "1.75rem",
                borderRadius: "16px",
                background: colors.card,
                border: `1px solid ${colors.grayDark}`,
                boxShadow: "0 6px 25px rgba(0,0,0,0.35)",
                marginBottom: "2rem",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <div style={{ marginBottom: "0.75rem" }}>
                <h2
                    style={{
                        color: colors.white,
                        fontSize: "1.3rem",
                        fontWeight: 700,
                        margin: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                    }}
                >
                    {Icon && <Icon size={22} weight="duotone" />}
                    {title}
                </h2>
            </div>

            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                    {subtitle && (
                        <h3 style={{ color: colors.white, margin: "0.25rem 0 0 0", fontWeight: 500 }}>
                            {subtitle}
                        </h3>
                    )}
                    {description && (
                        <p style={{ color: colors.white, fontSize: "0.98rem", margin: "0.25rem 0 0 0", lineHeight: 1.6 }}>
                            {description}
                        </p>
                    )}
                </div>

                {buttonText && buttonHref && (
                    <div
                        style={{
                            flexShrink: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: "0.35rem",
                        }}
                    >
                        {buttonLabel && (
                            <span
                                style={{
                                    color: `${colors.white}bb`,
                                    fontSize: "0.78rem",
                                    fontWeight: 500,
                                }}
                            >
                                {buttonLabel}
                            </span>
                        )}
                        {/* Render the Link itself as the styled button. A
                            <button> nested inside <Link> produces invalid
                            <a><button> markup; the broken nesting stops the
                            click from navigating. An anchor styled as a button
                            is valid, still keyboard-accessible, and supports
                            modifier-click to open in a new tab. */}
                        <Link
                            href={buttonHref}
                            style={{
                                display: "inline-block",
                                padding: "0.85rem 1.25rem",
                                minWidth: "180px",
                                whiteSpace: "nowrap",
                                borderRadius: "10px",
                                border: "none",
                                fontSize: "0.95rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                background: colors.buttons,
                                color: "#FFFFFF",
                                textAlign: "center",
                                textDecoration: "none",
                                transition: "opacity 0.15s ease, transform 0.15s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                        >
                            {buttonText}
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}