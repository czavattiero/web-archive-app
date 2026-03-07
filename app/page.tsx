"use client";

export default function Home() {

  const selectPlan = (plan: string) => {

    // redirect user to signup page with selected plan
    window.location.href = `/signup?plan=${plan}`;

  };

  return (
    <main
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f4f4f4",
        fontFamily: "Arial"
      }}
    >

      {/* Login button */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20
        }}
      >
        <a href="/login">
          Log In
        </a>
      </div>

      <div style={{ textAlign: "center" }}>

        <h1 style={{ fontSize: "42px", marginBottom: "20px" }}>
          Website Archiving Service
        </h1>

        <p style={{ fontSize: "18px", marginBottom: "40px" }}>
          Automated website archiving with scheduled, timestamped PDF 
captures.
          Secure dashboard access. 62-day retention policy.
        </p>

        <div
          style={{
            display: "flex",
            gap: "20px",
            justifyContent: "center"
          }}
        >

          <button
            onClick={() => selectPlan("basic")}
            style={{
              background: "black",
              color: "white",
              padding: "15px 25px",
              borderRadius: "8px",
              border: "none",
              fontSize: "16px",
              cursor: "pointer"
            }}
          >
            Start Basic ($15)
          </button>

          <button
            onClick={() => selectPlan("pro")}
            style={{
              background: "#1e293b",
              color: "white",
              padding: "15px 25px",
              borderRadius: "8px",
              border: "none",
              fontSize: "16px",
              cursor: "pointer"
            }}
          >
            Start Professional ($30)
          </button>

        </div>

      </div>

    </main>
  );
}

