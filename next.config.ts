import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Existe um package-lock.json solto em ~/, e sem esta raiz o Turbopack o
    // considera na hora de resolver o workspace, avisando a cada build.
    root: __dirname,
  },
};

export default nextConfig;
