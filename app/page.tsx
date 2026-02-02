"use client";

import { useState, useEffect } from "react";
import { DollarSign, Calendar, BarChart2, TrendingUp, Loader2, RefreshCw } from "lucide-react";
import DashboardCharts from "@/components/DashboardCharts";
import DatePicker from "@/components/ui/DatePicker";

interface DashboardData {
    total: number;
    valorTotal: number;
    valorRecuperado: number;
    valorPerdido: number;
    recoveryRate: number;
    ticketMedio: number;
    restaurantes: { nome: string; qtd: number; valor: number; recuperado: number; marca: string }[];
    topRestaurantes: { nome: string; qtd: number; valor: number }[];
    topMotivos: { nome: string; qtd: number; valor: number }[];
}

const FILTROS_RAPIDOS = [
    { label: "7 dias", dias: 7 },
    { label: "15 dias", dias: 15 },
    { label: "30 dias", dias: 30 },
    { label: "60 dias", dias: 60 },
    { label: "Todos", dias: null },
];

export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [filtroAtivo, setFiltroAtivo] = useState<number | null>(null); // null = todos
    const [dataInicio, setDataInicio] = useState("");
    const [dataFim, setDataFim] = useState("");
    const [filtroPersonalizado, setFiltroPersonalizado] = useState(false);

    const fetchData = async (inicio?: string, fim?: string) => {
        setLoading(true);
        try {
            let url = '/api/dashboard';
            const params = new URLSearchParams();

            if (inicio) params.append('dataInicio', inicio);
            if (fim) params.append('dataFim', fim);

            if (params.toString()) {
                url += '?' + params.toString();
            }

            const res = await fetch(url);
            const json = await res.json();

            if (json.success) {
                setData(json.data);
            }
        } catch (error) {
            console.error("Erro ao carregar dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const aplicarFiltroRapido = (dias: number | null) => {
        setFiltroAtivo(dias);
        setFiltroPersonalizado(false);
        setDataInicio("");
        setDataFim("");

        if (dias === null) {
            fetchData();
        } else {
            const fim = new Date();
            const inicio = new Date();
            inicio.setDate(inicio.getDate() - dias);

            fetchData(inicio.toISOString().split('T')[0], fim.toISOString().split('T')[0]);
        }
    };

    const aplicarFiltroPersonalizado = () => {
        if (dataInicio || dataFim) {
            setFiltroAtivo(null);
            setFiltroPersonalizado(true);
            fetchData(dataInicio, dataFim);
        }
    };

    const limparFiltros = () => {
        setFiltroAtivo(null);
        setFiltroPersonalizado(false);
        setDataInicio("");
        setDataFim("");
        fetchData();
    };

    const getDescricaoFiltro = () => {
        if (filtroPersonalizado && (dataInicio || dataFim)) {
            const inicio = dataInicio ? new Date(dataInicio + 'T00:00:00').toLocaleDateString('pt-BR') : 'início';
            const fim = dataFim ? new Date(dataFim + 'T00:00:00').toLocaleDateString('pt-BR') : 'hoje';
            return `${inicio} até ${fim}`;
        }
        if (filtroAtivo) {
            return `Últimos ${filtroAtivo} dias`;
        }
        return "Todo o período";
    };

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[var(--primary)]" />
                    <p className="text-[var(--text-muted)]">Carregando dashboard...</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-8 text-[var(--status-error-text)] bg-[var(--status-error-bg)] rounded-xl">
                Erro ao carregar dados do Dashboard. Verifique a conexão com a planilha.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filtros de Período */}
            <div className="bg-[var(--bg-surface)] p-4 md:p-6 rounded-xl shadow-sm border border-[var(--border-subtle)]">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-[var(--primary)]" />
                            <h3 className="font-bold text-[var(--text-main)]">Filtro de Período</h3>
                        </div>
                        <button
                            onClick={() => fetchData(dataInicio || undefined, dataFim || undefined)}
                            className="p-2 hover:bg-[var(--bg-surface-hover)] rounded-lg transition-colors"
                            title="Atualizar dados"
                        >
                            <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* Botões de filtro rápido */}
                    <div className="flex flex-wrap gap-2">
                        {FILTROS_RAPIDOS.map((filtro) => (
                            <button
                                key={filtro.label}
                                onClick={() => aplicarFiltroRapido(filtro.dias)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    filtroAtivo === filtro.dias && !filtroPersonalizado
                                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                                        : 'bg-[var(--bg-page)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                                }`}
                            >
                                {filtro.label}
                            </button>
                        ))}
                    </div>

                    {/* Filtro personalizado */}
                    <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-[var(--border-subtle)]">
                        <DatePicker
                            label="Data Início"
                            value={dataInicio}
                            onChange={setDataInicio}
                            placeholder="Selecionar início"
                        />
                        <DatePicker
                            label="Data Fim"
                            value={dataFim}
                            onChange={setDataFim}
                            placeholder="Selecionar fim"
                        />
                        <button
                            onClick={aplicarFiltroPersonalizado}
                            disabled={!dataInicio && !dataFim}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--secondary)] text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Aplicar
                        </button>
                        {(filtroAtivo || filtroPersonalizado) && (
                            <button
                                onClick={limparFiltros}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] transition-all"
                            >
                                Limpar
                            </button>
                        )}
                    </div>

                    {/* Indicador do filtro ativo */}
                    <div className="text-sm text-[var(--text-muted)]">
                        Exibindo dados de: <span className="font-semibold text-[var(--text-main)]">{getDescricaoFiltro()}</span>
                        {data.total > 0 && <span className="ml-2">({data.total} contestações)</span>}
                    </div>
                </div>
            </div>

            {/* Top KPIs Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-[var(--primary)] text-[var(--primary-foreground)] p-4 md:p-6 rounded-xl shadow-lg relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[10px] md:text-xs uppercase font-medium opacity-80 mb-1">Total Contestado</p>
                        <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold font-serif truncate">
                            R$ {data.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </h3>
                    </div>
                    <div className="absolute right-[-10px] top-[-10px] opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign className="w-16 md:w-24 h-16 md:h-24" />
                    </div>
                </div>

                <div className="bg-[var(--bg-surface)] p-4 md:p-6 rounded-xl shadow-sm border border-l-4 border-l-[var(--status-success-text)] border-[var(--border-subtle)]">
                    <p className="text-[10px] md:text-xs uppercase font-bold text-[var(--status-success-text)] mb-1">Recuperado</p>
                    <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-[var(--status-success-text)] font-serif truncate">
                        R$ {data.valorRecuperado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h3>
                </div>

                <div className="bg-[var(--bg-surface)] p-4 md:p-6 rounded-xl shadow-sm border border-l-4 border-l-[var(--status-error-text)] border-[var(--border-subtle)]">
                    <p className="text-[10px] md:text-xs uppercase font-bold text-[var(--status-error-text)] mb-1">Perdido</p>
                    <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-[var(--status-error-text)] font-serif truncate">
                        R$ {data.valorPerdido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h3>
                </div>

                <div className="bg-[var(--bg-surface)] p-4 md:p-6 rounded-xl shadow-sm border border-l-4 border-l-[var(--primary)] border-[var(--border-subtle)]">
                    <p className="text-[10px] md:text-xs uppercase font-bold text-[var(--text-main)] mb-1">Ticket Médio</p>
                    <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-[var(--text-main)] font-serif truncate">
                        R$ {data.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h3>
                </div>
            </div>

            {/* Strategic Projections Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                <div className="bg-[var(--bg-surface)] p-4 md:p-6 rounded-xl shadow-sm border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 mb-3 md:mb-4 text-[var(--text-secondary)]">
                        <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                        <span className="text-xs md:text-sm font-bold uppercase">Perda no Período</span>
                    </div>
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-[var(--status-error-text)] font-serif truncate">
                        R$ {data.valorPerdido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="text-[10px] md:text-xs text-[var(--text-muted)] mt-1">Valor acumulado no período</p>
                </div>

                <div className="bg-[var(--bg-surface)] p-4 md:p-6 rounded-xl shadow-sm border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 mb-3 md:mb-4 text-[var(--text-secondary)]">
                        <BarChart2 className="w-4 h-4 md:w-5 md:h-5" />
                        <span className="text-xs md:text-sm font-bold uppercase">Perda Anual (Proj.)</span>
                    </div>
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-[var(--status-error-text)] font-serif truncate">
                        R$ {(data.valorPerdido * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="text-[10px] md:text-xs text-[var(--text-muted)] mt-1">Estimativa linear baseada no total</p>
                </div>

                <div className="bg-[var(--bg-surface)] p-4 md:p-6 rounded-xl shadow-sm border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 mb-3 md:mb-4 text-[var(--text-secondary)]">
                        <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                        <span className="text-xs md:text-sm font-bold uppercase">Taxa de Sucesso</span>
                    </div>
                    <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[var(--status-success-text)] font-serif">
                        {data.recoveryRate.toFixed(1)}%
                    </h3>
                    <p className="text-[10px] md:text-xs text-[var(--text-muted)] mt-1">Recuperação sobre o total contestado</p>
                </div>
            </div>

            {/* Performance por Loja */}
            <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border border-[var(--border-subtle)] overflow-hidden">
                <div className="p-4 bg-[var(--bg-page)] border-b border-[var(--border-subtle)] flex items-center gap-2">
                    <div className="p-1 bg-[var(--secondary)] rounded">
                        <DollarSign className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-bold text-[var(--text-main)]">Performance por Loja</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--bg-surface-hover)]">
                            <tr>
                                <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase">Loja</th>
                                <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase">Marca</th>
                                <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase text-right">Qtd</th>
                                <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase text-right">Valor</th>
                                <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase text-right">Recuperado</th>
                                <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase text-right">Taxa</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                            {data.restaurantes.map((loja) => {
                                const rate = loja.valor > 0 ? (loja.recuperado / loja.valor) * 100 : 0;
                                return (
                                    <tr key={loja.nome} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                                        <td className="p-4 text-sm font-bold text-[var(--text-main)]">{loja.nome}</td>
                                        <td className="p-4 text-sm text-[var(--text-secondary)]">{loja.marca}</td>
                                        <td className="p-4 text-sm text-[var(--text-secondary)] text-right">{loja.qtd}</td>
                                        <td className="p-4 text-sm text-[var(--text-secondary)] text-right">
                                            R$ {loja.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-sm text-[var(--text-secondary)] text-right">
                                            R$ {loja.recuperado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-sm font-bold text-[var(--text-main)] text-right">{rate.toFixed(1)}%</td>
                                    </tr>
                                );
                            })}
                            {data.restaurantes.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-[var(--text-muted)]">
                                        Nenhum dado encontrado para o período selecionado
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Charts */}
            <DashboardCharts topRestaurantes={data.topRestaurantes || []} topMotivos={data.topMotivos || []} />
        </div>
    );
}
