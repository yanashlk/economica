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
  if (!email.value || !password.value) {
    msg.value = "Заповніть всі поля";
    return;
  }

  msg.value = "";
  busy.value = true;

  try {
    const data = await apiJson("/auth/login", "POST", {
      email: email.value,
      password: password.value,
    });

    if (data?.token) {
      localStorage.setItem("admin_token", data.token);
      router.push("/admin/submissions");
    } else {
      throw new Error(data?.message || "Невірний логін або пароль");
    }
  } catch (e) {
    // помилка від сервера, якщо вона є
    msg.value = e.message || "Помилка зв'язку з сервером";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="login-page">
    <h1>Адмін — вхід</h1>

    <form class="card" @submit.prevent="login">
      <div class="field">
        <label for="email">Email</label>
        <input
            id="email"
            class="input"
            v-model.trim="email"
            type="email"
            placeholder="admin@example.com"
            required
        />
      </div>

      <div class="field">
        <label for="password">Пароль</label>
        <input
            id="password"
            class="input"
            v-model="password"
            type="password"
            placeholder="••••••••"
            required
        />
      </div>

      <button class="btn" type="submit" :disabled="busy">
        {{ busy ? "Вхід..." : "Увійти" }}
      </button>

      <transition name="fade">
        <p v-if="msg" class="msg">{{ msg }}</p>
      </transition>
    </form>
  </main>
</template>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  padding: 24px;
}

.card {
  width: 100%;
  max-width: 400px;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.field {
  margin-bottom: 16px;
}

label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.input {
  width: 100%;
  padding: 12px;
  border: 1px solid #d7d7d7;
  border-radius: 8px;
  box-sizing: border-box;
}

.btn {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: none;
  background: #111;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn:hover:not(:disabled) {
  background: #333;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.msg {
  margin-top: 16px;
  color: #d00;
  text-align: center;
  font-size: 14px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>