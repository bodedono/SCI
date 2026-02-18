export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSheetData, deleteMultipleRows } from '@/lib/googleSheets';

const SHEET_NAME = 'Contestações iFood';
const RANGE = `'${SHEET_NAME}'!A3:O`;

// Verifica se uma linha está vazia (sem ID ou sem dados importantes)
const isLinhaVazia = (row: any[]): boolean => {
    if (!row || row.length === 0) return true;
    
    const id = row[0];
    const numeroPedido = row[2];
    const restaurante = row[3];
    
    // Linha vazia se não tem ID E não tem número do pedido E não tem restaurante
    const semId = !id || String(id).trim() === '';
    const semPedido = !numeroPedido || String(numeroPedido).trim() === '';
    const semRestaurante = !restaurante || String(restaurante).trim() === '';
    
    return semId && semPedido && semRestaurante;
};

export async function GET() {
    try {
        const allData = await getSheetData(RANGE);
        
        const linhasVazias: { linha: number; conteudo: string }[] = [];
        
        allData.forEach((row: any[], index: number) => {
            if (isLinhaVazia(row)) {
                linhasVazias.push({
                    linha: index + 3, // Dados começam na linha 3
                    conteudo: row ? row.join(' | ').substring(0, 100) : '(vazio)',
                });
            }
        });

        return NextResponse.json({
            success: true,
            totalLinhas: allData.length,
            linhasVazias: linhasVazias.length,
            detalhes: linhasVazias,
            message: linhasVazias.length > 0 
                ? `Encontradas ${linhasVazias.length} linha(s) vazia(s)`
                : 'Nenhuma linha vazia encontrada',
        });

    } catch (error: any) {
        console.error('[linhas-vazias] Erro:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Erro ao analisar linhas vazias',
        }, { status: 500 });
    }
}

export async function POST() {
    try {
        const allData = await getSheetData(RANGE);
        
        const linhasParaRemover: number[] = [];
        
        allData.forEach((row: any[], index: number) => {
            if (isLinhaVazia(row)) {
                linhasParaRemover.push(index + 3); // Dados começam na linha 3
            }
        });

        if (linhasParaRemover.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Nenhuma linha vazia para remover',
                removidas: 0,
            });
        }

        console.log(`[linhas-vazias] Removendo ${linhasParaRemover.length} linhas:`, linhasParaRemover);

        const result = await deleteMultipleRows(SHEET_NAME, linhasParaRemover);

        return NextResponse.json({
            success: true,
            message: `${result.deletedRows} linha(s) vazia(s) removida(s) com sucesso`,
            removidas: result.deletedRows,
        });

    } catch (error: any) {
        console.error('[linhas-vazias] Erro:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Erro ao remover linhas vazias',
        }, { status: 500 });
    }
}
