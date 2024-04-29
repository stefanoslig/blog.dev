import tailwind from 'tailwindcss'

export default {
  plugins: [
    tailwind({
      content: ["./blog/.vitepress/theme/components/*.vue", "./blog/**/*.md"],
      plugins: []
    })
  ]
}