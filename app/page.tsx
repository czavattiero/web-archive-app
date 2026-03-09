export default function Home() {
  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "sans-serif",
      textAlign: "center",
      padding: "40px"
    }}>

      <img
        src="/screenly.png"
        alt="Screenly"
        style={{ width: 220, marginBottom: 20 }}
      />

      <h2 style={{ marginBottom: 10 }}>
        Because you have more important things to do
      </h2>

      <p style={{ maxWidth: 600, marginBottom: 40 }}>
        Screenly allows you to automate the capture of webpages and schedule
        future captures. The captured pages are saved as PDFs which can then
        be downloaded from your dashboard.
      </p>

      <div style={{
        display: "flex",
        gap: 40
      }}>

        <div style={{
          border: "1px solid #ddd",
          padding: 30,
          borderRadius: 10,
          width: 220
        }}>
          <h3>Basic</h3>
          <p>$9 / month</p>

          <a href="/api/checkout?plan=basic">
            <button style={{
              marginTop: 10,
              padding: "10px 20px",
              cursor: "pointer"
            }}>
              Choose Plan
            </button>
          </a>
        </div>

        <div style={{
          border: "1px solid #ddd",
          padding: 30,
          borderRadius: 10,
          width: 220
        }}>
          <h3>Professional</h3>
          <p>$29 / month</p>

          <a href="/api/checkout?plan=pro">
            <button style={{
              marginTop: 10,
              padding: "10px 20px",
              cursor: "pointer"
            }}>
              Choose Plan
            </button>
          </a>
        </div>

      </div>

    </main>
  )
}
