"use client";

import { ReactNode } from "react";
import PageText from "../general/PageText";
import Banner from "../general/Banner";
import { useTheme } from "../../../../styles/ThemeContext";
import Navbar from "./Navbar";

interface CardsPageProps {
  title?: string;
  banner?: {
    title: string;
    subtitle?: string;
    description?: string;
    buttonText?: string;
    buttonHref?: string;
    icon?: any;
  };
  children: ReactNode;
  actions?: ReactNode;
  topActions?: ReactNode;
}

export default function CardsPage({ title, banner, children, actions, topActions }: CardsPageProps) {
  const colors = useTheme();
  return (
    <>
      <style>{`
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.25rem;
          margin-top: 0.5rem;
        }

        .cards-actions {
          margin-top: 2rem;
          display: flex;
          justify-content: center;
        }

        .primary-btn {
          padding: 0.75rem 2.5rem;
          border-radius: 10px;
          border: none;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s ease, transform 0.15s ease;
          background: ${colors.buttons};
          color: #FFFFFF;
        }

        .primary-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          transform: none;
        }

        .primary-btn:not(:disabled):hover {
          opacity: 0.88;
          transform: translateY(-1px);
        }

        @media (max-width: 860px) {
          .cards-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <Navbar />

      <PageText title={title || ""}>
        {topActions && (
          <div style={{ marginBottom: "1rem" }}>
            {topActions}
          </div>
        )}

        {banner && <Banner {...banner} />}

        <div className="cards-grid">
          {children}
        </div>

        {actions && (
          <div className="cards-actions">
            {actions}
          </div>
        )}
      </PageText>
    </>
  );
}