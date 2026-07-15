'use client';

import { useState } from 'react';

export default function BookingCalendar({ onSubmitAction }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Hours available for booking
  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get name of the current month in Spanish
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Get number of days in the month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Get day of the week the month starts on (0 = Sunday, 1 = Monday, etc.)
  // We want to align with Monday as the first day of the week
  let firstDayIndex = new Date(year, month, 1).getDay();
  firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // convert Sunday=0 to index 6, Monday=1 to index 0

  // Handle month navigation
  const prevMonth = () => {
    const prev = new Date(year, month - 1, 1);
    if (prev >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)) {
      setCurrentDate(prev);
    }
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generate days grid array
  const calendarDays = [];
  // Fill initial empty cells for first day padding
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  // Fill actual month days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(new Date(year, month, d));
  }

  const handleDaySelect = (date) => {
    if (!date) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Do not select past days
    if (date < today) return;

    // Format Date as YYYY-MM-DD
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');
    setSelectedDateStr(`${y}-${m}-${dayStr}`);
    setSelectedTime(''); // Reset hour selection when day changes
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="w-full bg-white border border-gray-200 shadow-xl rounded-3xl p-6 md:p-8 space-y-6">
      <div>
        <span className="text-secondary font-semibold text-sm uppercase tracking-wider block">Reserva de Citas</span>
        <h2 className="text-3xl font-extrabold text-black mt-1">Agenda una Llamada</h2>
        <p className="text-sm text-gray-500 mt-2 font-light">
          Selecciona primero un día disponible en el calendario, luego escoge la hora y completa tus datos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Calendar Section */}
        <div className="space-y-4">
          {/* Header controls */}
          <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 px-3 hover:bg-gray-200 text-gray-700 rounded-lg font-bold transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              disabled={year === today.getFullYear() && month === today.getMonth()}
            >
              &larr;
            </button>
            <span className="text-sm font-extrabold text-black uppercase tracking-wider">
              {monthNames[month]} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 px-3 hover:bg-gray-200 text-gray-700 rounded-lg font-bold transition-all cursor-pointer"
            >
              &rarr;
            </button>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d, index) => (
              <span key={index} className="text-[10px] font-bold text-gray-400 uppercase py-1">
                {d}
              </span>
            ))}

            {calendarDays.map((date, index) => {
              if (date === null) {
                return <div key={index} className="aspect-square"></div>;
              }

              const isPast = date < today;
              const formattedStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              const isSelected = selectedDateStr === formattedStr;
              const isToday = date.getTime() === today.getTime();

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleDaySelect(date)}
                  disabled={isPast}
                  className={`aspect-square w-full rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer
                    ${isPast ? 'text-gray-200 cursor-not-allowed' : ''}
                    ${!isPast && !isSelected ? 'text-gray-700 hover:bg-gray-100 hover:text-black' : ''}
                    ${isSelected ? 'bg-secondary text-white shadow-md shadow-secondary/20' : ''}
                    ${isToday && !isSelected ? 'border border-secondary text-secondary' : ''}
                  `}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Slots & Form Details Section */}
        <div className="space-y-6">
          {/* Hour selection */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              {selectedDateStr ? `Horas Disponibles para el ${selectedDateStr.split('-').reverse().join('/')}:` : 'Selecciona un día en el calendario:'}
            </label>
            
            {!selectedDateStr ? (
              <div className="h-32 bg-gray-50 border border-dashed border-gray-200 rounded-2xl flex items-center justify-center text-xs text-gray-400 text-center px-4">
                Elige una fecha para ver los horarios disponibles.
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map((time, index) => {
                  const isHourSelected = selectedTime === time;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedTime(time)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer border
                        ${isHourSelected 
                          ? 'bg-black border-black text-white shadow-sm' 
                          : 'bg-white border-gray-200 text-gray-700 hover:border-black hover:text-black'}
                      `}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actual Inquire Form */}
          <form action={onSubmitAction} className="space-y-4">
            {/* Hidden Date and Time Fields */}
            <input type="hidden" name="date" value={selectedDateStr} />
            <input type="hidden" name="time" value={selectedTime} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Tu Nombre</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Ej. Juan Pérez"
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="ejemplo@correo.com"
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Teléfono (Opcional)</label>
              <input
                type="text"
                name="phone"
                placeholder="+34 600 000 000"
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Mensaje / Requerimientos</label>
              <textarea
                name="message"
                rows="2"
                placeholder="Cuéntanos un poco sobre tus necesidades..."
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={!selectedDateStr || !selectedTime}
              className={`w-full font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-md cursor-pointer
                ${(!selectedDateStr || !selectedTime) 
                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed shadow-none' 
                  : 'bg-secondary hover:bg-blue-600 text-white shadow-secondary/15'}
              `}
            >
              Confirmar Reserva
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
