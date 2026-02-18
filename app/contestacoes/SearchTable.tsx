"use client";

import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Search, Loader2, ChevronLeft, ChevronRight, Edit2, Edit3, Trash2, Filter, X, RefreshCw, CheckSquare, Square, Trash } from "lucide-react";
import EditModal from "@/components/EditModal";
import BatchEditModal from "@/components/BatchEditModal";
import clsx from "clsx";

// Helper para parsear data DD/MM/YYYY ou DD/MM/YYYY HH:MM:SS para Date
const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
        // Remove a parte da hora se existir (ex: "07/01/2026 11:35:14" -> "07/01/2026")
        const datePart = dateStr.split(' ')[0];
        const [day, month, year] = datePart.split('/');
        const d = new Date(`${year}-${month}-${day}`);
        return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
};

export default function SearchTable() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit Modal State
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Filter States
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [restauranteFilter, setRestauranteFilter] = useState("");
    const [responsavelFilter, setResponsavelFilter] = useState("");
    const [dataInicio, setDataInicio] = useState("");
    const [dataFim, setDataFim] = useState("");
    const [showFilters, setShowFilters] = useState(false);

    // Selection State for batch delete
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);

    // Extrair opcoes unicas dos dados
    const filterOptions = useMemo(() => {
        const statusSet = new Set<string>();
        const restauranteSet = new Set<string>();
        const responsavelSet = new Set<string>();

        data.forEach(item => {
            if (item.status) statusSet.add(item.status);
            if (item.restaurante) restauranteSet.add(item.restaurante);
            if (item.responsavel) responsavelSet.add(item.responsavel);
        });

        return {
            status: Array.from(statusSet).sort(),
            restaurantes: Array.from(restauranteSet).sort(),
            responsaveis: Array.from(responsavelSet).sort(),
        };
    }, [data]);

    // Aplicar filtros
    const filteredData = useMemo(() => {
        let result = [...data];

        // Filtro de busca textual
        if (search.trim()) {
            const lower = search.toLowerCase();
            result = result.filter(item =>
                String(item.numeroPedido || "").toLowerCase().includes(lower) ||
                String(item.restaurante || "").toLowerCase().includes(lower) ||
                String(item.motivo || "").toLowerCase().includes(lower) ||
                String(item.descricao || "").toLowerCase().includes(lower)
            );
        }

        // Filtro de status
        if (statusFilter) {
            result = result.filter(item => item.status === statusFilter);
        }

        // Filtro de restaurante
        if (restauranteFilter) {
            result = result.filter(item => item.restaurante === restauranteFilter);
        }

        // Filtro de responsavel
        if (responsavelFilter) {
            result = result.filter(item => item.responsavel === responsavelFilter);
        }

        // Filtro de data inicio
        if (dataInicio) {
            const inicio = new Date(dataInicio);
            result = result.filter(item => {
                const itemDate = parseDate(item.dataAbertura);
                return itemDate && itemDate >= inicio;
            });
        }

        // Filtro de data fim
        if (dataFim) {
            const fim = new Date(dataFim);
            fim.setHours(23, 59, 59, 999); // Incluir o dia inteiro
            result = result.filter(item => {
                const itemDate = parseDate(item.dataAbertura);
                return itemDate && itemDate <= fim;
            });
        }

        return result;
    }, [data, search, statusFilter, restauranteFilter, responsavelFilter, dataInicio, dataFim]);

    // Contar filtros ativos
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (statusFilter) count++;
        if (restauranteFilter) count++;
        if (responsavelFilter) count++;
        if (dataInicio) count++;
        if (dataFim) count++;
        return count;
    }, [statusFilter, restauranteFilter, responsavelFilter, dataInicio, dataFim]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/contestacoes');
            const json = await res.json();
            if (json.success) {
                // Sort by date (newest first)
                const sorted = json.data.sort((a: any, b: any) => {
                    const dateA = parseDate(a.dataAbertura);
                    const dateB = parseDate(b.dataAbertura);
                    if (!dateA) return 1;
                    if (!dateB) return -1;
                    return dateB.getTime() - dateA.getTime();
                });
                setData(sorted);
            }
        } catch (error) {
            console.error("Failed to load", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, statusFilter, restauranteFilter, responsavelFilter, dataInicio, dataFim]);

    const handleEdit = (item: any) => {
        setSelectedItem(item);
        setIsEditOpen(true);
    };

    const handleSave = () => {
        fetchData();
    };

    const handleDelete = async (item: any) => {
        if (!confirm(`Deseja realmente excluir a contestacao #${item.id}?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/contestacoes?id=${item.id}`, {
                method: 'DELETE',
            });
            const json = await res.json();
            if (json.success) {
                alert('Contestacao excluida com sucesso!');
                fetchData();
            } else {
                alert('Erro ao excluir: ' + json.error);
            }
        } catch (error) {
            console.error("Failed to delete", error);
            alert('Erro de conexao');
        }
    };

    const clearFilters = () => {
        setSearch("");
        setStatusFilter("");
        setRestauranteFilter("");
        setResponsavelFilter("");
        setDataInicio("");
        setDataFim("");
    };

    // Selection functions
    const toggleSelectItem = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === currentData.length) {
            // Deselect all
            setSelectedIds(new Set());
        } else {
            // Select all visible items
            const allIds = new Set(currentData.map(item => String(item.id)));
            setSelectedIds(allIds);
        }
    };

    const selectAllFiltered = () => {
        // Select ALL filtered items (not just current page)
        const allFilteredIds = new Set(filteredData.map(item => String(item.id)));
        setSelectedIds(allFilteredIds);
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;

        const confirmMsg = `Deseja realmente excluir ${selectedIds.size} contestacao(es)?\n\nEsta acao nao pode ser desfeita.`;
        if (!confirm(confirmMsg)) return;

        setIsDeleting(true);
        try {
            const res = await fetch('/api/contestacoes/batch-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });
            const json = await res.json();

            if (json.success) {
                alert(`${json.deletedCount} contestacao(es) excluida(s) com sucesso!`);
                setSelectedIds(new Set());
                fetchData();
            } else {
                alert('Erro ao excluir: ' + json.error);
            }
        } catch (error) {
            console.error("Failed to batch delete", error);
            alert('Erro de conexao');
        } finally {
            setIsDeleting(false);
        }
    };

    // Pagination Logic
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentData = filteredData.slice(startIndex, startIndex + itemsPerPage);

    const formatCurrency = (val: number | string) => {
        if (typeof val === 'number') return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return val;
    };

    const formatDisplayDate = (dateStr: any) => {
        if (!dateStr) return '-';
        if (typeof dateStr === 'string') {
            if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) return dateStr.split(' ')[0];
        }
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) return date.toLocaleDateString('pt-BR');
        return String(dateStr);
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'AGUARDANDO':
                return "bg-blue-100 text-blue-700";
            case 'EM ANALISE':
                return "bg-yellow-100 text-yellow-700";
            case 'FINALIZADO':
                return "bg-green-100 text-green-700";
            case 'CANCELADO':
                return "bg-red-100 text-red-700";
            default:
                return "bg-[var(--bg-page)] text-[var(--text-muted)]";
        }
    };

    return (
        <div className="space-y-4">
            <EditModal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                data={selectedItem}
                onSave={handleSave}
            />
            <BatchEditModal
                isOpen={isBatchEditOpen}
                onClose={() => setIsBatchEditOpen(false)}
                selectedIds={Array.from(selectedIds)}
                onSave={() => { clearSelection(); fetchData(); }}
            />

            {/* Search Bar + Filter Toggle */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex gap-2">
                    <Input
                        placeholder="Buscar por pedido, restaurante, motivo..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 bg-[var(--bg-surface)]"
                    />
                    <Button onClick={fetchData} variant="outline" title="Atualizar dados">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
                <Button 
                    onClick={() => setShowFilters(!showFilters)} 
                    variant={showFilters ? "primary" : "outline"}
                    className="relative"
                >
                    <Filter className="w-4 h-4 mr-2" />
                    Filtros
                    {activeFiltersCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-[var(--status-error-text)] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                            {activeFiltersCount}
                        </span>
                    )}
                </Button>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-subtle)] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-[var(--text-main)] text-sm uppercase tracking-wide">Filtros Avancados</h3>
                        {activeFiltersCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearFilters}>
                                <X className="w-4 h-4 mr-1" />
                                Limpar filtros
                            </Button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        {/* Status */}
                        <Select
                            label="Status"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">Todos</option>
                            {filterOptions.status.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </Select>

                        {/* Restaurante */}
                        <Select
                            label="Restaurante"
                            value={restauranteFilter}
                            onChange={(e) => setRestauranteFilter(e.target.value)}
                        >
                            <option value="">Todos</option>
                            {filterOptions.restaurantes.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </Select>

                        {/* Responsavel */}
                        <Select
                            label="Responsavel"
                            value={responsavelFilter}
                            onChange={(e) => setResponsavelFilter(e.target.value)}
                        >
                            <option value="">Todos</option>
                            {filterOptions.responsaveis.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </Select>

                        {/* Data Inicio */}
                        <Input
                            label="Data Inicio"
                            type="date"
                            value={dataInicio}
                            onChange={(e) => setDataInicio(e.target.value)}
                        />

                        {/* Data Fim */}
                        <Input
                            label="Data Fim"
                            type="date"
                            value={dataFim}
                            onChange={(e) => setDataFim(e.target.value)}
                        />
                    </div>
                </div>
            )}

            {/* Selection Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="bg-[var(--secondary)] text-white p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-3">
                        <CheckSquare className="w-5 h-5" />
                        <span className="font-medium">
                            {selectedIds.size} item(ns) selecionado(s)
                        </span>
                        {selectedIds.size < filteredData.length && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={selectAllFiltered}
                                className="text-white hover:bg-white/20"
                            >
                                Selecionar todos os {filteredData.length}
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={clearSelection}
                            className="text-white hover:bg-white/20"
                        >
                            <X className="w-4 h-4 mr-1" />
                            Cancelar
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsBatchEditOpen(true)}
                            className="bg-blue-500 text-white border-blue-500 hover:bg-blue-600"
                        >
                            <Edit3 className="w-4 h-4 mr-1" />
                            Editar selecionados
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleBatchDelete}
                            disabled={isDeleting}
                            className="bg-red-500 text-white border-red-500 hover:bg-red-600"
                        >
                            {isDeleting ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                                <Trash className="w-4 h-4 mr-1" />
                            )}
                            Excluir selecionados
                        </Button>
                    </div>
                </div>
            )}

            {/* Results Summary */}
            {!loading && (
                <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
                    <span>
                        {filteredData.length} resultado(s) encontrado(s)
                        {activeFiltersCount > 0 && ` (${activeFiltersCount} filtro(s) ativo(s))`}
                    </span>
                    {filteredData.length !== data.length && (
                        <span className="text-[var(--text-secondary)]">
                            de {data.length} total
                        </span>
                    )}
                </div>
            )}

            {/* Table */}
            <div className="bg-[var(--bg-surface)] rounded-2xl shadow-sm border border-[var(--border-subtle)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[var(--bg-page)] border-b border-[var(--border-subtle)]">
                            <tr>
                                <th className="p-3 md:p-4 w-10">
                                    <button
                                        onClick={toggleSelectAll}
                                        className="p-1 hover:bg-[var(--bg-surface-hover)] rounded transition-colors"
                                        title={selectedIds.size === currentData.length ? "Desmarcar todos" : "Selecionar todos da pagina"}
                                    >
                                        {selectedIds.size > 0 && selectedIds.size === currentData.length ? (
                                            <CheckSquare className="w-4 h-4 text-[var(--secondary)]" />
                                        ) : selectedIds.size > 0 ? (
                                            <div className="w-4 h-4 border-2 border-[var(--secondary)] rounded flex items-center justify-center">
                                                <div className="w-2 h-0.5 bg-[var(--secondary)]" />
                                            </div>
                                        ) : (
                                            <Square className="w-4 h-4 text-[var(--text-muted)]" />
                                        )}
                                    </button>
                                </th>
                                <th className="p-3 md:p-4 text-[10px] md:text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Data</th>
                                <th className="p-3 md:p-4 text-[10px] md:text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Pedido</th>
                                <th className="p-3 md:p-4 text-[10px] md:text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider hidden sm:table-cell">Restaurante</th>
                                <th className="p-3 md:p-4 text-[10px] md:text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider hidden lg:table-cell">Motivo</th>
                                <th className="p-3 md:p-4 text-[10px] md:text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Valor</th>
                                <th className="p-3 md:p-4 text-[10px] md:text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider hidden md:table-cell">Recuperado</th>
                                <th className="p-3 md:p-4 text-[10px] md:text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                                <th className="p-3 md:p-4 text-[10px] md:text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider w-20">Acoes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-[var(--text-muted)]">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Carregando dados...
                                    </td>
                                </tr>
                            ) : currentData.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-[var(--text-muted)]">
                                        <div className="space-y-2">
                                            <p>Nenhum registro encontrado.</p>
                                            {activeFiltersCount > 0 && (
                                                <Button variant="outline" size="sm" onClick={clearFilters}>
                                                    Limpar filtros
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                currentData.map((item, idx) => {
                                    const isSelected = selectedIds.has(String(item.id));
                                    return (
                                        <tr 
                                            key={idx} 
                                            className={clsx(
                                                "hover:bg-[var(--bg-surface-hover)] transition-colors group",
                                                isSelected && "bg-[var(--secondary)]/10"
                                            )}
                                        >
                                            <td className="p-3 md:p-4">
                                                <button
                                                    onClick={() => toggleSelectItem(String(item.id))}
                                                    className="p-1 hover:bg-[var(--bg-surface-hover)] rounded transition-colors"
                                                >
                                                    {isSelected ? (
                                                        <CheckSquare className="w-4 h-4 text-[var(--secondary)]" />
                                                    ) : (
                                                        <Square className="w-4 h-4 text-[var(--text-muted)]" />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="p-3 md:p-4 text-xs md:text-sm text-[var(--text-secondary)]">
                                                {formatDisplayDate(item.dataAbertura)}
                                            </td>
                                            <td className="p-3 md:p-4 text-xs md:text-sm font-medium text-[var(--text-main)]">
                                                {item.numeroPedido}
                                            </td>
                                            <td className="p-3 md:p-4 text-xs md:text-sm text-[var(--text-secondary)] hidden sm:table-cell">
                                                <span className="truncate block max-w-[150px]" title={item.restaurante}>
                                                    {item.restaurante}
                                                </span>
                                            </td>
                                            <td className="p-3 md:p-4 text-xs md:text-sm text-[var(--text-secondary)] hidden lg:table-cell">
                                                <span className="truncate block max-w-[200px]" title={item.motivo}>
                                                    {item.motivo}
                                                </span>
                                            </td>
                                            <td className="p-3 md:p-4 text-xs md:text-sm font-semibold text-[var(--text-main)] font-serif">
                                                {formatCurrency(item.valor)}
                                            </td>
                                            <td className="p-3 md:p-4 text-xs md:text-sm font-semibold text-green-600 font-serif hidden md:table-cell">
                                                {item.valorRecuperado > 0 ? formatCurrency(item.valorRecuperado) : '-'}
                                            </td>
                                            <td className="p-3 md:p-4">
                                                <span className={clsx(
                                                    "px-2 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider whitespace-nowrap",
                                                    getStatusStyle(item.status)
                                                )}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="p-3 md:p-4">
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleEdit(item)}
                                                        className="p-1.5 md:p-2 text-[var(--text-muted)] hover:text-[var(--secondary)] hover:bg-[var(--bg-page)] rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item)}
                                                        className="p-1.5 md:p-2 text-[var(--text-muted)] bg-red-100 cursor-pointer hover:text-[var(--primary-foreground)] hover:bg-red-500 rounded-lg transition-colors"
                                                        title="Deletar"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {!loading && filteredData.length > 0 && (
                    <div className="p-3 md:p-4 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--bg-page)]">
                        <p className="text-xs md:text-sm text-[var(--text-muted)]">
                            Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredData.length)} de {filteredData.length}
                        </p>
                        <div className="flex gap-2 items-center">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="flex items-center px-2 text-xs md:text-sm font-medium text-[var(--text-main)]">
                                {currentPage} / {totalPages || 1}
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={currentPage === totalPages || totalPages === 0}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
