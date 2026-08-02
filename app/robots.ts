import type { MetadataRoute } from "next"

const DEFAULT_SITE_URL = "https://timedshot.ca"

function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL
  return siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
