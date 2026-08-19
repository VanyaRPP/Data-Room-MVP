import { baseRules } from "@dataroom/config/eslint-base.mjs";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**"] },
  ...tseslint.configs.recommended,
  baseRules,
);
