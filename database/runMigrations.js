const fs = require("fs");
const path = require("path");

const pool = require("./db");

const migrationsDirectory = path.join(
    __dirname,
    "migrations"
);


const runMigrations = async () => {
    const client = await pool.connect();

    try {
        console.log("Starting database migrations...");

        /*
         * Make sure PostgreSQL has the UUID function
         * required by tracking_entries.
         */
        await client.query(`
            CREATE EXTENSION IF NOT EXISTS pgcrypto;
        `);


        /*
         * Keep track of migrations that have already
         * been successfully executed.
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);


        /*
         * Read all migration files.
         */
        const files = fs
            .readdirSync(migrationsDirectory)
            .filter(file => file.endsWith(".sql"))
            .sort();


        for (const file of files) {

            const existingMigration = await client.query(
                `
                SELECT id
                FROM schema_migrations
                WHERE filename = $1
                `,
                [file]
            );


            /*
             * Skip migrations that have already
             * been recorded as completed.
             */
            if (existingMigration.rows.length > 0) {
                console.log(`Skipping ${file}`);
                continue;
            }


            console.log(`Running ${file}...`);

            const migrationPath = path.join(
                migrationsDirectory,
                file
            );

            const migrationSQL = fs.readFileSync(
                migrationPath,
                "utf8"
            );


            /*
             * Each migration is executed inside
             * its own transaction.
             */
            await client.query("BEGIN");

            try {

                await client.query(migrationSQL);

                await client.query(
                    `
                    INSERT INTO schema_migrations (filename)
                    VALUES ($1)
                    `,
                    [file]
                );

                await client.query("COMMIT");

                console.log(`Completed ${file}`);

            } catch (migrationError) {

                await client.query("ROLLBACK");

                throw migrationError;
            }
        }


        console.log("Database migrations completed successfully.");

    } catch (error) {

        console.error(
            "Database migration failed:",
            error
        );

        process.exitCode = 1;

    } finally {

        client.release();
    }
};


runMigrations();