import type { NextConfig } from "next";

// Cache Components / partial prefetching are off: the landing page uses time-based revalidation
// and shared stories are rendered per request.
const nextConfig: NextConfig = {};

export default nextConfig;
