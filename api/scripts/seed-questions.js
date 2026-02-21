import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dbPath = path.join(__dirname, "../src/db.js");
const { getPool } = await import(dbPath);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_PATH = path.join(__dirname, "main-brief.questions.json");

async function run() {
    const pool = getPool();
    const data = JSON.parse(fs.readFileSync(SEED_PATH, "utf-8"));

    const { form_slug, questions } = data;

    // 1. знайти форму
    const fRes = await pool.query(
        "select id from forms where slug=$1",
        [form_slug]
    );
    if (!fRes.rows[0]) {
        throw new Error(`Form with slug '${form_slug}' not found`);
    }
    const formId = fRes.rows[0].id;

    // 2. вставляємо питання
    for (const q of questions) {
        await pool.query(
            `insert into questions
       (form_id, section, question_text, qtype, required, sort_order, is_active, created_at)
       values ($1, $2, $3, $4, $5, $6, true, now())
       on conflict do nothing`,
            [
                formId,
                q.section,
                q.question_text,
                q.qtype,
                q.required,
                q.sort_order
            ]
        );
    }

    console.log("✅ Questions seeded successfully");
    process.exit(0);
}

run().catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
});