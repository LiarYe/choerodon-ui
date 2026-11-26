import { useEffect, useState } from 'react';
import { observe } from 'react-intersection-observer';

interface Options {
  root?: Element | null;
  rootMargin: string;
  initialInView: boolean;
  triggerOnce?: boolean;
}

export default function useVirtualInView({ root, rootMargin, initialInView, triggerOnce }: Options) {
  const [node, setNode] = useState<Element | null | undefined>(null);
  const [initial] = useState(initialInView);
  const [result, setResult] = useState<{ inView: boolean; entry: IntersectionObserverEntry }>();
  // Keep the first false entry: virtual placeholders need its measured height.
  useEffect(() => {
    if (!node) return undefined;
    let active = true;
    // The no-observer fallback can report visibility before observe returns its cleanup.
    let stop: (() => void) | undefined;
    const cleanup = () => {
      active = false;
      stop?.();
      stop = undefined;
    };
    stop = observe(node, (inView, entry) => {
      if (!active) return;
      setResult({ inView, entry });
      if (triggerOnce && inView) cleanup();
    }, { root, rootMargin });
    if (!active) cleanup();
    return cleanup;
  }, [node, root, rootMargin, triggerOnce]);
  const current = result && result.entry.target === node ? result : undefined;
  return { ref: setNode, inView: current ? current.inView : initial, entry: current && current.entry };
}
