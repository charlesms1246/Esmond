// frontend/jest.setup.ts
import "@testing-library/jest-dom";

// Suppress wagmi SSR warning in test env
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false, media: query, onchange: null,
    addListener: jest.fn(), removeListener: jest.fn(),
    addEventListener: jest.fn(), removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock next/navigation for App Router
jest.mock("next/navigation", () => ({
  useRouter:       () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname:     () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
