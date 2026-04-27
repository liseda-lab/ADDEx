"use client";
import { useTheme } from "../../../../styles/ThemeContext";
import { Dropdown } from "./Dropdown";

interface SelectorBlockProps {
  title: string;
  mainValue: string;
  setMainValue: (v: string) => void;
  secondaryValue?: string;
  setSecondaryValue?: (v: string) => void;
  mainOptions: string[];
  secondaryOptions?: string[];
  mainLabel?: string;
  secondaryLabel?: string;
  allowDeselect?: boolean;
  // Optional display mapping applied to the main (type) dropdown. Lets us
  // show alternative labels (e.g. "Target" for OREGANO Proteins) without
  // changing the stored value.
  mainDisplayFor?: (value: string) => string;
}

export default function SelectorBlock({
  title,
  mainValue,
  setMainValue,
  secondaryValue,
  setSecondaryValue,
  mainOptions,
  secondaryOptions = [],
  mainLabel = "Type",
  secondaryLabel = "Name",
  allowDeselect = true,
  mainDisplayFor,
}: SelectorBlockProps) {
  const colors = useTheme();
  const isLocked = !allowDeselect;

  return (
    <div
      style={{
        border: `1px solid ${colors.white}30`,
        borderRadius: 12,
        padding: "0.9rem",
        marginBottom: "0.8rem",
        // Subtle foreground-tinted overlay: reads on dark card in dark theme
        // and on white card in light theme.
        backgroundColor: `${colors.white}10`,
        opacity: isLocked ? 0.85 : 1,
      }}
    >
      <h3
        style={{
          marginBottom: "0.45rem",
          fontSize: "0.9rem",
          color: colors.white,
          fontWeight: 600,
        }}
      >
        {title}
      </h3>

      <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
        {isLocked ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 8,
              width: "100%",
            }}
          >
            <span
              style={{
                minWidth: 60,
                fontSize: "0.74rem",
                fontWeight: 600,
                color: colors.white,
              }}
            >
              {mainLabel}:
            </span>
            <span
              style={{
                flex: 1,
                padding: "5px 22px 5px 8px",
                borderRadius: 8,
                backgroundColor: `${colors.white}10`,
                color: colors.white,
                fontWeight: 500,
                fontSize: "0.8rem",
              }}
            >
              {mainValue
                ? mainDisplayFor
                  ? mainDisplayFor(mainValue)
                  : mainValue
                : "—"}
            </span>
          </div>
        ) : (
          <Dropdown
            label={mainLabel}
            inline
            options={mainOptions}
            value={mainValue}
            onChange={(val) => {
              setMainValue(val);
              if (setSecondaryValue) setSecondaryValue("");
            }}
            allowDeselect
            displayFor={mainDisplayFor}
          />
        )}
      </div>

      {secondaryValue !== undefined && setSecondaryValue && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            marginTop: 4,
          }}
        >
          <Dropdown
            label={secondaryLabel}
            inline
            options={secondaryOptions}
            value={secondaryValue}
            onChange={(val) => setSecondaryValue(val)}
            allowDeselect
            searchable
          />
        </div>
      )}
    </div>
  );
}
