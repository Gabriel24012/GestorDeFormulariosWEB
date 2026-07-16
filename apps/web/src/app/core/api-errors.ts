export interface ApiErrorBody {
  error?: string;
  field?: string;
  message?: string;
  details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
}

export function apiErrorMessage(error: unknown, labels: Record<string, string> = {}) {
  const body = apiErrorBody(error);
  const fieldMessages = body.details?.fieldErrors ? Object.entries(body.details.fieldErrors)
    .filter(([, messages]) => messages?.length)
    .map(([field, messages]) => `${labels[field] ?? field}: ${messages.join(', ')}`) : [];
  if (fieldMessages.length) return fieldMessages.join('. ');
  if (body.details?.formErrors?.length) return body.details.formErrors.join('. ');
  if (body.field) return `${labels[body.field] ?? body.field}: ${body.error ?? 'revisa este campo'}`;
  return body.error ?? body.message ?? 'No fue posible completar la accion.';
}

export function apiErrorBody(error: unknown): ApiErrorBody {
  if (error && typeof error === 'object' && 'error' in error) {
    const maybeHttp = error as { error?: ApiErrorBody | string };
    if (typeof maybeHttp.error === 'string') return { error: maybeHttp.error };
    return maybeHttp.error ?? {};
  }
  if (typeof error === 'string') {
    return { error };
  }
  return {};
}
