/** @type {import('next').NextConfig} */
const isExport = process.env.BUILD_EXPORT === "1";
const basePath = isExport
  ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "/FarmVoice")
  : undefined;

const nextConfig = {
  ...(isExport ? { output: "export" } : {}),
  ...(basePath ? { basePath } : {}),
  images: { unoptimized: true },
};

export default nextConfig;