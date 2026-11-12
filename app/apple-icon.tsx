import { ImageResponse } from "next/og";

// iOS ignores SVG icons for "Add to Home Screen", so render the starburst as a PNG.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#5b2a6e",
        }}
      >
        <svg width="104" height="104" viewBox="0 0 24 24">
          <polygon
            fill="#ffffff"
            points="23,12 15.7,13.53 19.78,19.78 13.53,15.7 12,23 10.47,15.7 4.22,19.78 8.3,13.53 1,12 8.3,10.47 4.22,4.22 10.47,8.3 12,1 13.53,8.3 19.78,4.22 15.7,10.47"
          />
        </svg>
      </div>
    ),
    size,
  );
}
