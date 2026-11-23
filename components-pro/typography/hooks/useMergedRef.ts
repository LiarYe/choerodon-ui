import { MutableRefObject, Ref, useMemo } from 'react';

function attach<T>(ref: NonNullable<Ref<T>>, node: T): () => void {
  if (typeof ref === 'function') {
    const cleanup: unknown = ref(node);
    return typeof cleanup === 'function' ? () => cleanup() : () => ref(null);
  }
  const objectRef = ref as MutableRefObject<T | null>;
  objectRef.current = node;
  return () => { objectRef.current = null; };
}

export default function useMergedRef<T>(first: Ref<T>, second?: Ref<T>): Ref<T> {
  return useMemo(() => {
    if (!first || !second) return first || second || null;

    let detachFirst: (() => void) | undefined;
    let detachSecond: (() => void) | undefined;
    // Return void to React 16; honor React 19 callback cleanups on detach.
    return (node: T | null) => {
      if (node !== null) {
        detachFirst = attach(first, node);
        detachSecond = attach(second, node);
      } else {
        if (detachFirst) detachFirst();
        if (detachSecond) detachSecond();
        detachFirst = undefined;
        detachSecond = undefined;
      }
    };
  }, [first, second]);
}
