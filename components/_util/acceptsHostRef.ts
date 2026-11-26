import { ForwardRef, Memo } from 'react-is';

// A forwarded ref can still expose an imperative handle; validate its value at attachment.
export default function acceptsHostRef(type: unknown): boolean {
  if (typeof type === 'string') return true;
  if (!type || typeof type !== 'object') return false;
  const wrapper = type as { $$typeof?: symbol; type?: unknown };
  return wrapper.$$typeof === Memo ? acceptsHostRef(wrapper.type) : wrapper.$$typeof === ForwardRef;
}
