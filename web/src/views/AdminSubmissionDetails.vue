<template>
  <main class="p">
    <div class="top">
      <div>
        <h1>Заявка</h1>
        <div v-if="submission" class="meta">
          <span class="pill">{{ submission.status }}</span>
          <span class="mono">{{ submission.id }}</span>
          <span>Створено: {{ fmt(submission.created_at) }}</span>
          <span v-if="submission.submitted_at">
            Відправлено: {{ fmt(submission.submitted_at) }}
          </span>
          <span v-if="submission.reviewed_at">
            Перевірено: {{ fmt(submission.reviewed_at) }}
          </span>
        </div>
      </div>

      <div class="right">
        <button class="btn ghost" @click="back">← Назад</button>

        <button
            class="btn ghost"
            :disabled="reviewBusy || loading"
            @click="toggleReviewed"
        >
          {{
            submission?.reviewed_at
                ? "Зняти перевірено"
                : "Позначити як перевірено"
          }}
        </button>

        <button
            class="btn"
            :disabled="saving || loading || !!error"
            @click="save"
        >
          {{ saving ? "Збереження..." : "Зберегти зміни" }}
        </button>

        <button
            class="btn danger"
            :disabled="deleting || loading"
            @click="remove"
        >
          {{ deleting ? "Видаляю..." : "Видалити бриф" }}
        </button>
      </div>
    </div>

    <p v-if="loading">Завантаження…</p>
    <p v-else-if="error" class="err">{{ error }}</p>

    <section v-else class="card">
      <h2 class="h2">{{ submission?.form_title }}</h2>

      <div v-for="row in qa" :key="row.question_id" class="qa">
        <div class="q">
          <span class="qtext">{{ row.question_text }}</span>
          <span v-if="row.required" class="req">*</span>
          <span class="type">{{ row.qtype }}</span>
        </div>

        <div class="a">
          <template v-if="row.qtype === 'checkbox'">
            <label class="check">
              <input type="checkbox" v-model="editValues[row.question_id]" />
              <span>Так</span>
            </label>
          </template>

          <template v-else-if="row.qtype === 'date'">
            <input class="input" type="date" v-model="editValues[row.question_id]" />
          </template>

          <template v-else-if="row.qtype === 'textarea'">
            <textarea class="textarea" rows="4" v-model="editValues[row.question_id]" />
          </template>

          <template v-else>
            <input class="input" type="text" v-model="editValues[row.question_id]" />
          </template>

          <span v-if="row.answer_updated_at" class="upd">
            оновлено: {{ fmt(row.answer_updated_at) }}
          </span>
        </div>
      </div>

      <p v-if="msg" class="msg">{{ msg }}</p>
    </section>
  </main>
</template>

<script setup>
import {onMounted, reactive, ref} from "vue";
import {useRoute, useRouter} from "vue-router";

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const saving = ref(false);
const error = ref("");
const msg = ref("");
const reviewBusy = ref(false);

const submission = ref(null);
const qa = ref([]);

const editValues = reactive({});
const deleting = ref(false);


function token() {
  return localStorage.getItem("admin_token");
}

function fmt(iso) {
  try {
    return new Date(iso).toLocaleString("uk-UA");
  } catch {
    return iso;
  }
}

async function parseJsonSafe(r) {
  const text = await r.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return {_raw: text};
  }
}

function toInitialValue(row) {
  if (row.qtype === "checkbox") {
    return row.value_bool === true; // false якщо null/false
  }
  if (row.qtype === "date") {
    return row.value_date || "";
  }
  // text/textarea
  return row.value_text ?? "";
}

async function load() {
  loading.value = true;
  error.value = "";
  msg.value = "";
  try {
    const id = route.params.id;
    const r = await fetch(`/admin/submissions/${id}`, {
      headers: {Authorization: `Bearer ${token()}`},
    });
    const data = await parseJsonSafe(r);
    if (!r.ok) throw new Error(data?.error || data?._raw || `HTTP ${r.status}`);

    submission.value = data.submission;
    qa.value = data.qa || [];

    // заповнюємо editValues
    for (const row of qa.value) {
      editValues[row.question_id] = toInitialValue(row);
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function buildPayload() {
  return {
    answers: qa.value.map((row) => ({
      questionId: row.question_id,
      value: editValues[row.question_id],
    })),
  };
}

async function save() {
  saving.value = true;
  msg.value = "";
  try {
    const id = route.params.id;
    const r = await fetch(`/admin/submissions/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify(buildPayload()),
    });
    const data = await parseJsonSafe(r);
    if (!r.ok) throw new Error(data?.error || data?._raw || `HTTP ${r.status}`);

    msg.value = "Збережено ✅";
    await load();
  } catch (e) {
    msg.value = `Помилка: ${e.message}`;
  } finally {
    saving.value = false;
  }
}

function back() {
  router.push("/admin/submissions");
}

async function remove() {
  const ok = confirm("Точно видалити цей бриф? Дію не можна скасувати.");
  if (!ok) return;

  deleting.value = true;
  msg.value = "";

  try {
    const id = route.params.id;

    const r = await fetch(`/admin/submissions/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token()}` },
    });

    const data = await parseJsonSafe(r);
    if (!r.ok) throw new Error(data?.error || data?._raw || `HTTP ${r.status}`);

    router.push("/admin/submissions");
  } catch (e) {
    msg.value = `Помилка: ${e.message}`;
  } finally {
    deleting.value = false;
  }
}

async function toggleReviewed() {
  reviewBusy.value = true;
  msg.value = "";
  try {
    const id = route.params.id;
    const r = await fetch(`/admin/submissions/${id}/review`, {
      method: "POST",
      headers: {Authorization: `Bearer ${token()}`},
    });
    const data = await parseJsonSafe(r);
    if (!r.ok) throw new Error(data?.error || data?._raw || `HTTP ${r.status}`);

    msg.value = data.reviewed
        ? "Позначено як перевірено ✅"
        : "Позначку знято ↩️";
    await load();
  } catch (e) {
    msg.value = `Помилка: ${e.message}`;
  } finally {
    reviewBusy.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.p {
  padding: 24px;
}

.top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.right {
  display: flex;
  gap: 10px;
  align-items: center;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 6px;
  color: #555;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.card {
  width: 100%;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  padding: 16px;
  background: #fff;
  margin-top: 14px;
}

.h2 {
  margin: 0 0 12px;
  font-size: 18px;
}

.qa {
  border-top: 1px solid #eee;
  padding: 12px 0;
}

.qa:first-child {
  border-top: none;
}

.q {
  display: flex;
  gap: 10px;
  align-items: baseline;
  flex-wrap: wrap;
}

.qtext {
  font-weight: 700;
}

.req {
  color: #d00;
  font-weight: 700;
}

.type {
  font-size: 12px;
  padding: 2px 8px;
  border: 1px solid #ddd;
  border-radius: 999px;
  color: #444;
}

.a {
  margin-top: 8px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.upd {
  color: #777;
  font-size: 12px;
  padding-top: 8px;
}

.input,
.textarea {
  width: min(900px, 100%);
  box-sizing: border-box;
  border: 1px solid #d7d7d7;
  border-radius: 10px;
  padding: 10px 12px;
  outline: none;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.pill {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid #ddd;
  background: #fafafa;
}

.btn {
  padding: 10px 14px;
  border-radius: 10px;
  border: none;
  background: #111;
  color: #fff;
  cursor: pointer;
}

.btn.ghost {
  background: #f3f3f3;
  color: #111;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.err {
  color: #d00;
}

.msg {
  margin-top: 12px;
}
.btn.danger {
  background: #d00;
  color: #fff;
}
.btn.danger:disabled {
  opacity: 0.6;
}
</style>
