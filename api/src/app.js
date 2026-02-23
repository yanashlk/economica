import "dotenv/config";
import express from "express";
import jwt from "jsonwebtoken";
import { getPool } from "./db.js";
import { requireAdmin } from "./auth.js";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ ok: true });
});

/**
 * AUTH (admin)
 */
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: "email and password required" });
        }
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ error: "JWT_SECRET is not set" });
        }

        const pool = getPool();
        const uRes = await pool.query(
            `select id, email, role, is_active
             from users
             where email=$1
               and is_active=true
               and role='admin'
               and password_hash = crypt($2, password_hash)`,
            [email, password]
        );

        const u = uRes.rows[0];
        if (!u) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign(
            { uid: u.id, email: u.email, role: u.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.json({ token });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error" });
    }
});

/**
 * PUBLIC: get form by slug
 */
app.get("/api/forms/:slug", async (req, res) => {
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

/**
 * PUBLIC: create submission draft
 */
app.post("/api/submissions", async (req, res) => {
    try {
        const { formSlug } = req.body || {};
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

/**
 * PUBLIC: save answers (upsert)
 */
app.patch("/api/submissions/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { answers } = req.body || {};

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

        const client = await pool.connect();
        try {
            await client.query("begin");
            for (const a of answers) {
                const qRes = await client.query(
                    `select id, qtype from questions where id=$1 and form_id=$2`,
                    [a.questionId, submission.form_id]
                );
                const q = qRes.rows[0];
                if (!q) continue;

                let value_text = null, value_bool = null, value_date = null;

                if (a.value === null || a.value === undefined || a.value === "") {
                    // пропускаємо
                } else if (q.qtype === "checkbox") {
                    value_bool = !!a.value;
                } else if (q.qtype === "date") {
                    value_date = a.value;
                } else {
                    value_text = String(a.value);
                }

                await client.query(
                    `insert into answers (submission_id, question_id, value_text, value_bool, value_date, updated_at)
                     values ($1, $2, $3, $4, $5, now())
                     on conflict (submission_id, question_id)
                     do update set value_text = excluded.value_text, value_bool = excluded.value_bool, 
                                   value_date = excluded.value_date, updated_at = now()`,
                    [id, a.questionId, value_text, value_bool, value_date]
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

/**
 * PUBLIC: finalize submit
 */
app.post("/api/submissions/:id/submit", async (req, res) => {
    try {
        const pool = getPool();
        await pool.query(
            "update submissions set status='submitted', submitted_at=now(), updated_at=now() where id=$1",
            [req.params.id]
        );
        return res.json({ ok: true });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error" });
    }
});

/**
 * ADMIN: list submissions (with filters)
 */
app.get("/api/admin/submissions", requireAdmin, async (req, res) => {
    try {
        const { status, reviewed } = req.query;
        const pool = getPool();
        const params = [];
        const whereParts = [];

        if (status === "draft" || status === "submitted") {
            params.push(status);
            whereParts.push(`s.status = $${params.length}`);
        }
        if (reviewed === "0") whereParts.push("s.reviewed_at is null");
        else if (reviewed === "1") whereParts.push("s.reviewed_at is not null");

        const where = whereParts.length ? `where ${whereParts.join(" and ")}` : "";
        const rows = await pool.query(
            `select s.id, s.status, s.created_at, s.submitted_at, s.reviewed_at, s.reviewed_by,
                    f.slug as form_slug, f.title as form_title
             from submissions s
             join forms f on f.id = s.form_id
             ${where}
             order by s.created_at desc limit 200`,
            params
        );
        return res.json({ items: rows.rows });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error" });
    }
});

/**
 * ADMIN: submission details
 */
app.get("/api/admin/submissions/:id", requireAdmin, async (req, res) => {
    try {
        const pool = getPool();
        const sRes = await pool.query(
            `select s.*, f.title as form_title from submissions s 
             join forms f on f.id = s.form_id where s.id=$1`, [req.params.id]
        );
        const submission = sRes.rows[0];
        if (!submission) return res.status(404).json({ error: "Not found" });

        const qaRes = await pool.query(
            `select q.id as question_id, q.question_text, q.qtype, q.required, 
                    a.value_text, a.value_bool, a.value_date
             from questions q
             left join answers a on a.question_id = q.id and a.submission_id = $1
             where q.form_id = $2 and q.is_active=true
             order by q.sort_order asc`,
            [req.params.id, submission.form_id]
        );

        return res.json({ submission, qa: qaRes.rows });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error" });
    }
});

app.post("/api/admin/submissions/:id/review", requireAdmin, async (req, res) => {
    try {
        const pool = getPool();
        await pool.query(
            `update submissions set reviewed_at = case when reviewed_at is null then now() else null end,
             reviewed_by = $2 where id=$1`,
            [req.params.id, req.user?.uid || null]
        );
        return res.json({ ok: true });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error" });
    }
});

app.delete("/api/admin/submissions/:id", requireAdmin, async (req, res) => {
    const pool = getPool();
    const client = await pool.connect();
    try {
        await client.query("begin");
        await client.query("delete from answers where submission_id=$1", [req.params.id]);
        await client.query("delete from submissions where id=$1", [req.params.id]);
        await client.query("commit");
        return res.json({ ok: true });
    } catch (e) {
        await client.query("rollback");
        return res.status(500).json({ error: "Server error" });
    } finally {
        client.release();
    }
});

export default app;