"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ArchivePage() {

  const [captures, setCaptures] = useState<any[]>([]);

  useEffect(() => {
    loadCaptures();
  }, []);

  async function loadCaptures() {

    const { data, error } = await supabase
      .from("screenshot_jobs")
      .select("*")
      .eq("status", "complete");

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      setCaptures(data);
    }
  }

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Archive Timeline</h1>

      {captures.length === 0 && (
        <p>No captures yet.</p>
      )}

      {captures.map((capture) => (
        <div
          key={capture.id}
          style={{
            border: "1px solid #ddd",
            padding: "15px",
            marginTop: "15px",
            borderRadius: "8px"
          }}
        >

          <div>
            <strong>URL:</strong> {capture.url}
          </div>

          <div style={{ marginTop: "10px" }}>
            <a
              href={capture.image_url}
              target="_blank"
              style={{
                background: "#1e293b",
                color: "white",
                padding: "8px 12px",
                borderRadius: "5px",
                textDecoration: "none"
              }}
            >
              View Capture
            </a>
          </div>

        </div>
      ))}

    </div>
  );
}
