// https://vitepress.dev/guide/custom-theme
import { h } from "vue";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import "./style.css";
import "./custom.css";
import Test1 from "./components/Test1.vue";
import Test4 from "./components/Test4.vue";
import Avatar from "./components/Avatar.vue";

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      "home-hero-info": () => h(Test1),
      "home-hero-actions-after": () => h(Test4),
      "home-hero-image": () => h(Avatar),
    });
  },
  enhanceApp({ app, router, siteData }) {
    // ...
  },
} satisfies Theme;
