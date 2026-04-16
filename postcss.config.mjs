/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {}, // <--- CHANGE THIS LINE (was 'tailwindcss')
    autoprefixer: {},
  },
};

export default config;