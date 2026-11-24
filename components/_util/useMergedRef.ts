import { MutableRefObject, Ref, useMemo, version } from 'react';

const supportsRefCleanup = parseInt(version, 10) >= 19;

function attach<T>(ref: NonNullable<Ref<T>>, node: T, honorCleanup: boolean): () => void {
  if (typeof ref === 'function') {
    const cleanup: unknown = ref(node);
    return honorCleanup && typeof cleanup === 'function' ? () => cleanup() : () => ref(null);
  }
  const objectRef = ref as MutableRefObject<T | null>;
  objectRef.current = node;
  return () => { objectRef.current = null; };
}

export function mergeRefs<T>(first: Ref<T>, second?: Ref<T>, honorCleanup = supportsRefCleanup): Ref<T> {
  if (!first || !second) return first || second || null;

  let detachFirst: (() => void) | undefined;
  let detachSecond: (() => void) | undefined;
  return (node: T | null) => {
    if (node !== null) {
      detachFirst = attach(first, node, honorCleanup);
      detachSecond = attach(second, node, honorCleanup);
    } else {
      if (detachFirst) detachFirst();
      if (detachSecond) detachSecond();
      detachFirst = undefined;
      detachSecond = undefined;
    }
  };
}

export default function useMergedRef<T>(first: Ref<T>, second?: Ref<T>, honorCleanup = supportsRefCleanup): Ref<T> {
  return useMemo(() => mergeRefs(first, second, honorCleanup), [first, second, honorCleanup]);
}
