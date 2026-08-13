import { defineConfig } from "@playwright/test";
import fs from "fs";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    launchOptions: {
      // Headless launch tuned for constrained CI containers.
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
      // This dev container needs extracted NSS/NSPR libs for Chromium; on
      // machines where the dir is absent (e.g. CI with system libs) this is a no-op.
      env: {
        ...(process.env as Record<string, string>),
        ...(() => {
          const libs = `${process.env.HOME}/.browser-libs/usr/lib/x86_64-linux-gnu`;
          return fs.existsSync(libs)
            ? { LD_LIBRARY_PATH: `${libs}${process.env.LD_LIBRARY_PATH ? ":" + process.env.LD_LIBRARY_PATH : ""}` }
            : {};
        })(),
      },
    },
  },
  webServer: {
    command: "npx next dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
