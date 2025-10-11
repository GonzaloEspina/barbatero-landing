import React from "react";

export default function CalendarGrid({ calendarDays = [], loading, minDateISO, dayNames = [], onSelectFecha }) {
  if (loading) return <p>Cargando calendario...</p>;
  if (!calendarDays.length) return <div className="col-span-7 text-sm text-gray-600">No hay fechas disponibles en el rango.</div>;

  // build weeks
  const first = calendarDays[0].dateObj;
  const startWeekday = first.getUTCDay();
  const padded = [];
  for (let i = 0; i < startWeekday; i++) padded.push(null);
  for (const d of calendarDays) padded.push(d);
  const weeks = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2 text-xs">
        {dayNames.map((dn, idx) => <div key={idx} className="font-semibold">{dn.slice(0,3)}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="col-span-7 grid grid-cols-7 gap-2">
            {week.map((cell, ci) => {
              if (!cell) return <div key={ci} className="h-10"></div>;
              const isToday = new Date(cell.iso + "T00:00:00").toISOString().slice(0,10) === minDateISO;
              return (
                <button
                  key={ci}
                  onClick={() => onSelectFecha(cell.iso, cell)}
                  disabled={!cell.available}
                  className={`h-10 rounded ${cell.available ? 'bg-white hover:bg-blue-50 text-black' : 'bg-gray-200 text-gray-400 cursor-not-allowed'} ${isToday ? 'ring-2 ring-blue-300' : ''}`}
                  title={cell.blocked ? "Día bloqueado" : !cell.available ? "Sin horarios" : `Horarios: ${cell.horarios.join(", ")}`}
                >
                  <div className="text-sm">{new Date(cell.iso+"T00:00:00").getUTCDate()}</div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}