import { execFileSync } from "node:child_process";

const databaseName = "qiqihar_enterprise_e2e";
const databaseUser = process.env.QIQIHAR_E2E_DB_USERNAME ?? process.env.USER;

export default function globalTeardown() {
  if (!databaseUser)
    throw new Error("A PostgreSQL E2E database user is required");

  execFileSync(
    "dropdb",
    ["--if-exists", "--force", "--username", databaseUser, databaseName],
    {
      env: {
        ...process.env,
        PGPASSWORD: process.env.QIQIHAR_E2E_DB_PASSWORD ?? "",
      },
      stdio: "inherit",
    },
  );
}
