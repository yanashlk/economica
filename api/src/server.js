import express from "express";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
});
