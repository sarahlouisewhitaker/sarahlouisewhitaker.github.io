import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://sarahlouisewhitaker.github.io",
  // the old duplicate of the sports page; keep its address working
  redirects: {
    "/projects/sports-analytics-research": "/projects/sports/"
  }
});
