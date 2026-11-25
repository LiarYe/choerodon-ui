import React, { useRef, useState } from 'react';
import Carousel from '../../components/carousel';
import '../../components/carousel/style';

const responsive = [{ breakpoint: 768, settings: { slidesToShow: 1 } }];

export default function B6Demo() {
  const carousel = useRef(null);
  const [events, setEvents] = useState([]);
  const record = event => setEvents(previous => [...previous, event]);
  return (
    <section id="b6">
      <p>默认显示 2 张，视口 ≤ 768px 显示 1 张。</p>
      <button type="button" onClick={() => carousel.current.next()}>ref.next</button>
      <button type="button" onClick={() => carousel.current.prev()}>ref.prev</button>
      <button type="button" onClick={() => carousel.current.goTo(2)}>ref.goTo(2)</button>
      <Carousel ref={carousel} arrows infinite={false} slidesToShow={2} slidesToScroll={1}
        responsive={responsive} speed={100} dotsActionType={['click', 'hover']}
        beforeChange={(from, to) => record(`before(${from},${to})`)}
        afterChange={to => record(`after(${to})`)}>
        {[1, 2, 3, 4, 5].map(number => (
          <div key={number}><div style={{ height: 100, background: '#345', color: 'white' }}>第 {number} 张</div></div>
        ))}
      </Carousel>
      <output>{events.join(' ')}</output>
    </section>
  );
}
