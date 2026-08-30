const fs = require("fs");
const path = require("path");
const pool = require("./db");

const DATA_FILE = path.resolve(__dirname, "../seed-data.json");

function requireData() {
if (!fs.existsSync(DATA_FILE)) {
throw new Error(
`Missing ${DATA_FILE}. Create seed-data.json locally before running the importer.`
);
}

return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

async function importData() {
const data = requireData();
const client = await pool.connect();

let usersProcessed = 0;
let trackingProcessed = 0;

try {
await client.query("BEGIN");

// ===========================================================
// USERS
// ============================================================

for (const user of data.users || []) {
  const email = user.email.trim().toLowerCase();

  /*
   * We identify an existing user primarily by email.
   *
   * The legacy JSON also contains the old UUID. If that UUID
   * already exists, we update that user instead of attempting
   * to insert it again.
   */

  const existingById = await client.query(
    "SELECT id, email FROM users WHERE id = $1",
    [user.id]
  );

  const existingByEmail = await client.query(
    "SELECT id, email FROM users WHERE email = $1",
    [email]
  );

  if (existingById.rowCount > 0) {
    /*
     * The legacy ID already exists.
     * Update the existing record using that ID.
     */
    await client.query(
      `UPDATE users
       SET
         first_name = $1,
         last_name = $2,
         preferred_name = $3,
         email = $4,
         email_verified = $5,
         created_at = $6,
         last_login_at = $7
       WHERE id = $8`,
      [
        user.firstName,
        user.lastName,
        user.preferredName || null,
        email,
        Boolean(user.emailVerified),
        user.createdAt,
        user.lastLoginAt || null,
        user.id,
      ]
    );

    console.log(`Updated existing user by ID: ${email}`);
  } else if (existingByEmail.rowCount > 0) {
    /*
     * The email already exists under another UUID.
     *
     * Keep the existing database UUID because other tables
     * may already reference it.
     */
    const existingUserId = existingByEmail.rows[0].id;

    await client.query(
      `UPDATE users
       SET
         first_name = $1,
         last_name = $2,
         preferred_name = $3,
         email_verified = $4,
         created_at = $5,
         last_login_at = $6
       WHERE id = $7`,
      [
        user.firstName,
        user.lastName,
        user.preferredName || null,
        Boolean(user.emailVerified),
        user.createdAt,
        user.lastLoginAt || null,
        existingUserId,
      ]
    );

    console.log(`Updated existing user by email: ${email}`);
  } else {
    /*
     * No matching ID or email exists.
     * Insert the legacy user exactly as supplied.
     */
    await client.query(
      `INSERT INTO users
        (
          id,
          first_name,
          last_name,
          preferred_name,
          email,
          email_verified,
          created_at,
          last_login_at
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        user.id,
        user.firstName,
        user.lastName,
        user.preferredName || null,
        email,
        Boolean(user.emailVerified),
        user.createdAt,
        user.lastLoginAt || null,
      ]
    );

    console.log(`Inserted new user: ${email}`);
  }

  usersProcessed++;
}

// ============================================================
// TRACKING
// ============================================================

for (const record of data.tracking || []) {
  const email = record.email.trim().toLowerCase();

  const userResult = await client.query(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );

  if (userResult.rowCount === 0) {
    console.warn(
      `Skipping tracking for unknown user: ${email}`
    );
    continue;
  }

  const userId = userResult.rows[0].id;

  for (const entry of record.entries || []) {
    const values = entry.values || {};

    await client.query(
      `INSERT INTO tracking_entries
        (
          user_id,
          entry_date,
          night_time_urination,
          evening_fluids,
          activity_level,
          stress_level,
          sleep_quality,
          notes,
          updated_at
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, entry_date)
       DO UPDATE SET
         night_time_urination = EXCLUDED.night_time_urination,
         evening_fluids = EXCLUDED.evening_fluids,
         activity_level = EXCLUDED.activity_level,
         stress_level = EXCLUDED.stress_level,
         sleep_quality = EXCLUDED.sleep_quality,
         notes = EXCLUDED.notes,
         updated_at = EXCLUDED.updated_at`,
      [
        userId,
        entry.date,
        values.nightTimeUrination || null,
        values.eveningFluids || null,
        values.activityLevel || null,
        values.stressLevel || null,
        values.sleepQuality || null,
        entry.notes || null,
        entry.updatedAt || new Date().toISOString(),
      ]
    );

    trackingProcessed++;
  }
}

// ============================================================
// COMMIT
// ============================================================

await client.query("COMMIT");

console.log("");
console.log("========================================");
console.log("Legacy data import completed successfully.");
console.log("========================================");
console.log(`Users processed: ${usersProcessed}`);
console.log(`Tracking entries processed: ${trackingProcessed}`);
console.log("");
console.log(
  "Legacy authentication tokens and sessions were intentionally not imported."
);


} catch (error) {
await client.query("ROLLBACK");
throw error;
} finally {
client.release();
await pool.end();
}
}

importData().catch((error) => {
console.error("");
console.error("Legacy data import failed:");
console.error(error.message);
process.exit(1);
});
