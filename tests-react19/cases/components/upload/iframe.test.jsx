import React from 'react';
import { render } from '@testing-library/react';
import Upload from 'choerodon-ui/lib/rc-components/upload/Upload';

// Only the unused Ajax branch imports the attachment graph (which cycles back to Upload).
jest.mock('choerodon-ui/lib/rc-components/upload/AjaxUploader', () => () => null);

const CustomTag = React.forwardRef(({ children, ...props }, ref) => (
  <section {...props} ref={ref}><div>{children}</div></section>
));

it.each(['section', CustomTag])('keeps the chosen iframe host across updates (%p)', Tag => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'File');
  Object.defineProperty(window, 'File', { configurable: true, value: undefined });
  try {
    const { container, rerender, unmount } = render(<Upload component={Tag} />);
    const host = container.firstChild;
    const frame = host.querySelector('iframe');
    if (Tag === CustomTag) {
      expect(frame.parentNode).toBe(host.firstChild);
      Object.defineProperties(frame.parentNode, { offsetWidth: { value: 41 }, offsetHeight: { value: 17 } });
    }
    expect(host.tagName).toBe('SECTION');
    expect(frame.contentDocument.querySelector('input[type=file]').name).toBe('file');
    Object.defineProperties(host, { offsetWidth: { value: 137 }, offsetHeight: { value: 29 } });
    rerender(<Upload component={Tag} disabled />);
    expect(container.querySelector('iframe')).toBe(frame);
    expect([frame.style.width, frame.style.height, frame.style.display]).toEqual(['137px', '29px', 'none']);
    unmount();
    expect(container.firstChild).toBeNull();
  } finally {
    Object.defineProperty(window, 'File', descriptor);
  }
});
