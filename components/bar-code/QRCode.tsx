import React, { FunctionComponent } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';

import { QRBarCodeProps } from './index';

const QR: FunctionComponent<QRBarCodeProps> = function QR(props) {
  const { renderAs, imageSettings, size = 128, ...rest } = props;
  const Renderer = renderAs === 'svg' ? QRCodeSVG : QRCodeCanvas;
  // v1 inferred each missing logo dimension as 10% of the QR size.
  const logoSize = Math.floor(size * 0.1);
  const image = imageSettings && {
    ...imageSettings,
    width: imageSettings.width ?? logoSize,
    height: imageSettings.height ?? logoSize,
    excavate: imageSettings.excavate ?? false,
  };
  return <Renderer {...rest} size={size} imageSettings={image} boostLevel={false} />;
};

export default QR;
