'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Clock, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { addHours } from '@/lib/time-util';

export type EventDateTimePickerProps = {
  open?: boolean;
  onClose: () => void;
  startTime: Date;
  endTime: Date;
  onApply: (start: Date, end: Date) => void;
  inline?: boolean;
};

export function EventDateTimePickerSurface({
  onClose,
  startTime,
  endTime,
  onApply,
  inline = false,
}: EventDateTimePickerProps) {
  const [step, setStep] = useState<'date' | 'time'>('date');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date(startTime));
  const [viewMonth, setViewMonth] = useState<Date>(() => new Date(startTime));
  
  const toTimeString = (d: Date) => {
    const pad = (n: number) => (n < 10 ? '0' : '') + n;
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [startStr, setStartStr] = useState(() => toTimeString(startTime));
  const [endStr, setEndStr] = useState(() => toTimeString(endTime));

  useEffect(() => {
    const s = startTime ? new Date(startTime) : new Date();
    const e = endTime ? new Date(endTime) : new Date(Date.now() + 3600000);
    setSelectedDate(s);
    setViewMonth(s);
    setStartStr(toTimeString(s));
    setEndStr(toTimeString(e));
    setStep('date');
  }, []);

  const daysInMonth = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const count = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { year, month, count, firstDay };
  }, [viewMonth]);

  const handlePrevMonth = () => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelectDay = (dayNum: number) => {
    const next = new Date(daysInMonth.year, daysInMonth.month, dayNum);
    setSelectedDate(next);
  };

  const handleSave = () => {
    const [sH, sM] = startStr.split(':').map(Number);
    const [eH, eM] = endStr.split(':').map(Number);

    const newStart = new Date(selectedDate);
    newStart.setHours(sH || 0, sM || 0, 0, 0);

    const newEnd = new Date(selectedDate);
    newEnd.setHours(eH || 0, eM || 0, 0, 0);

    if (newEnd <= newStart) {
      const fixedEnd = addHours(newStart, 1);
      onApply(newStart, fixedEnd);
    } else {
      onApply(newStart, newEnd);
    }
  };

  const monthName = viewMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const daysArray = Array.from({ length: daysInMonth.count }, (_, i) => i + 1);
  const blanksArray = Array.from({ length: daysInMonth.firstDay }, (_, i) => i);

  return (
    <div className={inline ? "w-full h-full min-h-0 flex flex-col bg-[#161412] p-4 text-white overflow-y-auto overscroll-contain scrollbar-thin flex-1 gap-4" : "flex flex-col gap-5 text-white"}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            {step === 'date' ? <Calendar className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-extrabold text-base font-clash tracking-tight text-white">
              {step === 'date' ? 'Select Date' : 'Set Event Hours'}
            </h3>
            <p className="text-xs text-[#8E8A86] font-mono">
              {step === 'date' ? 'Step 1 of 2: Pick date' : 'Step 2 of 2: Set hours'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

        {/* Body */}
        {step === 'date' ? (
          <div className="flex flex-col gap-4">
            {/* Month Navigator */}
            <div className="flex items-center justify-between px-2">
              <span className="font-black text-sm font-clash text-white tracking-wide">{monthName}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 text-center text-[10px] font-mono font-bold uppercase tracking-wider text-white/40">
              <span>Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {blanksArray.map((b) => (
                <div key={`blank-${b}`} className="h-9" />
              ))}
              {daysArray.map((d) => {
                const isSelected =
                  selectedDate.getDate() === d &&
                  selectedDate.getMonth() === daysInMonth.month &&
                  selectedDate.getFullYear() === daysInMonth.year;
                const isToday =
                  new Date().getDate() === d &&
                  new Date().getMonth() === daysInMonth.month &&
                  new Date().getFullYear() === daysInMonth.year;

                return (
                  <button
                    key={`day-${d}`}
                    type="button"
                    onClick={() => handleSelectDay(d)}
                    className={`h-9 w-full rounded-xl text-xs font-bold font-satoshi flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#6366F1] text-white shadow-[0_4px_12px_rgba(99,102,241,0.35)] scale-105'
                        : isToday
                          ? 'border border-[#6366F1]/50 text-[#818CF8] bg-indigo-500/10'
                          : 'hover:bg-white/10 text-white/80 hover:text-white'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            {/* Next Step & Quick Apply Buttons */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                onClick={handleSave}
                className="py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-black font-extrabold text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.25)]"
              >
                <Check className="w-4 h-4" strokeWidth={3} />
                <span>Apply Date</span>
              </button>

              <button
                type="button"
                onClick={() => setStep('time')}
                className="py-3 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white font-extrabold text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_4px_12px_rgba(99,102,241,0.25)]"
              >
                <span>Set Time</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="p-3 rounded-xl bg-[#0A0908] border border-white/5 text-xs text-white/60 font-mono flex items-center justify-between">
              <span>Date:</span>
              <span className="font-bold text-white">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white/40">
                Start Time
                <input
                  type="time"
                  value={startStr}
                  onChange={(e) => setStartStr(e.target.value)}
                  className="rounded-xl border border-white/10 bg-black/60 px-3 py-2.5 text-white text-sm font-bold font-satoshi focus:border-[#6366F1] focus:outline-none transition-all cursor-pointer"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white/40">
                End Time
                <input
                  type="time"
                  value={endStr}
                  onChange={(e) => setEndStr(e.target.value)}
                  className="rounded-xl border border-white/10 bg-black/60 px-3 py-2.5 text-white text-sm font-bold font-satoshi focus:border-[#6366F1] focus:outline-none transition-all cursor-pointer"
                />
              </label>
            </div>

            {/* Quick Ecosystem Time Slot Pills */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Quick Time Slots</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '09:00 AM', start: '09:00', end: '10:00' },
                  { label: '11:00 AM', start: '11:00', end: '12:00' },
                  { label: '02:00 PM', start: '14:00', end: '15:00' },
                  { label: '04:00 PM', start: '16:00', end: '17:00' },
                  { label: '06:00 PM', start: '18:00', end: '19:00' },
                  { label: '08:00 PM', start: '20:00', end: '21:00' },
                ].map((slot) => {
                  const isActive = startStr === slot.start && endStr === slot.end;
                  return (
                    <button
                      key={slot.label}
                      type="button"
                      onClick={() => {
                        setStartStr(slot.start);
                        setEndStr(slot.end);
                      }}
                      className={`py-2 px-2.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-[#6366F1] text-white border-[#6366F1] shadow-[0_2px_8px_rgba(99,102,241,0.3)] scale-105'
                          : 'bg-black/40 text-white/70 border-white/10 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('date')}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-extrabold text-xs font-mono uppercase tracking-wider hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-black font-extrabold text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.25)]"
              >
                <Check className="w-4 h-4" strokeWidth={3} />
                <span>Apply Schedule</span>
              </button>
            </div>
          </div>
        )}
    </div>
  );
}

export function EventDateTimePickerDrawer(props: EventDateTimePickerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!props.open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[15000] flex flex-col justify-end pointer-events-auto">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-200"
        onClick={props.onClose}
      />
      <div className="relative w-full max-w-[540px] mx-auto bg-[#161412] border border-[#34322F] border-b-0 rounded-t-[28px] p-6 shadow-2xl z-[15001] flex flex-col gap-5 text-white overflow-hidden animate-in slide-in-from-bottom duration-250">
        <EventDateTimePickerSurface {...props} />
      </div>
    </div>,
    document.body
  );
}
