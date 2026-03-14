import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // GitHub Pages: 레포 이름이 서브경로가 됨 (예: username.github.io/forex-signal)
  // 커스텀 도메인 사용 시 아래 두 줄 제거
  basePath: isProd ? '/forex-signal' : '',
  assetPrefix: isProd ? '/forex-signal/' : '',
  env: {
    NEXT_PUBLIC_IS_DEV: isProd ? '' : 'true',
  },
};

export default nextConfig;
