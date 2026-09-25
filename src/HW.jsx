// HW: holds the health and wellbeing planning, loaded from the planning workbook.
// Empty for now, the table goes in once the tab is picked.
export default function HW() {
  return (
    <div className="w-full overflow-x-auto">
      <div className="w-full min-w-[560px] border border-black bg-white shadow-sm">
        <div className="flex h-[18px] items-center border-b border-black px-2" style={{ backgroundColor: "#F2C46D" }}>
          <span className="text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900">HW</span>
        </div>
        <p className="px-2 py-2 text-[11px] italic text-neutral-400">Empty. The workbook goes in here.</p>
      </div>
    </div>
  );
}
