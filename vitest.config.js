/** @type {import('vitest').UserConfig} */
export default {
  test: {
    include: ["test/e2e/**/*.test.js", "test/unit/**/*.test.js"],
    globals: true,
    testTimeout: 15000,
    hookTimeout: 10000,
    environment: "node",
    reporters: process.env.CI ? ["default", "json"] : ["default"],
    outputFile: process.env.CI ? { json: "test-results/results.json" } : undefined,
  },
  resolve: {
    conditions: ["node", "import"],
  },
};
