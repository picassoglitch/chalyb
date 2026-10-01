// "Proponer una idea" (rebuild P4-6): validation and the row it stores. Pure,
// so the unit test checks exactly what the server action writes.

export type IdeaErrorKey = 'name' | 'email' | 'idea' | 'rateLimited' | 'sendFailed';

export interface IdeaInput {
  name: string;
  email: string;
  idea: string;
}

export interface IdeaRow {
  name: string;
  email: string;
  message: string;
  pane: 'idea';
  ip_addr: string | null;
  user_agent: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readIdeaForm(form: FormData): IdeaInput {
  return {
    name: String(form.get('name') ?? '').trim(),
    email: String(form.get('email') ?? '')
      .trim()
      .toLowerCase(),
    idea: String(form.get('idea') ?? '').trim(),
  };
}

/** The first invalid field, or null. Limits fit partner_inquiries' checks. */
export function validateIdea(input: IdeaInput): 'name' | 'email' | 'idea' | null {
  if (input.name.length < 2 || input.name.length > 120) return 'name';
  if (!EMAIL_RE.test(input.email) || input.email.length > 200) return 'email';
  if (input.idea.length < 10 || input.idea.length > 3000) return 'idea';
  return null;
}

/** No marketing opt-in is collected: the row holds the lead and nothing else. */
export function ideaRow(
  input: IdeaInput,
  meta: { ip: string | null; userAgent: string | null },
): IdeaRow {
  return {
    name: input.name,
    email: input.email,
    message: input.idea,
    pane: 'idea',
    ip_addr: meta.ip,
    user_agent: meta.userAgent,
  };
}
