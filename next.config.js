/** @type {import('next').NextConfig} */
const nextConfig = {
    // 빌드 최적화
    typescript: {
        ignoreBuildErrors: true,
    },

    // 이미지 최적화
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'placehold.co',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'ecimg.cafe24img.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'firebasestorage.googleapis.com',
                port: '',
                pathname: '/**',
            },
        ],
        unoptimized: false,
    },

    // CSS 최적화
    experimental: {
        // optimizeCss: true, // Vercel에서 문제가 있어서 비활성화
    },
};

module.exports = nextConfig;
