import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

async function checkRefreshMigration(db) {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query("CREATE SCHEMA integration_legal_refresh");
    await client.query("SET LOCAL search_path TO integration_legal_refresh");
    await client.query(
      await readFile(
        new URL("../../migrations/003-legal-pages.sql", import.meta.url),
        "utf8",
      ),
    );
    await client.query(
      "INSERT INTO legal_pages (slug,title,content,version,is_draft) VALUES ('privacy','Old privacy','Original [POSTAL_ADDRESS]',4,false),('terms','Old terms','Original [CONTACT_EMAIL]',7,false)",
    );
    await client.query(
      await readFile(
        new URL(
          "../../migrations/012-legal-placeholder-fields.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    for (const [slug, file, version] of [
      ["privacy", "privacy-policy.md", 5],
      ["terms", "website-terms.md", 8],
    ]) {
      const row = (
        await client.query("SELECT * FROM legal_pages WHERE slug=$1", [slug])
      ).rows[0];
      assert.equal(
        row.content,
        await readFile(
          new URL(`../../src/content/${file}`, import.meta.url),
          "utf8",
        ),
      );
      assert.equal(row.version, version);
      assert.equal(row.is_draft, true);
    }
    const values = JSON.parse(
      await readFile(
        new URL("../../src/content/legal-details.json", import.meta.url),
        "utf8",
      ),
    );
    assert.deepEqual(
      (await client.query("SELECT data FROM legal_details")).rows[0].data,
      values,
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  return 7;
}

export async function checkLegalFields({ call, db }) {
  let checks = await checkRefreshMigration(db);
  const originals = (
    await db().query("SELECT * FROM legal_pages ORDER BY slug")
  ).rows;
  const originalDetails = (await db().query("SELECT * FROM legal_details"))
    .rows[0];
  const read = async (slug) => {
    const page = (
      await db().query("SELECT * FROM legal_pages WHERE slug=$1", [slug])
    ).rows[0];
    const details = (await db().query("SELECT * FROM legal_details")).rows[0];
    return {
      title: page.title,
      content: page.content,
      isDraft: page.is_draft,
      version: page.version,
      values: details.data,
      valuesVersion: details.version,
    };
  };
  const save = (slug, input) =>
    call(`/api/admin/legal/${slug}`, "PUT", input, true);
  const status = (response, expected) => {
    assert.equal(response.status, expected);
    checks++;
  };
  try {
    const privacy = await read("privacy");
    status(await save("privacy", { ...privacy, isDraft: false }), 400);
    status(
      await save("privacy", {
        ...privacy,
        values: { ...privacy.values, LEGAL_NAME: "{CONTACT_EMAIL}" },
      }),
      400,
    );
    status(
      await save("privacy", {
        ...privacy,
        values: { ...privacy.values, LOG_RETENTION: "x".repeat(4001) },
      }),
      400,
    );
    const terms = await read("terms");
    // A page cannot silently change a shared value it does not reference.
    status(
      await save("terms", {
        ...terms,
        isDraft: false,
        values: { ...terms.values, LOG_RETENTION: "Unrelated hidden change" },
      }),
      200,
    );
    assert.equal((await read("privacy")).values.LOG_RETENTION, "");
    checks++;
    const staleTerms = await read("terms");
    const name = 'Agency <script>alert("field-xss")</script> $&';
    const edited = await save("privacy", {
      ...privacy,
      values: {
        ...privacy.values,
        LEGAL_NAME: name,
        CONTACT_EMAIL: "updated@example.test",
      },
    });
    status(edited, 200);
    const result = await edited.json();
    assert.equal(result.valuesVersion, privacy.valuesVersion + 1);
    assert.equal(result.values.LEGAL_NAME, name);
    const updatedTerms = await read("terms");
    assert.equal(updatedTerms.version, staleTerms.version + 1);
    assert.equal(updatedTerms.isDraft, false);
    checks += 4;
    status(await save("terms", staleTerms), 409);
    for (const slug of ["privacy", "terms"]) {
      const html = await (await call(`/${slug}`)).text();
      assert.match(html, /Agency &lt;script&gt;/);
      assert.match(html, /updated@example.test/);
      assert.doesNotMatch(html, /<script>alert\("field-xss"\)<\/script>/);
      checks += 3;
    }
    const beforeMigration = (await db().query("SELECT * FROM legal_details"))
      .rows;
    const beforePages = (
      await db().query("SELECT * FROM legal_pages ORDER BY slug")
    ).rows;
    await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "scripts/migrate.ts"],
      { env: process.env },
    );
    assert.deepEqual(
      (await db().query("SELECT * FROM legal_details")).rows,
      beforeMigration,
    );
    assert.deepEqual(
      (await db().query("SELECT * FROM legal_pages ORDER BY slug")).rows,
      beforePages,
    );
    checks += 2;
    const clear = await read("privacy");
    status(
      await save("privacy", {
        ...clear,
        values: { ...clear.values, LEGAL_NAME: "" },
      }),
      200,
    );
    assert.equal((await read("terms")).isDraft, true);
    assert.match(await (await call("/terms")).text(), /Draft for review/);
    checks += 2;
    const fill = await read("privacy");
    status(
      await save("privacy", {
        ...fill,
        isDraft: false,
        title: "Privacy for {TRADING_NAME}",
        values: {
          ...fill.values,
          LEGAL_NAME: originalDetails.data.LEGAL_NAME,
          LOG_RETENTION: "Synthetic test policy: retained for 14 days.",
        },
      }),
      200,
    );
    const ready = await (await call("/privacy")).text();
    assert.match(ready, /<title>Privacy for Get Automated/);
    assert.doesNotMatch(ready, /Draft for review|\{LOG_RETENTION\}/);
    checks += 2;
    const concurrentPrivacy = await read("privacy");
    const concurrentTerms = await read("terms");
    const responses = await Promise.all([
      save("privacy", {
        ...concurrentPrivacy,
        values: {
          ...concurrentPrivacy.values,
          CONTACT_EMAIL: "first@example.test",
        },
      }),
      save("terms", {
        ...concurrentTerms,
        values: {
          ...concurrentTerms.values,
          CONTACT_EMAIL: "second@example.test",
        },
      }),
    ]);
    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [200, 409],
    );
    const finalPrivacy = await read("privacy");
    assert.equal(
      finalPrivacy.valuesVersion,
      concurrentPrivacy.valuesVersion + 1,
    );
    for (const slug of ["privacy", "terms"])
      assert(
        (await (await call(`/${slug}`)).text()).includes(
          finalPrivacy.values.CONTACT_EMAIL,
        ),
      );
    checks += 4;
  } finally {
    await db().query(
      "UPDATE legal_details SET data=$1,version=$2,updated_at=$3 WHERE singleton",
      [
        JSON.stringify(originalDetails.data),
        originalDetails.version,
        originalDetails.updated_at,
      ],
    );
    for (const page of originals)
      await db().query(
        "UPDATE legal_pages SET title=$1,content=$2,is_draft=$3,version=$4,updated_at=$5 WHERE slug=$6",
        [
          page.title,
          page.content,
          page.is_draft,
          page.version,
          page.updated_at,
          page.slug,
        ],
      );
  }
  return checks;
}
