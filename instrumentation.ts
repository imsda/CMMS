import { runStartupSelfChecks } from "./lib/system-health";

export async function register() {
  try {
    await runStartupSelfChecks();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
