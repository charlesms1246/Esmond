import type { Config } from "jest";

const sharedTransform = {
  "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: { jsx: "react" } }] as [string, Record<string, unknown>],
};

const sharedMapper = { "^@/(.*)$": "<rootDir>/$1" };
const sharedSetup  = { setupFiles: ["<rootDir>/jest.env.ts"] };

const config: Config = {
  passWithNoTests: true,
  projects: [
    {
      // API route tests — need Node.js environment for next/server (Request/Response)
      displayName:          "api",
      testMatch:            ["**/__tests__/api/**/*.{ts,tsx}"],
      testEnvironment:      "node",
      transform:            sharedTransform,
      moduleNameMapper: {
        "^@/lib/wagmi/config$": "<rootDir>/__mocks__/lib/wagmi/config.ts",
        ...sharedMapper,
      },
      ...sharedSetup,
      // No jest.setup.ts here — it references `window` which doesn't exist in node env
    },
    {
      // Hook + lib tests — need jsdom environment for React hooks
      displayName:          "hooks",
      testMatch:            ["**/__tests__/{hooks,lib}/**/*.{ts,tsx}"],
      testEnvironment:      "jsdom",
      transform:            sharedTransform,
      moduleNameMapper:     sharedMapper,
      ...sharedSetup,
      setupFilesAfterEnv:   ["<rootDir>/jest.setup.ts"],
    },
  ],
};

export default config;
