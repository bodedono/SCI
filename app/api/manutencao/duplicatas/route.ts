export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSheetData, deleteMultipleRows } from '@/lib/googleSheets';
import { normalizarNomeRestaurante } from '@/utils/mappings';

const SHEET_NAME = 'Contestações iFood';
const RANGE = `'${SHEET_NAME}'!A3:O`;

// Normaliza numero do pedido (remove zeros a esquerda)
const normalizeOrderNumber = (num: string): string => {
    if (!num) return '';
    const cleaned = String(num).trim();
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? cleaned : String(parsed);
};

// Cria chave unica para identificar duplicatas
const createUniqueKey = (numeroPedido: string, restaurante: string): string => {
    const numNormalizado = normalizeOrderNumber(numeroPedido);
    const restNormalizado = normalizarNomeRestaurante(restaurante).toLowerCase().trim();
    return `${numNormalizado}|${restNormalizado}`;
};

interface DuplicataGroup {
    chave: string;
    numeroPedido: string;
    restaurante: string;
    registros: {
        id: string;
        linha: number;
        restauranteOriginal: string;
        data: string;
        valor: string;
        valorRecuperado: string;
        status: string;
    }[];
}

export async function GET() {
    try {
        // Buscar todos os dados
        const allData = await getSheetData(RANGE);
        
        // Agrupar por chave unica (numero pedido + restaurante normalizado)
        const grupos = new Map<string, DuplicataGroup>();

        allData.forEach((row: any[], index: number) => {
            const id = row[0] || '';
            const numeroPedido = String(row[2] || '');
            const restauranteOriginal = row[3] || '';
            const data = row[1] || '';
            const valor = row[6] || '';
            const valorRecuperado = row[10] || '';
            const status = row[7] || '';
            
            const chave = createUniqueKey(numeroPedido, restauranteOriginal);
            
            if (!grupos.has(chave)) {
                grupos.set(chave, {
                    chave,
                    numeroPedido: normalizeOrderNumber(numeroPedido),
                    restaurante: normalizarNomeRestaurante(restauranteOriginal),
                    registros: [],
                });
            }
            
            grupos.get(chave)!.registros.push({
                id,
                linha: index + 3, // Dados começam na linha 3
                restauranteOriginal,
                data,
                valor,
                valorRecuperado,
                status,
            });
        });

        // Filtrar apenas grupos com mais de 1 registro (duplicatas)
        const duplicatas = Array.from(grupos.values())
            .filter(g => g.registros.length > 1)
            .sort((a, b) => b.registros.length - a.registros.length);

        const totalDuplicatas = duplicatas.reduce((acc, g) => acc + g.registros.length - 1, 0);

        return NextResponse.json({
            success: true,
            totalGrupos: duplicatas.length,
            totalDuplicatas,
            duplicatas,
            message: duplicatas.length > 0 
                ? `Encontrados ${duplicatas.length} grupo(s) com ${totalDuplicatas} duplicata(s)`
                : 'Nenhuma duplicata encontrada',
        });

    } catch (error: any) {
        console.error('[duplicatas] Erro:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Erro ao analisar duplicatas',
        }, { status: 500 });
    }
}

// POST para remover duplicatas (mantém o registro mais completo)
// Aceita tanto IDs quanto números de linha diretamente
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { idsParaRemover, linhasParaRemover: linhasDiretas } = body;

        // Se foram enviadas linhas diretamente, usar essas
        if (linhasDiretas && Array.isArray(linhasDiretas) && linhasDiretas.length > 0) {
            console.log('[duplicatas] Removendo linhas diretas:', linhasDiretas);
            const result = await deleteMultipleRows(SHEET_NAME, linhasDiretas);
            return NextResponse.json({
                success: true,
                message: `${result.deletedRows} linha(s) removida(s) com sucesso`,
                removidos: result.deletedRows,
            });
        }

        // Senão, buscar pelo ID
        if (!idsParaRemover || !Array.isArray(idsParaRemover) || idsParaRemover.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Nenhum ID ou linha fornecido para remoção',
            }, { status: 400 });
        }

        // Buscar dados para encontrar as linhas
        const allData = await getSheetData(RANGE);
        const linhasParaRemover: number[] = [];

        idsParaRemover.forEach((id: string) => {
            // Pular IDs vazios
            if (!id || String(id).trim() === '') return;
            
            const index = allData.findIndex((row: any) => String(row[0]) === String(id));
            if (index !== -1) {
                linhasParaRemover.push(index + 3); // Dados começam na linha 3
            }
        });

        if (linhasParaRemover.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Nenhum registro encontrado com os IDs fornecidos',
            }, { status: 404 });
        }

        // Deletar as linhas
        const result = await deleteMultipleRows(SHEET_NAME, linhasParaRemover);

        return NextResponse.json({
            success: true,
            message: `${result.deletedRows} duplicata(s) removida(s) com sucesso`,
            removidos: result.deletedRows,
        });

    } catch (error: any) {
        console.error('[duplicatas] Erro:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Erro ao remover duplicatas',
        }, { status: 500 });
    }
}
