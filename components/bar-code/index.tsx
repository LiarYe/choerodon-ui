import React, { FunctionComponent } from 'react';
import { BaseOptions as JsBarCodeBaseOption } from 'jsbarcode';
import QRCode from './QRCode';
import BarCode from './BarCode';
import { CodeType } from './enum';

export {
  CodeType,
};

export interface QRBarCodeProps {
  size?: number;
  includeMargin?: boolean;
  level?: 'L' | 'M' | 'Q' | 'H';
  imageSettings?: {
    src: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    excavate?: boolean;
  };
  type?: string;
  prefixCls?: string;
  className?: string;
  value: string;
  bgColor?: string;
  fgColor?: string;
  renderAs?: 'canvas' | 'svg';
  /**
   * JsBarcode 需要的属性
   */
  option?: JsBarCodeBaseOption;
}

const QRBarCode: FunctionComponent<QRBarCodeProps> = function QRBarCode(props) {
  const { type = CodeType.QR, ...rest } = props;
  if (type === CodeType.QR) {
    return <QRCode {...rest} />;
  }
  return <BarCode {...rest} />;
};

export default QRBarCode;
