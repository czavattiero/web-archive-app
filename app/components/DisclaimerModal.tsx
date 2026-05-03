"use client"

import { useEffect, useState } from "react"

interface DisclaimerModalProps {
  userId: string
  onClose: () => void
}

export default function DisclaimerModal({ userId, onClose }: DisclaimerModalProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const key = `disclaimer_acknowledged_${userId}`
    if (localStorage.getItem(key)) {
      onClose()
    } else {
      setVisible(true)
    }
  }, [userId, onClose])

  if (!visible) return null

  function handleAcknowledge() {
    localStorage.setItem(`disclaimer_acknowledged_${userId}`, "true")
    onClose()
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 16,
          padding: "32px 36px",
          maxWidth: 560,
          width: "100%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          fontFamily: "'Inter', system-ui, sans-serif",
          color: "#111827",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 16,
            marginTop: 0,
            color: "#111827",
          }}
        >
          ⚠️ Important: URL Capture Limitations
        </h2>

        <p style={{ fontSize: 14, color: "#374151", marginBottom: 12, lineHeight: 1.7 }}>
          Capture attempts for certain URLs — particularly those hosted on job posting platforms — may
          fail due to restrictions or blocking mechanisms enforced by those websites.{" "}
          <strong>
            It is your responsibility to verify that both immediate and scheduled captures have
            completed successfully.
          </strong>
        </p>

        <p style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
          Please be aware of the following:
        </p>

        <ul style={{ fontSize: 14, color: "#374151", paddingLeft: 20, marginBottom: 16, lineHeight: 1.7 }}>
          <li style={{ marginBottom: 8 }}>
            <strong>Failed captures will not count toward your monthly URL limit.</strong> If an
            immediate capture attempt is unsuccessful, that URL will not be deducted from your
            plan&apos;s monthly allowance (e.g., 15 or 40 URLs).
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>Scheduled captures will still be retried.</strong> The system will continue
            attempting to capture a failed URL according to your selected schedule (e.g., weekly,
            biweekly, every 29 or 30 days, or on a specific date).
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>Some platforms are more restrictive than others.</strong> URLs from sites such as{" "}
            <strong>Indeed</strong> and <strong>Glassdoor</strong> are more likely to fail due to
            stricter anti-scraping and blocking mechanisms.
          </li>
        </ul>

        <p style={{ fontSize: 14, color: "#374151", marginBottom: 24, lineHeight: 1.7 }}>
          We recommend regularly reviewing your capture history to confirm successful captures and take
          any necessary action.
        </p>

        <button
          onClick={handleAcknowledge}
          style={{
            background: "#6A11CB",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            padding: "12px 28px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            width: "100%",
          }}
        >
          I Understand
        </button>
      </div>
    </div>
  )
}
