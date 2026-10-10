// A small bull's head in the same thin-line style as the menu's other icons, for
// Investing. Takes the same size, className and strokeWidth as those icons.
export default function BullIcon({ size = 24, strokeWidth = 2, className = "", ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      <path d="M3 4c0 3.5 2.2 6 5.5 6" />
      <path d="M21 4c0 3.5-2.2 6-5.5 6" />
      <path d="M8.5 10h7" />
      <path d="M8.5 10C7.5 12 7 14 7 15.5 7 18.5 9.2 21 12 21s5-2.5 5-5.5c0-1.5-.5-3.5-1.5-5.5" />
      <path d="M7.6 12.2 4.5 11" />
      <path d="M16.4 12.2 19.5 11" />
      <path d="M10.3 17.6h.01" />
      <path d="M13.7 17.6h.01" />
    </svg>
  );
}
