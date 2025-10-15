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
    <div className="grid grid-cols-4 gap-3">
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
              `px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ` +
              (isOccupied
                ? "bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed"
                : (isSelected ? "bg-yellow-500 text-black border-2 border-yellow-400 scale-105 shadow-lg" : "bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 hover:scale-105"))
            }
          >
            {optKey}
          </button>
        );
      })}
    </div>
  );
}