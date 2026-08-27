import React from "react";

/**
 * The ZIONX pixel-cross — the brand mark from the landing hero and the sidebar.
 * Inherits color by default so it works on both ink and paper grounds.
 */
const PixelMark = ({ size = 10, fill = "currentColor", style, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 3 3"
    aria-hidden="true"
    style={style}
    className={className}
  >
    <rect x="0" y="0" width="1" height="1" fill={fill} />
    <rect x="2" y="0" width="1" height="1" fill={fill} />
    <rect x="1" y="1" width="1" height="1" fill={fill} />
    <rect x="0" y="2" width="1" height="1" fill={fill} />
    <rect x="2" y="2" width="1" height="1" fill={fill} />
  </svg>
);

export default PixelMark;
