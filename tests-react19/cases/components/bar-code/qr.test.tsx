import React from 'react';
import BarCode, { CodeType, QRBarCodeProps } from '../../../../components/bar-code';

// The sandbox's Testing Library requires createRoot; React 16 uses its own renderer.
const legacy = React.version.startsWith('16.');
const rtl = legacy ? null : require('@testing-library/react');
const legacyDOM = legacy ? require('react-dom') : null;
const act16 = legacy ? require('react-dom/test-utils').act : null;

const container = document.createElement('div');

function render(element: React.ReactElement) {
  if (legacy) act16(() => { legacyDOM.render(element, container); });
  else rtl.render(element, { container });
}

afterEach(() => {
  if (legacy) act16(() => { legacyDOM.unmountComponentAtNode(container); });
  else rtl.cleanup();
  jest.restoreAllMocks();
});

test('draws the default QR on a canvas', () => {
  // jsdom has no 2D context; only stub the drawing surface, not the QR encoder.
  const context = { scale: jest.fn(), fillRect: jest.fn() };
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context as unknown as CanvasRenderingContext2D);
  render(<BarCode value="B8" size={96} />);
  expect(container.firstElementChild).toBeInstanceOf(HTMLCanvasElement);
  expect(container.querySelector('canvas')?.style.width).toBe('96px');
  expect(context.fillRect.mock.calls.length).toBeGreaterThan(1);
});

test('renders an SVG QR using the legacy public properties', () => {
  const props: QRBarCodeProps = {
    type: CodeType.QR, renderAs: 'svg', value: 'B8', className: 'custom-qr',
    size: 112, level: 'H', includeMargin: true, bgColor: '#ffffff', fgColor: '#123456',
    imageSettings: { src: '/logo.svg', x: 40, y: 40, width: 16, height: 16, excavate: true },
  };
  render(<BarCode {...props} />);
  const svg = container.querySelector('svg.custom-qr')!;
  expect(svg.getAttribute('width')).toBe('112');
  expect(svg.querySelector('path[fill="#ffffff"]')).not.toBeNull();
  const modules = svg.querySelector('path[fill="#123456"]')?.getAttribute('d');
  expect(modules).toBeTruthy();
  const image = svg.querySelector('image')!;
  expect(image.getAttribute('href') || image.getAttribute('xlink:href')).toBe('/logo.svg');
  const withMargin = Number(svg.getAttribute('viewBox')!.split(' ')[2]);
  render(<BarCode {...props} includeMargin={false} />);
  expect(Number(container.querySelector('svg')!.getAttribute('viewBox')!.split(' ')[2])).toBe(withMargin - 8);
});

test('keeps logo dimensions optional and defaults each to ten percent', () => {
  render(<BarCode renderAs="svg" value="B8" size={105} imageSettings={{ src: '/logo.svg' }} />);
  const svg = container.querySelector('svg')!;
  const modules = Number(svg.getAttribute('viewBox')!.split(' ')[2]);
  const image = svg.querySelector('image')!;
  expect(Number(image.getAttribute('width'))).toBeCloseTo(10 * modules / 105);
  expect(Number(image.getAttribute('height'))).toBeCloseTo(10 * modules / 105);
});

test('routes BAR to JsBarcode and forwards its options', () => {
  render(<BarCode type={CodeType.BAR} value="1234" renderAs="svg" option={{ height: 37, displayValue: false }} />);
  const svg = container.querySelector('svg')!;
  expect(svg.querySelector('g rect[height="37"]')).not.toBeNull();
  expect(svg.querySelector('text')).toBeNull();
});
