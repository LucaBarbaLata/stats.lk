// Limits shared by the forms (in the browser) and the server checks.
// Kept free of server code so client components can import them.

export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

// What's wrong with a new password, if anything
export function passwordProblem(password: string, email: string | null): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  if (email && password.trim().toLowerCase() === email) return "Don't use your email as the password.";
  return null;
}
