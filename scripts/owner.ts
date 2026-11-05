import { input, password } from "@inquirer/prompts";
import { provisionOwner } from "../src/server/provision";
import { db } from "../src/server/db";
try {
  const email = await input({ message: "Owner email:" });
  const secret = await password({
    message: "Password (12–128 characters):",
    mask: "*",
  });
  const repeated = await password({ message: "Repeat password:", mask: "*" });
  if (secret !== repeated)
    throw new Error("Passwords do not match. No changes made.");
  await provisionOwner(
    email,
    secret,
    process.argv.includes("--reset-password"),
  );
  console.log("Owner account ready. Sign in at /admin.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Owner setup failed.");
  process.exitCode = 1;
} finally {
  await db().end();
}
