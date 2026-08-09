import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"

dotenv.config()

const BUCKET = "captures"
const PAGE_SIZE = 1000
const PROTECTED_USER_IDS = [
  "c5175986-c053-432d-87ee-5604d15486c3",
  "2bb803f8-33cd-4e07-8499-314d58a37c22",
  "fab8bff8-e060-4319-83cc-870969f7c4d3",
  "9d96afaf-a788-4f36-80f3-d81b9bd00b26",
  "5fb9a52d-3a9e-4a25-ba23-64e3883c8cca",
  "d7bb04dc-1e0a-4a5f-af0b-2cbbf726953a",
  "473de16d-6e50-4eca-af75-95456a34aa32",
  "e2477ad7-1860-46c5-b7dc-f8be64e8f662",
  "a7e32958-e1b0-4e3a-8681-af9055d08d44",
  "e50b67b8-22c5-41b9-9a2c-d1043b30bf2b",
  "c8136308-acfa-4fff-abf0-56a3b5f40e31",
  "07d5d485-7814-4439-aff1-884e6c5ec80f",
]

function requireEnv(name) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

const supabase = createClient(
  requireEnv("SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY")
)

const confirmDeletes = process.argv.includes("--confirm")

async function fetchAllCapturePaths({ protectedOnly = false } = {}) {
  const paths = new Set()
  let from = 0

  while (true) {
    let query = supabase
      .from("captures")
      .select("file_path")
      .not("file_path", "is", null)
      .range(from, from + PAGE_SIZE - 1)

    if (protectedOnly) {
      query = query.in("user_id", PROTECTED_USER_IDS)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message || JSON.stringify(error))
    }

    if (!data || data.length === 0) {
      break
    }

    for (const row of data) {
      if (row.file_path) {
        paths.add(row.file_path)
      }
    }

    if (data.length < PAGE_SIZE) {
      break
    }

    from += PAGE_SIZE
  }

  return paths
}

async function listStorageObjects(prefix = "") {
  const objects = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    })

    if (error) {
      throw new Error(
        `Failed to list storage objects for "${prefix || "/"}": ${error.message || JSON.stringify(error)}`
      )
    }

    if (!data || data.length === 0) {
      break
    }

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      const isFolder = !entry.id

      if (isFolder) {
        const nestedObjects = await listStorageObjects(path)
        objects.push(...nestedObjects)
        continue
      }

      objects.push({
        path,
        size: entry.metadata?.size ?? null,
      })
    }

    if (data.length < PAGE_SIZE) {
      break
    }

    offset += PAGE_SIZE
  }

  return objects
}

async function runCleanup() {
  console.log(
    confirmDeletes
      ? "🧹 Starting orphaned capture cleanup (CONFIRM MODE)"
      : "🧪 Starting orphaned capture cleanup (DRY RUN)"
  )

  console.log("🔒 Loading protected file paths from capture history...")
  const protectedPaths = await fetchAllCapturePaths({ protectedOnly: true })
  console.log(
    `🔒 Loaded ${protectedPaths.size} protected file path(s) across ${PROTECTED_USER_IDS.length} user(s)`
  )

  console.log("📄 Loading all capture file paths from the captures table...")
  const activeCapturePaths = await fetchAllCapturePaths()
  console.log(`📄 Loaded ${activeCapturePaths.size} referenced capture file path(s)`)

  console.log(`🪣 Listing all objects in the "${BUCKET}" storage bucket...`)
  const storageObjects = await listStorageObjects()
  console.log(`🪣 Found ${storageObjects.length} storage object(s)`)

  let totalScanned = 0
  let totalProtectedExcluded = 0
  let totalDeletedOrWouldDelete = 0
  let totalSkippedErrors = 0

  for (const object of storageObjects) {
    totalScanned++

    if (object.path.endsWith(".emptyFolderPlaceholder")) {
      continue
    }

    if (activeCapturePaths.has(object.path)) {
      continue
    }

    if (protectedPaths.has(object.path)) {
      totalProtectedExcluded++
      console.warn(`🚨 PROTECTED SKIP: ${object.path}`)
      continue
    }

    if (!confirmDeletes) {
      console.log(
        `🧪 Would delete orphan: ${object.path}${object.size != null ? ` (${object.size} bytes)` : ""}`
      )
      totalDeletedOrWouldDelete++
      continue
    }

    try {
      const { error } = await supabase.storage.from(BUCKET).remove([object.path])

      if (error) {
        totalSkippedErrors++
        console.error(`❌ Failed to delete ${object.path}: ${error.message || JSON.stringify(error)}`)
        continue
      }

      console.log(
        `🗑️ Deleted orphan: ${object.path}${object.size != null ? ` (${object.size} bytes)` : ""}`
      )
      totalDeletedOrWouldDelete++
    } catch (error) {
      totalSkippedErrors++
      console.error(`❌ Failed to delete ${object.path}: ${error.message}`)
    }
  }

  console.log("")
  console.log("✅ Orphan cleanup summary")
  console.log(`- Total objects scanned: ${totalScanned}`)
  console.log(`- Total protected-excluded: ${totalProtectedExcluded}`)
  console.log(
    `- Total ${confirmDeletes ? "deleted" : "would-delete"}: ${totalDeletedOrWouldDelete}`
  )
  console.log(`- Total skipped due to error: ${totalSkippedErrors}`)
}

runCleanup().catch((error) => {
  console.error("❌ Orphan cleanup failed:", error.message || error)
  process.exit(1)
})
