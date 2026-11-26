import React from 'react';
import { render, mount } from 'enzyme';
import List from '../list';
import Checkbox from '../../checkbox';

const listCommonProps = {
  prefixCls: 'c7n-transfer-list',
  dataSource: [{
    key: 'a',
    title: 'a',
  }, {
    key: 'b',
    title: 'b',
  }, {
    key: 'c',
    title: 'c',
    disabled: true,
  }],
  checkedKeys: ['a'],
  notFoundContent: 'Not Found',
  lazy: false,
};

describe('List', () => {
  it('should render correctly', () => {
    const wrapper = render(<List {...listCommonProps} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('reveals all nearby rows on a single root notification with the legacy observer', () => {
    const original = window.IntersectionObserver;
    const observers = [];
    window.IntersectionObserver = class {
      constructor(notify, options) {
        this.root = options.root;
        this.emit = targets => notify(targets.map(target => ({ target, isIntersecting: true, intersectionRatio: 1 })));
        observers.push(this);
      }

      observe() {}

      unobserve() {}

      disconnect() {}
    };
    let wrapper;
    try {
      const elementType = React.forwardRef((props, ref) => <section {...props} ref={ref} />);
      const lazy = { elementType, debounce: true, throttle: 1000 };
      wrapper = mount(<div style={{ overflow: 'auto' }}><List {...listCommonProps} lazy={lazy} render={item => item.key} /></div>);
      const root = wrapper.getDOMNode();
      const rows = Array.from(root.querySelectorAll('.LazyLoad'));
      observers.find(observer => observer.root === root).emit(rows);
      expect(root.querySelectorAll('li')).toHaveLength(0);
      observers.find(observer => !observer.root).emit([root]);
      wrapper.update();
      expect(rows.map(row => row.textContent)).toEqual(['a', 'b', 'c']);
    } finally {
      if (wrapper) wrapper.unmount();
      window.IntersectionObserver = original;
    }
  });

  const Plain = props => <section {...props} />;
  class ClassWrapper extends React.PureComponent {
    render() { return <Plain {...this.props} />; }
  }

  it.each([Plain, ClassWrapper])('renders each row once for wrappers without a DOM ref', elementType => {
    const lazy = { elementType, onContentVisible: jest.fn() };
    const wrapper = mount(<List {...listCommonProps} lazy={lazy} render={item => item.key} />);
    try {
      expect(wrapper.getDOMNode().querySelectorAll('section.is-visible > li')).toHaveLength(3);
      wrapper.setProps({ checkedKeys: [] });
      expect(lazy.onContentVisible).toHaveBeenCalledTimes(3);
    } finally {
      wrapper.unmount();
    }
  });

  it('should check top Checkbox while all available items are checked', () => {
    const wrapper = mount(<List {...listCommonProps} checkedKeys={['a', 'b']} />);
    expect(wrapper.find('.c7n-transfer-list-header').find(Checkbox).prop('checked'))
      .toBeTruthy();
  });
});
