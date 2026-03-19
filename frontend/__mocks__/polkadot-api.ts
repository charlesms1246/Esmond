// frontend/__mocks__/polkadot-api.ts
export const createClient = jest.fn(() => ({
  getUnsafeApi: jest.fn(() => ({
    query: {
      Assets: {
        Account: {
          getValue: jest.fn().mockResolvedValue({ balance: 5_000_000n }),
        },
      },
    },
  })),
  finalizedBlock$: {
    subscribe: jest.fn((cb: any) => {
      cb({ number: 1000, hash: "0xabc" });
      return { unsubscribe: jest.fn() };
    }),
  },
  destroy: jest.fn(),
}));
