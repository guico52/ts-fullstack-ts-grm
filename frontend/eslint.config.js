import js from "@eslint/js"
import pluginVue from "eslint-plugin-vue"
import tseslint from "typescript-eslint"
import prettier from "eslint-config-prettier"
import globals from "globals"

/**
 * Deliberately small.
 *
 * Formatting is Prettier's job (`eslint-config-prettier` turns off every
 * rule that would fight it), and type errors are `vue-tsc`'s. What is left
 * for ESLint is the class of mistake neither of those sees: Vue template
 * errors. A `v-for` without a `:key`, a `v-if` beside a `v-for` on the same
 * element, a stray `v-html`, and the rest of `flat/recommended`.
 *
 * The design rules live in `src/lib/design-system.test.ts` — they need to
 * read files and render, which a linter cannot do.
 */
export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "test-results/**",
      "playwright-report/**",
      "smoke-artifacts/**",
      // Registry-managed: re-running the shadcn CLI would overwrite any
      // fix here, so linting it only produces noise.
      "src/components/ui/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    // Vue SFCs need the TS parser for their <script setup lang="ts"> block,
    // and the plugin's own parser has to stay outermost so it can split the
    // file into blocks first.
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
    },
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Names like `Card.vue` and `Field.vue` are the shadcn convention and
      // are already namespaced by their directory.
      "vue/multi-word-component-names": "off",
      // Attributes per line is a formatting choice, and Prettier owns it.
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/html-self-closing": "off",
      // Unused vars are already a hard error in `vue-tsc`.
      "no-unused-vars": "off",
    },
  },
  prettier,
]
