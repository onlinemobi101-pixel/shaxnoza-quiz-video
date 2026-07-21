import { defineConfig } from "vitest/config";

// Alohida config: vite.config.ts ilova plaginlarini (react, tailwind, api dev-server)
// yuklaydi — testlarga ularning keragi yo'q va ular api/ai.ts ni erta import qiladi.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // TTS deadline testi haqiqiy timer bilan ~6s ishlaydi.
    testTimeout: 30_000,
    env: {
      // api/ai.ts getVertexCredentials() ni chaqiradi — soxta bo'lsa ham JSON kerak.
      // Vertex SDK'ning o'zi tests/helpers/genai-stub.ts bilan almashtiriladi.
      GCP_SERVICE_ACCOUNT_JSON: JSON.stringify({
        type: "service_account",
        project_id: "test-project",
        private_key: "fake-key",
        client_email: "test@test.iam.gserviceaccount.com",
      }),
      // Deadline mantiqini sinash uchun qisqartirilgan byudjet (minimal ruxsat etilgan qiymat).
      TTS_BATCH_BUDGET_MS: "5000",
    },
  },
});
