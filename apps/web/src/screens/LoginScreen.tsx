import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loading } from '../components/ui/Loading';
import { setToken } from '../lib/session';

/**
 * /login#<token> adopts an existing device token (used by the seed script, and handy for
 * moving your player to another device). The token sits in the fragment so it never reaches a server log.
 */
export function LoginScreen() {
  const navigate = useNavigate();
  useEffect(() => {
    const token = window.location.hash.slice(1);
    if (token) setToken(token);
    navigate('/', { replace: true });
  }, [navigate]);
  return <Loading />;
}
