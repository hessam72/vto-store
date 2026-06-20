import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
  webpack: (config, { isServer }) => {
    // Ensure React is resolved correctly for @react-three/fiber
    config.resolve.alias = {
      ...config.resolve.alias,
      react$: require.resolve('react'),
      'react-dom$': require.resolve('react-dom'),
      'react-dom/client$': require.resolve('react-dom/client'),
      'react/jsx-runtime$': require.resolve('react/jsx-runtime'),
    };

    return config;
  },
};

export default nextConfig;
