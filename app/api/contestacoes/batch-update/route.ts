export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSheetData, batchUpdateCells } from '@/lib/googleSheets';

const SHEET_NAME = 'Contestações iFood';
const RANGE = `${SHEET_NAME}!A3:O`;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { ids, updates } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Nenhum ID fornecido para atualização'
            }, { status: 400 });
        }

        if (!updates || typeof updates !== 'object') {
            return NextResponse.json({
                success: false,
                error: 'Nenhuma alteração fornecida'
            }, { status: 400 });
        }

        console.log(`[batch-update] Recebido pedido para atualizar ${ids.length} itens:`, ids);
        console.log(`[batch-update] Campos a atualizar:`, updates);

        // 1. Buscar todos os dados para encontrar as linhas
        const allData = await getSheetData(RANGE);

        // Helper para formatar moeda
        const formatToBRL = (val: string | number) => {
            if (!val && val !== 0) return 'R$ 0,00';
            const num = typeof val === 'string' ? parseFloat(val) : val;
            if (isNaN(num)) return 'R$ 0,00';
            return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        };

        // 2. Para cada ID, encontrar a linha e montar a atualização
        const batchUpdates: { range: string; values: any[][] }[] = [];
        const notFound: string[] = [];

        for (const id of ids) {
            const rowIndex = allData.findIndex((row: any) => {
                if (!row || row[0] === undefined || row[0] === null) return false;
                return String(row[0]) === String(id);
            });

            if (rowIndex === -1) {
                notFound.push(String(id));
                continue;
            }

            const actualRow = 3 + rowIndex;
            const currentRow = allData[rowIndex];

            // Colunas H-L: Status(7), DataResolucao(8), Resultado(9), ValorRecuperado(10), Observacoes(11)
            // Apenas atualiza campos que foram preenchidos pelo usuário
            const updatedValues = [
                updates.status || String(currentRow[7] || ''),
                updates.dataResolucao || String(currentRow[8] || ''),
                updates.resultado || String(currentRow[9] || ''),
                updates.valorRecuperado ? formatToBRL(updates.valorRecuperado) : String(currentRow[10] || ''),
                updates.observacoes || String(currentRow[11] || ''),
            ];

            batchUpdates.push({
                range: `'${SHEET_NAME}'!H${actualRow}:L${actualRow}`,
                values: [updatedValues],
            });
        }

        if (batchUpdates.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Nenhuma contestação encontrada com os IDs fornecidos',
                notFound
            }, { status: 404 });
        }

        // 3. Executar batch update
        await batchUpdateCells(batchUpdates);

        console.log(`[batch-update] ${batchUpdates.length} registros atualizados`);

        return NextResponse.json({
            success: true,
            message: `${batchUpdates.length} contestação(ões) atualizada(s) com sucesso`,
            updatedCount: batchUpdates.length,
            notFound: notFound.length > 0 ? notFound : undefined
        });

    } catch (error: any) {
        console.error('[batch-update] Erro:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Erro ao atualizar contestações'
        }, { status: 500 });
    }
}
