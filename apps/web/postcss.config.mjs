/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {}, // 👈 This MUST be the new package name
  },
};

export default config;
