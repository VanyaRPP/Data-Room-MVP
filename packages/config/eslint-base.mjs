// Shared house rules layered on top of each app's own ESLint flat config.
// Deliberately tiny: Next.js and Nest.js have incompatible plugin ecosystems,
// so this only adds cross-cutting rules, not a full shared config.
export const baseRules = {
  rules: {
    "no-console": ["error", { allow: ["warn", "error"] }],
  },
};

export default [baseRules];
