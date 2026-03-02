import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // better-sqlite3 is a native Node.js module — must NOT be bundled by Turbopack/webpack
  serverExternalPackages: ['better-sqlite3'],
  // AG Grid 31.x is incompatible with React 19 StrictMode's reappearLayoutEffects cycle:
  // refs are re-attached and ResizeObserver receives a null element. Disable in dev.
  reactStrictMode: false,
}

export default nextConfig
