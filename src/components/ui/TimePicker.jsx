import React from "react";

// recibe options: ["09:00","09:30",...]
// occupied: ["09:00:00","09:30:00",...] o ["09:00","09:30"]
export default function TimePicker({ options = [], occupied = [], onSelect = () => {}, selected = "" }) {
  const onlyHHMM = (h) => {
    if (!h && h !== 0) return "";
    const s = String(h).replace(/\u00A0/g, " ").trim();
    const m = s.match(/(\d{1,2}:\d{2})/);
    return m ? m[1].padStart(5, "0") : s;
  };

  const occupiedSet = new Set((occupied || []).map(o => onlyHHMM(o)));

  return (
    <div className="flex flex-wrap">
      {(options || []).map(opt => {
        const optKey = onlyHHMM(opt);
        const isOccupied = occupiedSet.has(optKey);
        const isSelected = selected === optKey;
        return (
          <button
            key={optKey}
            type="button"
            onClick={() => { if (!isOccupied) onSelect(optKey); }}
            disabled={isOccupied}
            className={
              `px-2 py-1 m-1 rounded border text-sm transition ` +
              (isOccupied
                ? "bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed"
                : (isSelected ? "bg-blue-600 text-white border-blue-700" : "bg-white hover:bg-blue-50 text-black"))
            }
          >
            {optKey}
          </button>
        );
      })}
    </div>
  );
}