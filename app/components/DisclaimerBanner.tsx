"use client"

import { useState } from "react"

export default function DisclaimerBanner() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      style={{
        background: "#FFFBEB",
        border: "1px solid #FCD34D",
        borderRadius: 12,
        padding: "14px 18px",
        marginBottom: 20,
        fontSize: 13,
        color: "#92400E",
        lineHeight: 1.6,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 600 }}>Important Notice: URL Capture Limitations — </span>
          Capture attempts for certain URLs (e.g., job posting platforms) may fail due to restrictions
          enforced by those websites. It is your responsibility to verify that captures have completed
          successfully.{" "}
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: "none",
              border: "none",
              color: "#92400E",
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
              fontSize: 13,
              textDecoration: "underline",
            }}
          >
            {expanded ? "Show less" : "Learn more"}
          </button>

          {expanded && (
            <ul style={{ marginTop: 10, paddingLeft: 20, marginBottom: 0 }}>
              <li style={{ marginBottom: 6 }}>
                <strong>Failed captures will not count toward your monthly URL limit.</strong> If an
                immediate capture attempt is unsuccessful, that URL will not be deducted from your
                plan&apos;s monthly allowance (e.g., 15 or 40 URLs).
              </li>
              <li style={{ marginBottom: 6 }}>
                <strong>Scheduled captures will still be retried.</strong> The system will continue
                attempting to capture a failed URL according to your selected schedule (e.g., weekly,
                biweekly, every 29 or 30 days, or on a specific date).
              </li>
              <li style={{ marginBottom: 6 }}>
                <strong>Some platforms are more restrictive than others.</strong> URLs from sites such
                as <strong>Indeed</strong> and <strong>Glassdoor</strong> are more likely to fail due
                to stricter anti-scraping and blocking mechanisms.
              </li>
            </ul>
          )}
          {expanded && (
            <p style={{ marginTop: 10, marginBottom: 0 }}>
              We recommend regularly reviewing your capture history to confirm successful captures and
              take any necessary action.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
