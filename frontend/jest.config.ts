import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  transform:       { "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: { jsx: "react" } }] },
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  setupFilesAfterFramework: ["@testing-library/jest-dom"],
  testMatch:       ["**/__tests__/**/*.{ts,tsx}"],
  passWithNoTests: true,
};

export default config;
