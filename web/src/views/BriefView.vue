<template>
  <main class="wrap">
    <h1 class="title">{{ form?.title || "Бриф" }}</h1>

    <p v-if="loading">Завантажую питання…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <form v-else class="card" @submit.prevent="onSubmit">
      <div v-for="q in questions" :key="q.id" class="field">
        <label class="label" :class="{ required: q.required }">
          {{ q.question_text }}
        </label>

        <div v-if="q.qtype === 'text'">
          <input
              class="input"
              :class="{ invalid: missingSet.has(q.id) }"
              type="text"
              v-model="values[q.id]"
              placeholder="Введіть відповідь"
          />
        </div>

        <div v-else-if="q.qtype === 'textarea'">
          <textarea
              class="textarea"
              :class="{ invalid: missingSet.has(q.id) }"
              v-model="values[q.id]"
              rows="4"
              placeholder="Введіть відповідь"
          />
        </div>

        <div v-else-if="q.qtype === 'checkbox'" class="checkboxRow">
          <input type="checkbox" :id="q.id" v-model="values[q.id]" />
          <label class="checkboxLabel" :for="q.id">Так</label>
        </div>

        <div v-else-if="q.qtype === 'date'">
          <input
              class="input"
              :class="{ invalid: missingSet.has(q.id) }"
              type="date"
              v-model="values[q.id]"
          />
        </div>

        <p v-if="missingSet.has(q.id)" class="hint">Це поле обовʼязкове</p>
      </div>

      <div class="actions">
        <button class="btn ghost" type="button" :disabled="busy" @click="saveDraft">
          Зберегти чернетку
        </button>
        <button class="btn" type="submit" :disabled="busy">
          Відправити
        </button>
      </div>

      <p v-if="statusMsg" class="status">{{ statusMsg }}</p>
    </form>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";

const loading = ref(true);
const error = ref("");
const busy = ref(false);
const statusMsg = ref("");

const form = ref(null);
const questions = ref([]);

const values = reactive({});
const submissionId = ref(null);

const missingIds = ref([]);
const missingSet = computed(() => new Set(missingIds.value));

async function apiGet(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(await safeErr(r));
  return r.json();
}

async function apiJson(url, method, body) {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const data = await safeJson(r);
    const msg = data?.error || `HTTP ${r.status}`;
    const e = new Error(msg);
    e.data = data;
    e.status = r.status;
    throw e;
  }
  return r.json();
}

async function safeJson(r) {
  try {
    return await r.json();
  } catch {
    return null;
  }
}
async function safeErr(r) {
  const data = await safeJson(r);
  return data?.error || `HTTP ${r.status}`;
}

onMounted(async () => {
  try {
    const data = await apiGet("/forms/main-brief");
    form.value = data.form;
    questions.value = data.questions || [];

    for (const q of questions.value) {
      if (q.qtype === "checkbox") values[q.id] = false;
      else values[q.id] = "";
    }
  } catch (e) {
    error.value = e.message || "Не вдалось завантажити форму";
  } finally {
    loading.value = false;
  }
});

function buildAnswersPayload() {
  return {
    answers: questions.value.map((q) => ({
      questionId: q.id,
      value: values[q.id],
    })),
  };
}

async function ensureSubmission() {
  if (submissionId.value) return submissionId.value;
  const created = await apiJson("/submissions", "POST", { formSlug: "main-brief" });
  submissionId.value = created?.submission?.id || null;
  return submissionId.value;
}

async function saveDraft() {
  statusMsg.value = "";
  missingIds.value = [];
  busy.value = true;
  try {
    const id = await ensureSubmission();
    await apiJson(`/submissions/${id}`, "PATCH", buildAnswersPayload());
    statusMsg.value = "Чернетку збережено ✅";
  } catch (e) {
    statusMsg.value = `Помилка: ${e.message}`;
  } finally {
    busy.value = false;
  }
}

async function onSubmit() {
  statusMsg.value = "";
  missingIds.value = [];
  busy.value = true;

  try {
    const id = await ensureSubmission();

    await apiJson(`/submissions/${id}`, "PATCH", buildAnswersPayload());
    await apiJson(`/submissions/${id}/submit`, "POST", {});

    statusMsg.value = "Відправлено ✅";
  } catch (e) {
    if (e.status === 400 && e.data?.missingQuestionIds) {
      missingIds.value = e.data.missingQuestionIds;
      statusMsg.value = "Заповніть обовʼязкові поля!";
    } else {
      statusMsg.value = `Помилка: ${e.message}`;
    }
  } finally {
    busy.value = false;
  }
}
</script>

<style>
.wrap {
  width: 100%;
  margin: 0;
  padding: 24px;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

.title {
  font-size: 28px;
  margin: 0 0 24px;
  text-align: left;
}

.card {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  padding: 24px;
  background: #fff;
}

.field {
  margin-bottom: 14px;
}

.label {
  display: block;
  font-weight: 600;
  margin-bottom: 6px;
}

.label.required::after {
  content: " *";
  color: #d00;
}

.input,
.textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d7d7d7;
  border-radius: 10px;
  padding: 10px 12px;
  outline: none;
}

.checkboxRow {
  display: flex;
  gap: 10px;
  align-items: center;
}

.checkboxLabel {
  cursor: pointer;
}

.invalid {
  border-color: #d00;
}

.hint {
  margin: 6px 0 0;
  color: #d00;
  font-size: 13px;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.btn {
  border: none;
  border-radius: 10px;
  padding: 10px 14px;
  cursor: pointer;
  background: #111;
  color: #fff;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.ghost {
  background: #f3f3f3;
  color: #111;
}

.error {
  color: #d00;
}

.status {
  margin-top: 12px;
}
</style>
