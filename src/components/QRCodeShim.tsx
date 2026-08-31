import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function QRCode({
  value,
  size = 168,
  color = '#041E42',
  backgroundColor = '#ffffff',
}: {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
}) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      fgColor={color}
      bgColor={backgroundColor}
    />
  );
}
