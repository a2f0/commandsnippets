import {useEffect, useRef} from 'react';

/** A completion may affect its mounted instance, never a replacement. */
export function useMounted() {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
