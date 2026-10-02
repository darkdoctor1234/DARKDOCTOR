// Client's published password policy — mirrored server-side by
// PasswordComplexityValidator + MinimumLengthValidator(min_length=6) in
// backend/config/settings/base.py, so a password that passes here also
// passes the backend. Keep both in sync if the policy ever changes.
export const PASSWORD_RULES: { key: string; label: string; test: (p: string) => boolean }[] = [
  { key: "length", label: "At least 6 characters", test: (p) => p.length >= 6 },
  { key: "upper",  label: "One uppercase letter",   test: (p) => /[A-Z]/.test(p) },
  { key: "lower",  label: "One lowercase letter",   test: (p) => /[a-z]/.test(p) },
  { key: "numSpec", label: "One number or special character", test: (p) => /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(p) },
];

export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
