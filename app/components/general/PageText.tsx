"use client";
import AnimatedBackground from "../general/AnimatedBg";
import { useTheme } from "../../../../styles/ThemeContext";

export interface Section {
  title: string;
  body: string;
  accentColor: string;
  icon: React.ReactNode;
  fullWidth?: boolean;
  link?: { url: string; label: string; icon?: React.ReactNode };
}

interface PageLayoutProps {
  title: string;
  icon?: React.ReactNode;
  sections?: Section[];
  sectionsLayout?: "stack" | "grid";
  children?: React.ReactNode;
}

export default function PageText({
  title,
  icon,
  sections,
  sectionsLayout = "stack",
  children,
}: PageLayoutProps) {
  const colors = useTheme();
  const cardBg = colors.card;
  return (
    <>
      <style>{`
        .page-section-grid {
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }
        .page-section-grid.is-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.1rem;
        }
        .page-section-card {
          padding: 1.5rem 1.75rem;
          border-radius: 14px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          backdrop-filter: blur(10px);
          display: flex;
          flex-direction: column;
        }
        .page-section-header {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }
        .page-section-badge {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .page-section-title {
          font-weight: 700;
          font-size: 1.05rem;
          line-height: 1.3;
          align-self: center;
        }
        .page-section-body {
          line-height: 1.8;
          margin: 0;
          font-size: 1rem;
          text-align: justify;
        }
        @media (max-width: 600px) {
          .page-section-grid.is-grid {
            grid-template-columns: 1fr;
          }
          .page-section-card { padding: 1.1rem; }
          .page-section-badge { width: 34px; height: 34px; border-radius: 8px; }
          .page-section-title { font-size: 0.97rem; }
          .page-section-body { font-size: 0.92rem; text-align: left; }
        }
      `}</style>

      <main
        id="main-content"
        style={{
          minHeight: "100vh",
          paddingTop: "80px",
          paddingBottom: "40px",
          paddingLeft: "1.5rem",
          paddingRight: "1.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: colors.background,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <AnimatedBackground />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxWidth: "clamp(700px, 90%, 1200px)",
            padding: "2rem",
          }}
        >
          {(title || icon) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                marginBottom: "1.5rem",
                fontSize: "1.3rem",
                fontWeight: 600,
                color: colors.white,
              }}
            >
              {icon}
              {title}
            </div>
          )}

          {children}

          {sections && sections.length > 0 && (
            <div className={`page-section-grid${sectionsLayout === "grid" ? " is-grid" : ""}`}>
              {sections.map((s) => (
                <div
                  key={s.title}
                  className="page-section-card"
                  style={{
                    background: cardBg,
                    border: `1px solid ${s.accentColor}60`,
                    borderLeft: `3px solid ${s.accentColor}`,
                    ...(sectionsLayout === "grid" && s.fullWidth
                      ? { gridColumn: "1 / -1" }
                      : {}),
                  }}
                >
                  <div className="page-section-header">
                    <div
                      className="page-section-badge"
                      aria-hidden="true"
                      style={{
                        background: `${s.accentColor}22`,
                        border: `1px solid ${s.accentColor}55`,
                      }}
                    >
                      {s.icon}
                    </div>
                    <div
                      className="page-section-title"
                      style={{ color: s.accentColor }}
                    >
                      {s.title}
                    </div>
                  </div>
                  <p
                    className="page-section-body"
                    style={{ color: colors.white }}
                  >
                    {s.body}
                  </p>
                  {s.link && (
                    <a
                      href={s.link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        // Push button to the bottom of the flex column so it
                        // lands at roughly the same vertical line as where
                        // neighbouring cards' text ends, then right-align it
                        // so it sits tight in the bottom-right corner.
                        marginTop: "auto",
                        alignSelf: "flex-end",
                        padding: "0.4rem 0.85rem",
                        borderRadius: 8,
                        textDecoration: "none",
                        border: `1px solid ${s.accentColor}`,
                        color: s.accentColor,
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        minHeight: 30,
                      }}
                    >
                      {s.link.icon}
                      {s.link.label}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}