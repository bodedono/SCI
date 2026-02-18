export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSheetData, appendRow, getLastRow, updateRow, deleteRow } from '@/lib/googleSheets';

const SHEET_NAME = 'Contestações iFood';
const RANGE = `'${SHEET_NAME}'!A3:O`; // Reading from row 3 downwards (skipping headers)

// Helper to parse currency strings like "R$ 1.500,00" or simple numbers
const parseCurrency = (val: string) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    // Remove R$, spaces, dots (thousand separator), then replace comma with dot
    const clean = val.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
};

export async function GET() {
    try {
        const rawData = await getSheetData(RANGE);

        // Process data - incluir o índice da linha para referência
        const contestacoes = rawData.map((row, index) => {
            return {
                id: row[0],
                rowIndex: index, // Índice no array (linha real = 3 + index)
                dataAbertura: row[1],
                numeroPedido: row[2],
                restaurante: row[3],
                motivo: row[4],
                descricao: row[5],
                valor: parseCurrency(row[6]),
                status: row[7],
                dataResolucao: row[8],
                resultado: row[9],
                valorRecuperado: parseCurrency(row[10]),
                observacoes: row[11],
                anexos: row[12],
                responsavel: row[13],
                motivoEspecifico: row[14],
            };
        });

        return NextResponse.json({ success: true, data: contestacoes });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            dataAbertura, numeroPedido, restaurante, motivo, descricao, valor,
            status, responsavel, motivoEspecifico, observacoes, valorRecuperado
        } = body;

        const lastRowIndex = await getLastRow(SHEET_NAME);
        // Simple ID: Use the row number as an ID approximation for now
        const generatedId = lastRowIndex > 0 ? lastRowIndex - 1 : 1;

        // Helper to format currency for Sheets
        const formatToBRL = (val: string | number) => {
            if (!val) return 'R$ 0,00';
            const num = typeof val === 'string' ? parseFloat(val) : val;
            if (isNaN(num)) return 'R$ 0,00';
            return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        };

        const values = [
            generatedId,
            dataAbertura,
            numeroPedido,
            restaurante,
            motivo,
            descricao,
            formatToBRL(valor), // Format to R$ XX,XX
            status || 'AGUARDANDO',
            '', // Data Resolução
            '', // Resultado
            formatToBRL(valorRecuperado || 0),  // Valor Recuperado formatado
            observacoes || '',
            '', // Anexos
            responsavel,
            motivoEspecifico
        ];

        await appendRow(RANGE, values);

        return NextResponse.json({ success: true, message: 'Contestação criada com sucesso' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, rowIndex: clientRowIndex, status, dataResolucao, resultado, valorRecuperado, observacoes } = body;

        console.log('[PUT] Recebido:', { id, clientRowIndex, status, dataResolucao, resultado, valorRecuperado, observacoes });

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID não fornecido' }, { status: 400 });
        }

        // Se o cliente enviou o rowIndex, usar diretamente
        // Senão, buscar na planilha
        let actualRow: number;

        if (clientRowIndex !== undefined && clientRowIndex !== null) {
            // Cliente enviou o índice - linha real = 3 + índice
            actualRow = 3 + clientRowIndex;
            console.log('[PUT] Usando rowIndex do cliente:', clientRowIndex, '-> linha', actualRow);
        } else {
            // Buscar na planilha pelo ID
            const allData = await getSheetData(RANGE);
            console.log('[PUT] Total de linhas na planilha:', allData.length);
            
            const rowIndex = allData.findIndex((row: any) => {
                if (!row || row[0] === undefined || row[0] === null) return false;
                return String(row[0]) === String(id);
            });

            console.log('[PUT] rowIndex encontrado:', rowIndex);

            if (rowIndex === -1) {
                console.log('[PUT] ID não encontrado. Primeiros IDs:', allData.slice(0, 10).map((r: any) => r[0]));
                return NextResponse.json({ success: false, error: 'Contestação não encontrada' }, { status: 404 });
            }

            actualRow = 3 + rowIndex;
        }

        console.log('[PUT] Linha real na planilha:', actualRow);

        // Helper to format currency for Sheets
        const formatToBRL = (val: string | number) => {
            if (!val) return 'R$ 0,00';
            const num = typeof val === 'string' ? parseFloat(val) : val;
            if (isNaN(num)) return 'R$ 0,00';
            return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        };

        // Valores a atualizar: Status(H), DataResolução(I), Resultado(J), ValorRecuperado(K), Observações(L)
        const updateValues = [
            status,
            dataResolucao,
            resultado,
            formatToBRL(valorRecuperado),
            observacoes
        ];

        const updateRange = `'${SHEET_NAME}'!H${actualRow}:L${actualRow}`;
        console.log('[PUT] Range de atualização:', updateRange);
        console.log('[PUT] Valores a atualizar:', updateValues);

        const result = await updateRow(updateRange, updateValues);
        console.log('[PUT] Resultado da atualização:', result);

        return NextResponse.json({ success: true, message: 'Contestação atualizada' });

    } catch (error: any) {
        console.error('[PUT] Erro:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        // Extract ID from URL search params
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID não fornecido' }, { status: 400 });
        }

        // 1. Find the row index by ID
        const allData = await getSheetData(RANGE);
        const rowIndex = allData.findIndex((row: any) => row[0]?.toString() === id.toString());

        if (rowIndex === -1) {
            return NextResponse.json({ success: false, error: 'Contestação não encontrada' }, { status: 404 });
        }

        // 2. Calculate actual row number (data starts at row 3)
        const actualRow = 3 + rowIndex;

        // 3. Delete the entire row range
        const deleteRange = `${SHEET_NAME}!A${actualRow}:O${actualRow}`;

        await deleteRow(deleteRange);

        return NextResponse.json({ success: true, message: 'Contestação deletada com sucesso' });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
