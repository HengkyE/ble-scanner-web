/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["leaflet", "react-leaflet", "@heroui/react"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
