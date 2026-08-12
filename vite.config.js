import { defineConfig } from 'vite';

// base: './' — chemins relatifs pour que le build fonctionne aussi bien à la racine d'un domaine
// qu'sous un sous-chemin GitHub Pages (https://<user>.github.io/<repo>/), sans configuration par dépôt.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
