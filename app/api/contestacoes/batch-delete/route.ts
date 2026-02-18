export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSheetData, deleteMultipleRows } from '@/lib/googleSheets';

const SHEET_NAME = 'Contestações iFood';
const RANGE = `${SHEET_NAME}!A3:O`;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ 
                success: false, 
                error: 'Nenhum ID fornecido para exclusão' 
            }, { status: 400 });
        }

        console.log(`[batch-delete] Recebido pedido para deletar ${ids.length} itens:`, ids);

        // 1. Buscar todos os dados para encontrar os índices das linhas
        const allData = await getSheetData(RANGE);
        
        // 2. Encontrar os números das linhas correspondentes aos IDs
        const rowNumbers: number[] = [];
        const notFound: string[] = [];

        for (const id of ids) {
            const rowIndex = allData.findIndex((row: any) => {
                if (!row || row[0] === undefined || row[0] === null) return false;
                return String(row[0]) === String(id);
            });

            if (rowIndex === -1) {
                notFound.push(String(id));
            } else {
                // Data começa na linha 3, então linha real = 3 + índice
                const actualRow = 3 + rowIndex;
                rowNumbers.push(actualRow);
            }
        }

        if (rowNumbers.length === 0) {
            return NextResponse.json({ 
                success: false, 
                error: 'Nenhuma contestação encontrada com os IDs fornecidos',
                notFound 
            }, { status: 404 });
        }

        console.log(`[batch-delete] Linhas a deletar:`, rowNumbers);

        // 3. Deletar as linhas em batch
        const result = await deleteMultipleRows(SHEET_NAME, rowNumbers);

        return NextResponse.json({ 
            success: true, 
            message: `${result.deletedRows} contestações deletadas com sucesso`,
            deletedCount: result.deletedRows,
            notFound: notFound.length > 0 ? notFound : undefined
        });

    } catch (error: any) {
        console.error('[batch-delete] Erro:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Erro ao deletar contestações' 
        }, { status: 500 });
    }
}
