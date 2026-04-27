/** @type {import('next').NextConfig} */

const nextConfig = {
  output: 'export',
  distDir: '../public',
  env: {
    name: 'My Kasm Registry',
    description: 'A custom registry for Kasm Workspaces images.',
    icon: '/img/logo.svg',
    listUrl: 'https://syscall00.github.io/kasm-registry/',
    contactUrl: 'https://github.com/syscall00/kasm-registry/issues',
  },
  reactStrictMode: true,
  basePath: '/kasm-registry/1.0',
  trailingSlash: true,
  images: {
    unoptimized: true,
  }
}

module.exports = nextConfig
