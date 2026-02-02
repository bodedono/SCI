"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DatePickerProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export default function DatePicker({ label, value, onChange, placeholder = "Selecionar data" }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(value ? new Date(value + 'T00:00:00') : new Date());
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedDate = value ? new Date(value + 'T00:00:00') : null;

    // Fechar ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Preencher dias vazios no início
    const startDayOfWeek = monthStart.getDay();
    const emptyDays = Array(startDayOfWeek).fill(null);

    const handleSelectDate = (day: Date) => {
        const formatted = format(day, "yyyy-MM-dd");
        onChange(formatted);
        setIsOpen(false);
    };

    const handlePrevMonth = () => {
        setCurrentMonth(subMonths(currentMonth, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(addMonths(currentMonth, 1));
    };

    const handleClear = () => {
        onChange("");
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            {label && (
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    {label}
                </label>
            )}

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-[var(--text-main)] text-sm w-full min-w-[160px] hover:border-[var(--primary)] transition-colors"
            >
                <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
                <span className={selectedDate ? "text-[var(--text-main)]" : "text-[var(--text-muted)]"}>
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy") : placeholder}
                </span>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-lg min-w-[280px]">
                    {/* Header do calendário */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="p-1 hover:bg-[var(--bg-surface-hover)] rounded-lg transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
                        </button>
                        <span className="font-semibold text-[var(--text-main)] capitalize">
                            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                        </span>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="p-1 hover:bg-[var(--bg-surface-hover)] rounded-lg transition-colors"
                        >
                            <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
                        </button>
                    </div>

                    {/* Dias da semana */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {daysOfWeek.map((day) => (
                            <div
                                key={day}
                                className="text-center text-xs font-medium text-[var(--text-muted)] py-1"
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Dias do mês */}
                    <div className="grid grid-cols-7 gap-1">
                        {emptyDays.map((_, index) => (
                            <div key={`empty-${index}`} className="h-8" />
                        ))}
                        {daysInMonth.map((day) => {
                            const isSelected = selectedDate && isSameDay(day, selectedDate);
                            const isTodayDate = isToday(day);

                            return (
                                <button
                                    key={day.toISOString()}
                                    type="button"
                                    onClick={() => handleSelectDate(day)}
                                    className={`
                                        h-8 w-8 rounded-lg text-sm font-medium transition-all
                                        flex items-center justify-center mx-auto
                                        ${isSelected
                                            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                                            : isTodayDate
                                                ? "bg-[var(--secondary)] text-white"
                                                : "text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"
                                        }
                                    `}
                                >
                                    {format(day, "d")}
                                </button>
                            );
                        })}
                    </div>

                    {/* Ações */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border-subtle)]">
                        <button
                            type="button"
                            onClick={() => {
                                setCurrentMonth(new Date());
                                handleSelectDate(new Date());
                            }}
                            className="text-xs text-[var(--secondary)] hover:underline"
                        >
                            Hoje
                        </button>
                        {selectedDate && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="text-xs text-[var(--text-muted)] hover:text-[var(--status-error-text)]"
                            >
                                Limpar
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
