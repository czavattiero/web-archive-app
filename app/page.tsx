export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #ffffff, #f7f8fb)",
        fontFamily: "system-ui, sans-serif",
        padding: "40px 80px",
        color: "#1F2937",
      }}
    >

      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* 🔥 BIGGER, CLEANER LOGO */}
        <img
          src="/screenly.png"
          alt="Screenly"
          style={{
            height: 55,       // ✅ reduced from oversized
            width: "auto",
            objectFit: "contain",
          }}
        />

        <a href="/login">
          <button
            style={{
              background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
              color: "white",
              border: "none",
              padding: "10px 22px",
              borderRadius: 10,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(106,17,203,0.25)",
            }}
          >
            Log in
          </button>
        </a>
      </div>

      {/* HERO */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 60,
          alignItems: "center",
          marginTop: 80,
        }}
      >
        {/* LEFT */}
        <div>
          <h1 style={{ fontSize: 48, fontWeight: 800, marginBottom: 20 }}>
            Automatically capture and archive any webpage
          </h1>

          <p
            style={{
              fontSize: 16,
              color: "#6B7280",
              lineHeight: 1.6,
              marginBottom: 30,
              maxWidth: 500,
            }}
          >
            Add a URL once. Screenly monitors and saves it as a PDF — so you never lose important content again.
          </p>

          <div style={{ display: "flex", gap: 12 }}>
            <a href="/signup">
              <button
                style={{
                  background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
                  color: "white",
                  border: "none",
                  padding: "14px 28px",
                  borderRadius: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 12px 25px rgba(106,17,203,0.25)",
                }}
              >
                Start Free
              </button>
            </a>

            <a href="/login">
              <button
                style={{
                  background: "white",
                  border: "1px solid #E5E7EB",
                  padding: "14px 24px",
                  borderRadius: 12,
                  cursor: "pointer",
                }}
              >
                Log in
              </button>
            </a>
          </div>
        </div>

        {/* RIGHT */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
          }}
        >
          {/* ⚠️ FIX: Make sure this file exists in /public */}
          <img
            src="/dashboard-preview.png"
            alt="Dashboard preview"
            style={{
              width: "100%",
              maxWidth: 500,
              borderRadius: 16,
              boxShadow: "0 30px 60px rgba(0,0,0,0.2)",
              border: "1px solid #eee",
            }}
          />
        </div>
      </section>

      {/* TRUST STRIP */}
      <section
        style={{
          textAlign: "center",
          marginTop: 100,
          paddingTop: 30,
          borderTop: "1px solid #eee",
        }}
      >
        <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 10 }}>
          Trusted for monitoring important web content
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 30, color: "#9CA3AF", fontSize: 13 }}>
          <span>Legal Teams</span>
          <span>Researchers</span>
          <span>Compliance</span>
          <span>Startups</span>
        </div>
      </section>

    </main>
  )
}
