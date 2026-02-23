<template>
  <main class="p">
    <h1>Адмін — вхід</h1>

    <form class="card" @submit.prevent="login">
      <label>Email</label>
      <input class="input" v-model.trim="email" type="email" required />

      <label>Пароль</label>
      <input class="input" v-model="password" type="password" required />

      <button class="btn" type="submit" :disabled="busy">
        {{ busy ? "Вхід..." : "Увійти" }}
      </button>

      <p v-if="msg" class="msg">{{ msg }}</p>
    </form>
  </main>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { apiJson } from "../api";

const router = useRouter();

const email = ref(import.meta.env.VITE_ADMIN_EMAIL || "");
const password = ref(import.meta.env.VITE_ADMIN_PASSWORD || "");

const busy = ref(false);
const msg = ref("");

async function login() {
  msg.value = "";
  busy.value = true;

  try {
    const data = await apiJson("/auth/login", "POST", {
      email: email.value,
      password: password.value,
    });

    if (!data?.token) throw new Error("Сервер не повернув token");

    localStorage.setItem("admin_token", data.token);
    router.push("/admin/submissions");
  } catch (e) {
    msg.value = e?.message || "Помилка входу";
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.p {
  padding: 24px;
}

.card {
  max-width: 420px;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  padding: 16px;
}

.input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d7d7d7;
  border-radius: 10px;
  margin: 6px 0 12px;
}

.btn {
  padding: 10px 14px;
  border-radius: 10px;
  border: none;
  background: #111;
  color: #fff;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.msg {
  margin-top: 10px;
  color: #d00;
}
</style>
