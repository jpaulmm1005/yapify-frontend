import fs from 'fs';
import { resolve } from 'path';

/**
 * Vite Plugin: Auto-import Web Components (GloMo style)
 *
 * Escanea archivos JS/TS y HTML buscando etiquetas de Custom Elements (ej. <login-dm>).
 * Si encuentra la etiqueta, busca en el package.json del Shell una dependencia
 * que coincida con el nombre de la etiqueta (ya sea exacta o con un scope @yapify/login-dm).
 * Si la encuentra, inyecta automáticamente el `import` en el archivo.
 */
export function componentAutoImportPlugin() {
  let dependencies = [];

  return {
    name: 'yapify-auto-import-components',
    enforce: 'pre',

    configResolved(config) {
      // Lee el package.json para obtener las dependencias registradas (tus MFEs)
      try {
        const pkgPath = resolve(config.root, 'package.json');
        const pkgText = fs.readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgText);

        // Juntamos dependencias de producción y desarrollo
        dependencies = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });

        // MOCK PARA PRUEBAS LOCALES: Simulamos que este componente está en package.json
        if (!dependencies.includes('yapify-test-ui')) {
          dependencies.push('yapify-test-ui');
        }
      } catch (e) {
        console.warn('⚠️ No se pudo leer package.json para el auto-import de componentes.');
      }
    },

    transform(code, id) {
      // Ignorar node_modules y ficheros que no sean JS o HTML
      if (id.includes('node_modules') || !/\.(js|ts|html)$/.test(id)) {
        return null;
      }

      // Regex para capturar etiquetas con guion: <mi-componente ...> o <mi-componente>
      const tagRegex = /<([a-z0-9]+-[a-z0-9-]+)[^>]*>/gi;
      let match;
      const tagsFound = new Set();

      while ((match = tagRegex.exec(code)) !== null) {
        tagsFound.add(match[1].toLowerCase());
      }

      if (tagsFound.size === 0) return null;

      let injectedImports = '';

      tagsFound.forEach((tag) => {
        // Buscamos si hay una dependencia en el package.json que termine con este tag.
        // Ej: si el tag es 'login-ui', buscará dependencias como 'login-ui' o '@yapify/login-ui'
        const matchingDep = dependencies.find((dep) => dep === tag || dep.endsWith(`/${tag}`));

        if (matchingDep) {
          // Inyectamos solo si no está importado manualmente ya
          if (
            !code.includes(`import '${matchingDep}'`) &&
            !code.includes(`import "${matchingDep}"`)
          ) {
            // MOCK LOCAL: si es el de prueba, apuntar al path relativo.
            // En producción será simplemente import '@yapify/login-ui'
            const importPath = matchingDep === 'yapify-test-ui'
              ? '/src/components/yapify-test-ui.js'
              : matchingDep;

            injectedImports += `\nimport '${importPath}';`;
          }
        }
      });

      if (injectedImports) {
        return {
          // Añadimos los imports al inicio (o final, en JS es Hoisted)
          code: injectedImports + '\n' + code,
          map: null,
        };
      }

      return null;
    },
  };
}
