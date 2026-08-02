import type { MetadataRoute } from "next"

const DEFAULT_SITE_URL = "https://timedshot.ca"

const INDEXABLE_ROUTES = [
  { path: "/", changeFrequency: "weekly" as const, priority: 1 },
  { path: "/signup", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/login", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/forgot-password", changeFrequency: "monthly" as const, priority: 0.5 },
  { path: "/terms", changeFrequency: "yearly" as const, priority: 0.3 },
]

function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL
  return siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl()
  const lastModified = new Date()

  return INDEXABLE_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: path === "/" ? siteUrl : `${siteUrl}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
