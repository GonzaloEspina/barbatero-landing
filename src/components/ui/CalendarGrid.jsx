import React from "react";

export default function CalendarGrid({ calendarDays = [], loading, minDateISO, dayNames = [], onSelectFecha, selectedIso = "" }) {
  if (loading) return <p>Cargando calendario...</p>;
  if (!calendarDays.length) return <div className="col-span-7 text-sm text-gray-600">No hay fechas disponibles en el rango.</div>;

  const todayIso = new Date().toISOString().slice(0,10);

  const weeks = (() => {
    if (!calendarDays || calendarDays.length === 0) return [];
    const days = calendarDays;
    const first = days[0].dateObj || new Date();
    const startWeekday = first.getDay();
    const padded = [];
    for (let i = 0; i < startWeekday; i++) padded.push(null);
    for (const d of days) padded.push(d);
    const wk = [];
    for (let i = 0; i < padded.length; i += 7) wk.push(padded.slice(i, i + 7));
    return wk;
  })();

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2 text-xs">
        {dayNames.map((dn, idx) => <div key={idx} className="font-semibold">{dn.slice(0,3)}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weeks.length === 0 ? (
          <div className="col-span-7 text-sm text-gray-600">No hay fechas disponibles en el rango.</div>
        ) : (
          weeks.map((week, wi) => (
            <div key={wi} className="col-span-7 grid grid-cols-7 gap-2">
              {week.map((cell, ci) => {
                if (!cell) return <div key={ci} className="h-10"></div>;
                const isToday = (cell.iso === todayIso);
                const isSelected = (cell.iso === selectedIso);
                const baseAvailableClass = cell.available ? 'bg-white hover:bg-blue-50 text-black' : 'bg-gray-200 text-gray-400 cursor-not-allowed';
                const selectedClass = isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : '';
                return (
                  <button
                    key={ci}
                    onClick={() => onSelectFecha(cell.iso, cell)}
                    disabled={!cell.available}
                    aria-pressed={isSelected}
                    className={`h-10 rounded transition-transform flex items-center justify-center ${baseAvailableClass} ${isToday ? 'ring-2 ring-blue-300' : ''} ${selectedClass}`}
                    title={cell.blocked ? "Día bloqueado" : !cell.available ? "Sin horarios" : `Horarios: ${cell.horarios.join(", ")}`}
                  >
                    <div className="text-sm">{cell.dateObj.getDate()}</div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}