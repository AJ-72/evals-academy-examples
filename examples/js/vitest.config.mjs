// Vitest runs the model-backed evals only; the scorer unit tests use node:test (npm test runs both).
export default {
  test: {
    include: ["**/*.eval.test.mjs"],
  },
};
