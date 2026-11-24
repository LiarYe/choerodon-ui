import ReactDOM from 'react-dom';

export const createRoot = container => ({
  render(element) {
    ReactDOM.render(element, container);
  },
});
