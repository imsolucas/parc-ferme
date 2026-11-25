// Device-bound session token, kept in localStorage.
const KEY = 'pf.token';

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const setToken = (token: string) => {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* private mode: the session lasts until the tab closes */
  }
};

export const clearToken = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
};
