<script setup lang="ts">
import { useModeration } from "@safetype/vue";
import { ref } from "vue";

const name = ref("");
const body = ref("");
const comments = ref<{ name: string; body: string }[]>([]);

// Moderate any string reactively, e.g. a live "suggest" preview.
const preview = useModeration(body, { mode: "suggest" });

function submit() {
  // Only runs when no field is blocked: SafeType stops blocked submissions first.
  comments.value.push({ name: name.value, body: body.value });
  body.value = "";
}
</script>

<template>
  <main>
    <h1>Comments</h1>
    <form @submit.prevent="submit">
      <label for="name">Name</label>
      <!-- Directive: works on any input, textarea or contenteditable -->
      <input id="name" v-model="name" v-safe-type />

      <label for="body">Comment</label>
      <!-- Component: renders its own accessible message -->
      <SafeTypeTextarea id="body" v-model="body" rows="4" />

      <p v-if="preview.matches.length" class="hint">Suggestion: “{{ preview.suggestedText }}”</p>
      <button type="submit">Post</button>
    </form>
    <ul>
      <li v-for="(c, i) in comments" :key="i"><strong>{{ c.name || "Anonymous" }}:</strong> {{ c.body }}</li>
    </ul>
    <p class="hint">Your server should still re-check comments with @safetype/core.</p>
  </main>
</template>

<style>
main { max-width: 560px; margin: 40px auto; padding: 0 16px; font: 16px/1.5 system-ui, sans-serif; }
form { display: grid; gap: 8px; }
input, textarea { font: inherit; padding: 8px; }
.hint { color: #666; font-size: 14px; }
</style>
