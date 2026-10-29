import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // L&Q Mercatone 品牌色
        primary: {
          50: '#f0eeff',
          100: '#e0ddff',
          200: '#c4bfff',
          300: '#a29bfe',
          400: '#8b7dff',
          500: '#6c5ce7',  // 主色
          600: '#5a4bd1',
          700: '#4a3ab5',
          800: '#3d2f96',
          900: '#342878',
        },
        gold: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#C9A84C',  // 品牌金色
          600: '#A8862D',
          700: '#8B7D3C',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Helvetica Neue', 'PingFang SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
