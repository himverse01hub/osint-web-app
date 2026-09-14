/**
 * Central API fetch wrapper.
 *
 * Every authenticated `/api/*` call in the app goes through `apiFetch` so that
 * an expired/invalidated session (HTTP 401) reliably returns the user to the
 * login screen instead of leaving pages in broken error states.
 *
 * `/api/auth/*` endpoints are excluded: AuthContext manages those responses
 * itself (401 there simply means "not signed in yet").
 */
const AUTH_ENDPOINT = /\/api\/auth/;

let redirecting = false;

export const apiFetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
  const response = await fetch(input, { credentials: 'same-origin', ...init });
  if (
    response.status === 401 &&
    !AUTH_ENDPOINT.test(input) &&
    !redirecting &&
    typeof window !== 'undefined'
  ) {
    redirecting = true;
    try {
      sessionStorage.setItem('hp_session_expired', '1');
    } catch {
      /* sessionStorage unavailable — redirect still proceeds */
    }
    window.location.assign('/login?expired=1');
  }
  return response;
};
