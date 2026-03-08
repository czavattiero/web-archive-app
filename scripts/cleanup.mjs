process.env.TZ = "America/Edmonton"

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const bucket = "captures"

async function cleanup() {

  console.log("Running cleanup job")

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 62)

  const { data: captures, error } = await supabase
    .from("captures")
    .select("*")
    .lt("captured_at", cutoff.toISOString())

  if (error) {
    console.log("Database error:", error)
    return
  }

  if (!captures || captures.length === 0) {
    console.log("No captures to delete")
    return
  }

  console.log(`Deleting ${captures.length} old captures`)

  for (const item of captures) {

    const file = item.file_path

    console.log("Deleting file:", file)

    const { error: storageError } = await supabase.storage
      .from(bucket)
      .remove([file])

    if (storageError) {
      console.log("Storage deletion error:", storageError)
    }

    await supabase
      .from("captures")
      .delete()
      .eq("id", item.id)

  }

  console.log("Cleanup complete")
}

cleanup()
