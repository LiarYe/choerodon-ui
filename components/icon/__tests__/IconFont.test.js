import create from '../IconFont';

describe('IconFont script URLs', () => {
  it.each(['load', 'error'])('preserves the input array and reverse loading order on %s', event => {
    const urls = Object.freeze([`/icon-${event}-first.js`, `/icon-${event}-second.js`]);
    const scripts = () => Array.from(document.querySelectorAll('script[data-namespace]')).filter(script => urls.includes(script.getAttribute('src')));
    try {
      create({ scriptUrl: urls });
      expect(scripts().map(script => script.getAttribute('src'))).toEqual([urls[1]]);
      scripts()[0].dispatchEvent(new Event(event));
      expect(scripts().map(script => script.getAttribute('src'))).toEqual([urls[1], urls[0]]);
      create({ scriptUrl: urls });
      expect(scripts()).toHaveLength(2);
      expect(urls).toEqual([`/icon-${event}-first.js`, `/icon-${event}-second.js`]);
    } finally {
      scripts().forEach(script => script.parentNode.removeChild(script));
    }
  });
});
