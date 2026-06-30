/** @type {import('next').NextConfig} */
const nextConfig = {
  // The webhook handler returns 200 immediately and finishes work via `after()`.
  // No special config required for that, but we keep this file as the project anchor.
  reactStrictMode: true,
};

export default nextConfig;
