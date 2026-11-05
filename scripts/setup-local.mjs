import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
try {
  const template = await readFile(
    new URL("../.env.example", import.meta.url),
    "utf8",
  );
  await writeFile(
    new URL("../.env.local", import.meta.url),
    template.replace(
      "GENERATE_WITH_NPM_RUN_SETUP_LOCAL",
      randomBytes(48).toString("base64url"),
    ),
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created .env.local with a unique auth secret. Next: docker compose up -d, then npm run db:migrate.",
  );
} catch (error) {
  if (error.code === "EEXIST")
    console.log(".env.local already exists; left unchanged.");
  else throw error;
}
