import policy from "./agent-tool.json";

export const commitHeaderMaxLength = policy.subject.maxLength;

export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", policy.subject.types],
    "header-max-length": [2, "always", commitHeaderMaxLength],
  },
};
