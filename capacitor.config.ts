import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.spoiledfm.app",
  appName: "Spoiled FM",
  webDir: "dist-capacitor",
  server: { androidScheme: "https" },
};

export default config;
