export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/googleSheets';
import { normalizarNomeRestaurante } from '@/utils/mappings';

// Helper para parsear data em vários formatos
const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;

    // Limpar a string
    const cleaned = String(dateStr).trim();

    // Formato DD/MM/YYYY ou DD/MM/YYYY HH:MM:SS
    if (cleaned.includes('/')) {
        const parts = cleaned.split(' ')[0].split('/');
        if (parts.length >= 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Mês é 0-indexed
            const year = parseInt(parts[2], 10);

            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                const date = new Date(year, month, day);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
        }
    }

    // Formato YYYY-MM-DD
    if (cleaned.includes('-')) {
        const parts = cleaned.split('T')[0].split('-');
        if (parts.length >= 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);

            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                const date = new Date(year, month, day);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
        }
    }

    // Tentar parse direto como último recurso
    const d = new Date(cleaned);
    return isNaN(d.getTime()) ? null : d;
};

// Helper to deduce brand from restaurant name
const getBrandFromName = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("burguer")) return "Burguer do Nô";
    if (n.includes("italiano") || n.includes("italianô")) return "Italianô Pizzas";
    if (n.includes("bode")) return "Bode do Nô";
    return null;
};

// Função para calcular métricas de um conjunto de dados
const calcularMetricas = (contestacoes: any[]) => {
    const total = contestacoes.length;
    const valorTotal = contestacoes.reduce((acc, curr) => acc + curr.valor, 0);
    const valorRecuperado = contestacoes.reduce((acc, curr) => acc + curr.valorRecuperado, 0);
    const valorPerdido = valorTotal - valorRecuperado;
    const recoveryRate = valorTotal > 0 ? (valorRecuperado / valorTotal) * 100 : 0;
    const ticketMedio = total > 0 ? valorTotal / total : 0;

    return { total, valorTotal, valorRecuperado, valorPerdido, recoveryRate, ticketMedio };
};

// Função para calcular variação percentual
const calcularVariacao = (atual: number, anterior: number): number | null => {
    if (anterior === 0) {
        return atual > 0 ? 100 : null;
    }
    return ((atual - anterior) / anterior) * 100;
};

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const dataInicio = searchParams.get('dataInicio');
        const dataFim = searchParams.get('dataFim');

        const rawData = await getSheetData('Contestações iFood!A3:O');

        // Process data for dashboard
        const todasContestacoes = rawData.map((row) => ({
            dataAbertura: row[1],
            dataParsed: parseDate(row[1]),
            valor: parseFloat(String(row[6] || '0').replace('R$', '').trim().replace(/\./g, '').replace(',', '.') || '0'),
            valorRecuperado: parseFloat(String(row[10] || '0').replace('R$', '').trim().replace(/\./g, '').replace(',', '.') || '0'),
            status: row[7] || 'AGUARDANDO',
            motivo: row[4] || '',
            restaurante: normalizarNomeRestaurante(row[3] || ''),
        })).filter(c => c.dataParsed !== null); // Filtrar apenas registros com data válida

        let inicioAtual: Date | null = null;
        let fimAtual: Date | null = null;
        let inicioPeriodoAnterior: Date | null = null;
        let fimPeriodoAnterior: Date | null = null;

        // Definir período atual
        if (dataInicio) {
            inicioAtual = new Date(dataInicio);
            inicioAtual.setHours(0, 0, 0, 0);
        }
        if (dataFim) {
            fimAtual = new Date(dataFim);
            fimAtual.setHours(23, 59, 59, 999);
        }

        // Se não tem filtro, usar últimos 30 dias como padrão para comparação
        const semFiltro = !dataInicio && !dataFim;
        if (semFiltro) {
            fimAtual = new Date();
            fimAtual.setHours(23, 59, 59, 999);
            inicioAtual = new Date();
            inicioAtual.setDate(inicioAtual.getDate() - 30);
            inicioAtual.setHours(0, 0, 0, 0);
        }

        // Calcular período anterior (mesmo tamanho do período atual)
        if (inicioAtual && fimAtual) {
            const diffDias = Math.ceil((fimAtual.getTime() - inicioAtual.getTime()) / (1000 * 60 * 60 * 24));
            fimPeriodoAnterior = new Date(inicioAtual);
            fimPeriodoAnterior.setDate(fimPeriodoAnterior.getDate() - 1);
            fimPeriodoAnterior.setHours(23, 59, 59, 999);
            inicioPeriodoAnterior = new Date(fimPeriodoAnterior);
            inicioPeriodoAnterior.setDate(inicioPeriodoAnterior.getDate() - diffDias + 1);
            inicioPeriodoAnterior.setHours(0, 0, 0, 0);
        } else if (inicioAtual && !fimAtual) {
            // Se só tem data início, período anterior é do mesmo tamanho antes
            const hoje = new Date();
            hoje.setHours(23, 59, 59, 999);
            const diffDias = Math.ceil((hoje.getTime() - inicioAtual.getTime()) / (1000 * 60 * 60 * 24));
            fimPeriodoAnterior = new Date(inicioAtual);
            fimPeriodoAnterior.setDate(fimPeriodoAnterior.getDate() - 1);
            fimPeriodoAnterior.setHours(23, 59, 59, 999);
            inicioPeriodoAnterior = new Date(fimPeriodoAnterior);
            inicioPeriodoAnterior.setDate(inicioPeriodoAnterior.getDate() - diffDias + 1);
            inicioPeriodoAnterior.setHours(0, 0, 0, 0);
        }

        // Filtrar dados do período atual
        let contestacoesAtuais = todasContestacoes;

        // Se tem filtro aplicado, filtrar os dados
        if (!semFiltro) {
            if (inicioAtual) {
                contestacoesAtuais = contestacoesAtuais.filter(c => c.dataParsed && c.dataParsed >= inicioAtual!);
            }
            if (fimAtual) {
                contestacoesAtuais = contestacoesAtuais.filter(c => c.dataParsed && c.dataParsed <= fimAtual!);
            }
        }
        // Se não tem filtro, mostra todos os dados mas calcula variação dos últimos 30 dias

        // Para cálculo de variação, usar dados dos últimos 30 dias quando sem filtro
        let contestacoesParaVariacao = contestacoesAtuais;
        if (semFiltro && inicioAtual && fimAtual) {
            contestacoesParaVariacao = todasContestacoes.filter(c =>
                c.dataParsed && c.dataParsed >= inicioAtual! && c.dataParsed <= fimAtual!
            );
        }

        // Filtrar dados do período anterior
        let contestacoesAnteriores: typeof todasContestacoes = [];
        if (inicioPeriodoAnterior && fimPeriodoAnterior) {
            contestacoesAnteriores = todasContestacoes.filter(c =>
                c.dataParsed && c.dataParsed >= inicioPeriodoAnterior! && c.dataParsed <= fimPeriodoAnterior!
            );
        }

        // Calcular métricas
        const metricasAtuais = calcularMetricas(contestacoesAtuais);
        const metricasParaVariacao = calcularMetricas(contestacoesParaVariacao);
        const metricasAnteriores = calcularMetricas(contestacoesAnteriores);

        // Calcular variações percentuais (usando métricas do período de comparação)
        const variacoes = {
            total: calcularVariacao(metricasParaVariacao.total, metricasAnteriores.total),
            valorTotal: calcularVariacao(metricasParaVariacao.valorTotal, metricasAnteriores.valorTotal),
            valorRecuperado: calcularVariacao(metricasParaVariacao.valorRecuperado, metricasAnteriores.valorRecuperado),
            valorPerdido: calcularVariacao(metricasParaVariacao.valorPerdido, metricasAnteriores.valorPerdido),
            ticketMedio: calcularVariacao(metricasParaVariacao.ticketMedio, metricasAnteriores.ticketMedio),
        };

        // Performance por Restaurante (cada loja individualmente)
        const restaurantesMap: Record<string, { qtd: number, valor: number, recuperado: number, marca: string }> = {};
        const motivos: Record<string, { qtd: number, valor: number }> = {};

        contestacoesAtuais.forEach(c => {
            if (c.restaurante && c.restaurante.trim() !== '') {
                const marca = getBrandFromName(c.restaurante);

                if (marca) {
                    if (!restaurantesMap[c.restaurante]) {
                        restaurantesMap[c.restaurante] = { qtd: 0, valor: 0, recuperado: 0, marca };
                    }
                    restaurantesMap[c.restaurante].qtd++;
                    restaurantesMap[c.restaurante].valor += c.valor;
                    restaurantesMap[c.restaurante].recuperado += c.valorRecuperado;
                }
            }

            const motivoNormalizado = c.motivo?.trim();
            if (motivoNormalizado && motivoNormalizado.toLowerCase() !== 'outros' && motivoNormalizado !== '') {
                if (!motivos[motivoNormalizado]) motivos[motivoNormalizado] = { qtd: 0, valor: 0 };
                motivos[motivoNormalizado].qtd++;
                motivos[motivoNormalizado].valor += c.valor;
            }
        });

        const restaurantes = Object.entries(restaurantesMap)
            .map(([nome, data]) => ({ nome, ...data }))
            .sort((a, b) => {
                if (a.marca !== b.marca) return a.marca.localeCompare(b.marca);
                return a.nome.localeCompare(b.nome);
            });

        const topRestaurantes = Object.entries(restaurantesMap)
            .map(([nome, data]) => ({ nome, qtd: data.qtd, valor: data.valor }))
            .sort((a, b) => b.qtd - a.qtd)
            .slice(0, 5);

        const topMotivos = Object.entries(motivos)
            .map(([nome, data]) => ({ nome, ...data }))
            .sort((a, b) => b.qtd - a.qtd)
            .slice(0, 5);

        return NextResponse.json({
            success: true,
            data: {
                ...metricasAtuais,
                variacoes,
                periodoAnterior: inicioPeriodoAnterior && fimPeriodoAnterior ? {
                    inicio: inicioPeriodoAnterior.toISOString(),
                    fim: fimPeriodoAnterior.toISOString(),
                    ...metricasAnteriores
                } : null,
                restaurantes,
                topRestaurantes,
                topMotivos,
                debug: {
                    totalRegistros: rawData.length,
                    registrosComDataValida: todasContestacoes.length,
                    registrosFiltrados: contestacoesAtuais.length
                }
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
