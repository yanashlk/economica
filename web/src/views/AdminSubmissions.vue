<template>
  <main class="p">
    <div class="top">
      <h1>Заявки</h1>

      <div class="right">
        <select v-model="status" class="select" @change="load">
          <option value="">усі</option>
          <option value="draft">draft</option>
          <option value="submitted">submitted</option>
        </select>

        <label class="check">
          <input type="checkbox" v-model="onlyUnreviewed" @change="load" />
          <span>тільки неперевірені</span>
        </label>

        <button class="btn ghost" @click="logout">Вийти</button>
      </div>
    </div>

    <p v-if="loading">Завантаження…</p>
    <p v-else-if="error" class="err">{{ error }}</p>

    <div v-else class="table">
      <div class="row head">
        <div>ID</div>
        <div>Статус</div>
        <div>Створено</div>
        <div>Перевірено</div>
        <div>Форма</div>
      </div>

      <div
          v-for="s in items"
          :key="s.id"
          class="row"
          role="button"
          @click="go(s.id)"
      >
        <div class="mono">{{ s.id.slice(0, 8) }}…</div>
        <div>{{ s.status }}</div>
        <div>{{ fmt(s.created_at) }}</div>
        <div>{{ s.reviewed_at ? "✅" : "—" }}</div>
        <div>{{ s.form_title }}</div>
      </div>
    </div>
  </main>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const items = ref([]);
const loading = ref(true);
const error = ref("");

const status = ref("");
const onlyUnreviewed = ref(false);

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
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}

async function load() {
  loading.value = true;
  error.value = "";

  try {
    const params = new URLSearchParams();
    if (status.value) params.set("status", status.value);
    if (onlyUnreviewed.value) params.set("reviewed", "0");

    const q = params.toString() ? `?${params.toString()}` : "";

    const r = await fetch(`/admin/submissions${q}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });

    const data = await parseJsonSafe(r);
    if (!r.ok) throw new Error(data?.error || data?._raw || `HTTP ${r.status}`);

    items.value = data?.items || [];
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function go(id) {
  router.push(`/admin/submissions/${id}`);
}

function logout() {
  localStorage.removeItem("admin_token");
  router.push("/admin/login");
}

onMounted(load);
</script>

<style scoped>
.p {
  padding: 24px;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.right {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.select {
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #d7d7d7;
}

.check {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  user-select: none;
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

.table {
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  overflow: hidden;
  margin-top: 16px;
}

.row {
  display: grid;
  grid-template-columns: 140px 120px 220px 120px 1fr;
  gap: 12px;
  padding: 12px 14px;
  border-top: 1px solid #eee;
}

.row.head {
  background: #fafafa;
  font-weight: 700;
  border-top: none;
}

.row:not(.head) {
  cursor: pointer;
}

.row:not(.head):hover {
  background: #fcfcfc;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.err {
  color: #d00;
}
</style>