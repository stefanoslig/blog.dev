// https://vitepress.dev/guide/custom-theme
import { h } from "vue";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import "./style.css";
import "./custom.css";
import Info from "./components/Info.vue";
import Posts from "./components/Posts.vue";
import Avatar from "./components/Avatar.vue";
import Title from "./components/Title.vue";
import About from "./components/About.vue";

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      "home-hero-info": () => h(Info),
      "home-hero-actions-after": () => h(About),
      "home-hero-image": () => h(Avatar),
      "doc-before": () => h(Title),
    });
  },
  enhanceApp({ app, router, siteData }) {
    app.component("Posts", Posts);
  },
} satisfies Theme;
