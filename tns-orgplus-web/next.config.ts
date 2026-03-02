import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // better-sqlite3 is a native Node.js module — must NOT be bundled by Turbopack/webpack
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfig
