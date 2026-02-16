import "dotenv/config";
import express from "express";
import { getPool } from "./db.js"

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ ok: true });
});

app.get("/forms/:slug", async (req, res) => {
    try {
        const { slug } = req.params;

        const pool = getPool();

        const formRes = await pool.query(
            "select id, slug, title from forms where slug=$1 and is_active=true",
            [slug]
        );

        const form = formRes.rows[0];
        if (!form) return res.status(404).json({ error: "Form not found" });

        const qRes = await pool.query(
            `select id, question_text, qtype, required, sort_order
       from questions
       where form_id=$1 and is_active=true
       order by sort_order asc`,
            [form.id]
        );
        return res.json({ form, questions: qRes.rows });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error" });
    }
});

app.post("/submissions", async (req, res) => {
    try {
        const { formSlug } = req.body;
        if (!formSlug) return res.status(400).json({ error: "formSlug required" });

        const pool = getPool();

        const fRes = await pool.query(
            "select id from forms where slug=$1 and is_active=true",
            [formSlug]
        );
        const form = fRes.rows[0];
        if (!form) return res.status(404).json({ error: "Form not found" });

        const created = await pool.query(
            "insert into submissions(form_id, status) values ($1, 'draft') returning id, status, created_at",
            [form.id]
        );

        return res.status(201).json({ submission: created.rows[0] });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error" });
    }
});

app.patch("/submissions/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { answers } = req.body;

        if (!Array.isArray(answers)) {
            return res.status(400).json({ error: "answers must be an array" });
        }

        const pool = getPool();

        const subRes = await pool.query(
            "select id, form_id, status from submissions where id=$1",
            [id]
        );
        const submission = subRes.rows[0];
        if (!submission) return res.status(404).json({ error: "Submission not found" });
        if (submission.status !== "draft") {
            return res.status(409).json({ error: "Only draft submissions can be edited" });
        }

        const client = await pool.connect();
        try {
            await client.query("begin");

            for (const a of answers) {
                const questionId = a?.questionId;
                const value = a?.value;

                if (!questionId) {
                    await client.query("rollback");
                    return res.status(400).json({ error: "Each answer must have questionId" });
                }

                const qRes = await client.query(
                    `select id, qtype
           from questions
           where id=$1 and form_id=$2 and is_active=true`,
                    [questionId, submission.form_id]
                );
                const q = qRes.rows[0];
                if (!q) {
                    await client.query("rollback");
                    return res.status(400).json({ error: `Invalid questionId: ${questionId}` });
                }

                let value_text = null;
                let value_bool = null;
                let value_date = null;

                if (value === null || value === undefined || value === "") {
                } else if (q.qtype === "checkbox") {
                    if (typeof value !== "boolean") {
                        await client.query("rollback");
                        return res.status(400).json({ error: `checkbox value must be boolean (${questionId})` });
                    }
                    value_bool = value;
                } else if (q.qtype === "date") {
                    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                        await client.query("rollback");
                        return res.status(400).json({ error: `date value must be YYYY-MM-DD (${questionId})` });
                    }
                    value_date = value;
                } else {
                    if (typeof value !== "string") {
                        await client.query("rollback");
                        return res.status(400).json({ error: `text value must be string (${questionId})` });
                    }
                    value_text = value;
                }

                await client.query(
                    `insert into answers (submission_id, question_id, value_text, value_bool, value_date, updated_at)
           values ($1, $2, $3, $4, $5, now())
           on conflict (submission_id, question_id)
           do update set
             value_text = excluded.value_text,
             value_bool = excluded.value_bool,
             value_date = excluded.value_date,
             updated_at = now()`,
                    [id, questionId, value_text, value_bool, value_date]
                );
            }

            await client.query("update submissions set updated_at=now() where id=$1", [id]);

            await client.query("commit");
            return res.json({ ok: true });
        } catch (e) {
            await client.query("rollback");
            throw e;
        } finally {
            client.release();
        }
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error" });
    }
});


app.post("/submissions/:id/submit", async (req, res) => {
    try {
        const { id } = req.params;
        const pool = getPool();

        const subRes = await pool.query(
            "select id, form_id, status from submissions where id=$1",
            [id]
        );
        const submission = subRes.rows[0];
        if (!submission) return res.status(404).json({ error: "Submission not found" });
        if (submission.status !== "draft") {
            return res.status(409).json({ error: "Submission already submitted" });
        }

        const reqQ = await pool.query(
            `select id, qtype
       from questions
       where form_id=$1 and is_active=true and required=true`,
            [submission.form_id]
        );

        const ansRes = await pool.query(
            `select question_id, value_text, value_bool, value_date
       from answers
       where submission_id=$1`,
            [id]
        );

        const byQ = new Map(ansRes.rows.map(r => [r.question_id, r]));

        const missing = [];
        for (const q of reqQ.rows) {
            const a = byQ.get(q.id);
            if (!a) {
                missing.push(q.id);
                continue;
            }

            if (q.qtype === "checkbox") {
                if (a.value_bool !== true && a.value_bool !== false) missing.push(q.id);
            } else if (q.qtype === "date") {
                if (!a.value_date) missing.push(q.id);
            } else {
                const t = (a.value_text ?? "").trim();
                if (!t) missing.push(q.id);
            }
        }

        if (missing.length > 0) {
            return res.status(400).json({
                error: "Required questions are missing",
                missingQuestionIds: missing
            });
        }

        await pool.query(
            `update submissions
       set status='submitted', submitted_at=now(), updated_at=now()
       where id=$1`,
            [id]
        );

        return res.json({ ok: true });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error" });
    }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
});
