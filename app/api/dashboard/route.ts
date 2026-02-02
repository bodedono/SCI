import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/googleSheets';
import { normalizarNomeRestaurante } from '@/utils/mappings';

// Helper para parsear data DD/MM/YYYY para Date
const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        return new Date(`${year}-${month}-${day}`);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
};

// Helper to deduce brand from restaurant name
const getBrandFromName = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("burguer")) return "Burguer do Nô";
    if (n.includes("italiano") || n.includes("italianô")) return "Italianô Pizzas";
    if (n.includes("bode")) return "Bode do Nô";
    return null; // Retorna null em vez de "Outros"
};

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const dataInicio = searchParams.get('dataInicio');
        const dataFim = searchParams.get('dataFim');

        const rawData = await getSheetData('Contestações iFood!A3:O');

        // Process data for dashboard
        let contestacoes = rawData.map((row) => ({
            dataAbertura: row[1],
            valor: parseFloat(row[6]?.replace('R$', '').trim().replace(',', '.') || '0'),
            valorRecuperado: parseFloat(row[10]?.replace('R$', '').trim().replace(',', '.') || '0'),
            status: row[7] || 'AGUARDANDO',
            motivo: row[4] || '',
            restaurante: normalizarNomeRestaurante(row[3] || ''),
        }));

        // Aplicar filtro de data se fornecido
        if (dataInicio) {
            const inicio = new Date(dataInicio);
            inicio.setHours(0, 0, 0, 0);
            contestacoes = contestacoes.filter(c => {
                const itemDate = parseDate(c.dataAbertura);
                return itemDate && itemDate >= inicio;
            });
        }

        if (dataFim) {
            const fim = new Date(dataFim);
            fim.setHours(23, 59, 59, 999);
            contestacoes = contestacoes.filter(c => {
                const itemDate = parseDate(c.dataAbertura);
                return itemDate && itemDate <= fim;
            });
        }

        const total = contestacoes.length;
        const valorTotal = contestacoes.reduce((acc, curr) => acc + curr.valor, 0);
        const valorRecuperado = contestacoes.reduce((acc, curr) => acc + curr.valorRecuperado, 0);
        const valorPerdido = valorTotal - valorRecuperado;
        const recoveryRate = valorTotal > 0 ? (valorRecuperado / valorTotal) * 100 : 0;
        const ticketMedio = total > 0 ? valorTotal / total : 0;

        // Performance por Restaurante (cada loja individualmente)
        const restaurantesMap: Record<string, { qtd: number, valor: number, recuperado: number, marca: string }> = {};
        const motivos: Record<string, { qtd: number, valor: number }> = {};

        contestacoes.forEach(c => {
            // Só processa se tiver nome de restaurante válido
            if (c.restaurante && c.restaurante.trim() !== '') {
                const marca = getBrandFromName(c.restaurante);

                // Só adiciona se pertencer a uma das 3 marcas conhecidas
                if (marca) {
                    if (!restaurantesMap[c.restaurante]) {
                        restaurantesMap[c.restaurante] = { qtd: 0, valor: 0, recuperado: 0, marca };
                    }
                    restaurantesMap[c.restaurante].qtd++;
                    restaurantesMap[c.restaurante].valor += c.valor;
                    restaurantesMap[c.restaurante].recuperado += c.valorRecuperado;
                }
            }

            // Motivos - não incluir vazios ou "Outros"
            const motivoNormalizado = c.motivo?.trim();
            if (motivoNormalizado && motivoNormalizado.toLowerCase() !== 'outros' && motivoNormalizado !== '') {
                if (!motivos[motivoNormalizado]) motivos[motivoNormalizado] = { qtd: 0, valor: 0 };
                motivos[motivoNormalizado].qtd++;
                motivos[motivoNormalizado].valor += c.valor;
            }
        });

        // Converter para array e ordenar por marca e nome
        const restaurantes = Object.entries(restaurantesMap)
            .map(([nome, data]) => ({ nome, ...data }))
            .sort((a, b) => {
                // Primeiro ordena por marca
                if (a.marca !== b.marca) return a.marca.localeCompare(b.marca);
                // Depois por nome
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
                total,
                valorTotal,
                valorRecuperado,
                valorPerdido,
                recoveryRate,
                ticketMedio,
                restaurantes, // Lista de todas as lojas
                topRestaurantes,
                topMotivos
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
