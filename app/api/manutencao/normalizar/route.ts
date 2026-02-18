export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSheetData, batchUpdateCells } from '@/lib/googleSheets';
import { normalizarNomeRestaurante } from '@/utils/mappings';

const SHEET_NAME = 'Contestações iFood';
const RANGE = `'${SHEET_NAME}'!A3:O`;

export async function GET() {
    try {
        // Buscar todos os dados
        const allData = await getSheetData(RANGE);
        
        const analise = {
            total: allData.length,
            aNormalizar: [] as { linha: number; atual: string; normalizado: string }[],
            jaCorretos: 0,
        };

        // Analisar cada linha
        allData.forEach((row: any[], index: number) => {
            const restauranteAtual = row[3] || ''; // Coluna D
            const restauranteNormalizado = normalizarNomeRestaurante(restauranteAtual);
            
            if (restauranteAtual !== restauranteNormalizado && restauranteAtual.trim() !== '') {
                analise.aNormalizar.push({
                    linha: index + 3, // Dados começam na linha 3
                    atual: restauranteAtual,
                    normalizado: restauranteNormalizado,
                });
            } else {
                analise.jaCorretos++;
            }
        });

        return NextResponse.json({
            success: true,
            analise,
            message: `${analise.aNormalizar.length} registro(s) precisam ser normalizados`,
        });

    } catch (error: any) {
        console.error('[normalizar] Erro:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Erro ao analisar dados',
        }, { status: 500 });
    }
}

export async function POST() {
    try {
        // Buscar todos os dados
        const allData = await getSheetData(RANGE);
        
        const updates: { range: string; values: any[][] }[] = [];
        const alteracoes: { linha: number; de: string; para: string }[] = [];

        // Preparar atualizações
        allData.forEach((row: any[], index: number) => {
            const restauranteAtual = row[3] || ''; // Coluna D
            const restauranteNormalizado = normalizarNomeRestaurante(restauranteAtual);
            
            if (restauranteAtual !== restauranteNormalizado && restauranteAtual.trim() !== '') {
                const linha = index + 3; // Dados começam na linha 3
                updates.push({
                    range: `'${SHEET_NAME}'!D${linha}`,
                    values: [[restauranteNormalizado]],
                });
                alteracoes.push({
                    linha,
                    de: restauranteAtual,
                    para: restauranteNormalizado,
                });
            }
        });

        if (updates.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Nenhum registro precisa ser normalizado',
                alteracoes: 0,
            });
        }

        // Executar batch update
        console.log(`[normalizar] Normalizando ${updates.length} registros...`);
        await batchUpdateCells(updates);

        return NextResponse.json({
            success: true,
            message: `${alteracoes.length} registro(s) normalizado(s) com sucesso`,
            alteracoes: alteracoes.length,
            detalhes: alteracoes,
        });

    } catch (error: any) {
        console.error('[normalizar] Erro:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Erro ao normalizar dados',
        }, { status: 500 });
    }
}
