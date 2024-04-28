<template>
    <h1 class="text-5xl font-bold">{{ pageData.title }}</h1>
    <div>Published at: {{ publishDate }}</div>
</template>
<script lang="ts" setup>
import { useData } from "vitepress";
import { ref } from "vue";


const pageData = useData().page;
const publishDate = ref("");
const { frontmatter } = pageData.value;
publishDate.value = new Intl.DateTimeFormat('default', { dateStyle: 'long' }).format(new Date(frontmatter.date))
</script>
