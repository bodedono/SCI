import { NextResponse } from 'next/server';
import { getSheetData, appendMultipleRows, getLastRow, batchUpdateCells } from '@/lib/googleSheets';
import * as XLSX from 'xlsx';
import { normalizarNomeRestaurante, mapearMotivo, determinarStatusImportacao } from '@/utils/mappings';

const SHEET_NAME = 'Contestações iFood';
const RANGE = `${SHEET_NAME}!A3:O`;

interface ImportedRow {
    idPedido: string;
    numeroPedido: string;
    restaurante: string;
    dataHora: string;
    statusFinal: string;
    valorItens: number;
    totalPago: number;
    valorLiquido: number;  // Valor do reembolso real
    motivoCancelamento: string;
    origemCancelamento: string;
    dataCancelamento: string;
    valorItensCancelados: number;
    contestavel: string;
    motivoNaoContestar: string;
}

interface ImportResult {
    success: boolean;
    totalLinhas: number;
    pedidosCancelados: number;
    pedidosImportados: number;
    pedidosAtualizados: number;
    pedidosDuplicados: number;
    pedidosNaoCancelados: number;
    tempoProcessamento: number;
    detalhes: {
        importados: string[];
        atualizados: string[];
        duplicados: string[];
        naoCancelados: string[];
    };
    error?: string;
}

// Helper para formatar valor para BRL
const formatToBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Helper para formatar data
const formatDate = (dataHora: string): string => {
    if (!dataHora) return '';
    const parts = dataHora.split(' ')[0].split('/');
    if (parts.length === 3) {
        return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
    return '';
};

// Helper para normalizar numero do pedido (remove zeros a esquerda)
const normalizeOrderNumber = (num: string): string => {
    if (!num) return '';
    // Remove zeros a esquerda convertendo para numero e volta para string
    const cleaned = String(num).trim();
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? cleaned : String(parsed);
};

// Helper para criar chave unica: numero do pedido + restaurante normalizado
// Isso permite pedidos com mesmo numero em filiais diferentes
const createUniqueKey = (numeroPedido: string, restaurante: string): string => {
    const numNormalizado = normalizeOrderNumber(numeroPedido);
    const restNormalizado = (restaurante || '').toLowerCase().trim();
    return `${numNormalizado}|${restNormalizado}`;
};

export async function POST(request: Request) {
    const startTime = Date.now();
    
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ 
                success: false, 
                error: 'Nenhum arquivo enviado' 
            }, { status: 400 });
        }

        // ============================================
        // ETAPA 1: Ler arquivo Excel (muito rapido)
        // ============================================
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];

        if (rawData.length === 0) {
            return NextResponse.json({ 
                success: false, 
                error: 'Planilha vazia ou formato invalido' 
            }, { status: 400 });
        }

        // ============================================
        // ETAPA 2: Processar e validar dados em memoria
        // ============================================
        const importedRows: ImportedRow[] = rawData.map(row => ({
            idPedido: row['ID COMPLETO DO PEDIDO'] || '',
            numeroPedido: String(row['ID CURTO DO PEDIDO'] || ''),
            restaurante: row['NOME DA LOJA'] || '',
            dataHora: row['DATA E HORA DO PEDIDO'] || '',
            statusFinal: row['STATUS FINAL DO PEDIDO'] || '',
            valorItens: parseFloat(row['VALOR DOS ITENS (R$)']) || 0,
            totalPago: parseFloat(row['TOTAL PAGO PELO CLIENTE (R$)']) || 0,
            valorLiquido: parseFloat(row['VALOR LIQUIDO (R$)']) || 0,  // Valor do reembolso
            motivoCancelamento: row['MOTIVO DO CANCELAMENTO'] || '',
            origemCancelamento: row['ORIGEM DO CANCELAMENTO'] || '',
            dataCancelamento: row['DATA DO CANCELAMENTO'] || '',
            valorItensCancelados: parseFloat(row['VALOR DOS ITENS CANCELADOS']) || 0,
            contestavel: row['CANCELAMENTO É CONTESTAVEL'] || '',
            motivoNaoContestar: row['MOTIVO DA IMPOSSIBILIDADE DE CONTESTAR'] || '',
        }));

        // Filtrar apenas pedidos CANCELADOS
        const cancelados = importedRows.filter(row => 
            row.statusFinal.toUpperCase() === 'CANCELADO'
        );
        const naoCancelados = importedRows.filter(row => 
            row.statusFinal.toUpperCase() !== 'CANCELADO'
        );

        // ============================================
        // ETAPA 3: Buscar pedidos existentes (1 chamada API)
        // ============================================
        const existingData = await getSheetData(RANGE);
        // Cria Map com chave unica: numero do pedido + restaurante NORMALIZADO
        // Armazena o indice da linha e os dados atuais para poder comparar e atualizar
        const existingPedidosMap = new Map<string, { rowIndex: number; data: any[] }>();
        existingData.forEach((row: any, index: number) => {
            const numeroPedido = String(row[2] || ''); // Coluna C
            const restaurante = String(row[3] || '');   // Coluna D
            const restauranteNormalizado = normalizarNomeRestaurante(restaurante);
            const uniqueKey = createUniqueKey(numeroPedido, restauranteNormalizado);
            existingPedidosMap.set(uniqueKey, {
                rowIndex: index + 3, // Dados comecam na linha 3 da planilha
                data: row
            });
        });

        // Separar novos e existentes
        const novos: ImportedRow[] = [];
        const existentes: ImportedRow[] = [];

        for (const row of cancelados) {
            const restauranteNormalizado = normalizarNomeRestaurante(row.restaurante);
            const uniqueKey = createUniqueKey(row.numeroPedido, restauranteNormalizado);

            if (existingPedidosMap.has(uniqueKey)) {
                existentes.push(row);
            } else {
                novos.push(row);
            }
        }

        // ============================================
        // ETAPA 4: Atualizar pedidos existentes que mudaram
        // ============================================
        // Prioridade de status: AGUARDANDO(1) < EM ANALISE(2) < FINALIZADO/CANCELADO(3)
        // So atualiza para status "mais final", nunca regride
        const STATUS_PRIORIDADE: Record<string, number> = {
            'AGUARDANDO': 1,
            'EM ANALISE': 2,
            'FINALIZADO': 3,
            'CANCELADO': 3,
        };

        const atualizados: ImportedRow[] = [];
        const duplicadosSemAlteracao: ImportedRow[] = [];
        const batchUpdates: { range: string; values: any[][] }[] = [];

        for (const row of existentes) {
            const restauranteNormalizado = normalizarNomeRestaurante(row.restaurante);
            const uniqueKey = createUniqueKey(row.numeroPedido, restauranteNormalizado);
            const existing = existingPedidosMap.get(uniqueKey);
            if (!existing) continue;

            // Determinar novo status e valor a partir dos dados importados
            const novoStatus = determinarStatusImportacao(row.motivoNaoContestar, row.valorLiquido);
            const novoValorRecuperado = formatToBRL(row.valorLiquido);
            const dataFormatada = formatDate(row.dataHora);

            // Dados atuais na planilha
            const statusAtual = String(existing.data[7] || '').trim();   // Coluna H
            const valorRecuperadoAtual = String(existing.data[10] || '').trim(); // Coluna K

            const prioridadeAtual = STATUS_PRIORIDADE[statusAtual] || 0;
            const prioridadeNova = STATUS_PRIORIDADE[novoStatus] || 0;

            let shouldUpdate = false;
            let statusFinal = statusAtual;
            let dataResolucao = String(existing.data[8] || '');
            let resultado = String(existing.data[9] || '');
            let valorRecuperadoFinal = valorRecuperadoAtual;

            // Atualiza status somente se o novo for mais final que o atual
            if (prioridadeNova > prioridadeAtual) {
                statusFinal = novoStatus;
                shouldUpdate = true;

                if (novoStatus === 'FINALIZADO') {
                    dataResolucao = dataFormatada;
                    resultado = 'Reembolso automático iFood';
                } else if (novoStatus === 'CANCELADO') {
                    dataResolucao = dataFormatada;
                    resultado = row.motivoNaoContestar || 'Cancelado pela loja';
                }
            }

            // Atualiza valor recuperado se mudou e o novo valor é positivo
            if (novoValorRecuperado !== valorRecuperadoAtual && row.valorLiquido > 0) {
                valorRecuperadoFinal = novoValorRecuperado;
                shouldUpdate = true;
            }

            if (shouldUpdate) {
                const rowNum = existing.rowIndex;
                batchUpdates.push({
                    range: `'${SHEET_NAME}'!H${rowNum}:L${rowNum}`,
                    values: [[
                        statusFinal,
                        dataResolucao,
                        resultado,
                        valorRecuperadoFinal,
                        `Contestavel: ${row.contestavel}. Atualizado via importacao.`
                    ]]
                });
                atualizados.push(row);
            } else {
                duplicadosSemAlteracao.push(row);
            }
        }

        // Executar batch update dos registros alterados
        if (batchUpdates.length > 0) {
            await batchUpdateCells(batchUpdates);
            console.log(`[Importacao] Atualizados ${batchUpdates.length} registros existentes`);
        }

        // ============================================
        // ETAPA 5: Preparar novas linhas para batch insert
        // ============================================
        const importados: string[] = [];
        const allRows: any[][] = [];

        if (novos.length > 0) {
            // Obter ultimo ID
            let lastRowIndex = await getLastRow(SHEET_NAME);
            let currentId = lastRowIndex > 2 ? lastRowIndex - 2 : 1;

            for (const row of novos) {
                currentId++;

                // Mapear motivo e responsavel
                const mapeamento = mapearMotivo(row.motivoCancelamento, row.origemCancelamento);

                // Formatar data
                const dataFormatada = formatDate(row.dataHora);

                const statusInicial = determinarStatusImportacao(row.motivoNaoContestar, row.valorLiquido);
                const valorRecuperado = row.valorLiquido;

                // Define data de resolução e resultado baseado no status
                let dataResolucao = '';
                let resultado = '';

                if (statusInicial === 'FINALIZADO') {
                    dataResolucao = dataFormatada;
                    resultado = 'Reembolso automático iFood';
                } else if (statusInicial === 'CANCELADO') {
                    dataResolucao = dataFormatada;
                    resultado = row.motivoNaoContestar || 'Cancelado pela loja';
                }

                const rowValues = [
                    currentId,                                              // A: ID
                    dataFormatada,                                          // B: Data Abertura
                    row.numeroPedido,                                       // C: Numero Pedido
                    normalizarNomeRestaurante(row.restaurante),             // D: Restaurante
                    row.motivoCancelamento || 'Cancelamento',               // E: Motivo
                    `Importado automaticamente. ${row.motivoNaoContestar || ''}`.trim(), // F: Descricao
                    formatToBRL(row.valorItens),                            // G: Valor = VALOR DOS ITENS (R$)
                    statusInicial,                                          // H: Status
                    dataResolucao,                                          // I: Data Resolucao
                    resultado,                                              // J: Resultado
                    formatToBRL(valorRecuperado),                           // K: Valor Recuperado = VALOR LIQUIDO (R$)
                    `Contestavel: ${row.contestavel}`,                      // L: Observacoes
                    '',                                                     // M: Anexos
                    mapeamento.responsavel,                                 // N: Responsavel
                    mapeamento.motivoEspecifico                             // O: Motivo Especifico
                ];

                allRows.push(rowValues);
                importados.push(row.numeroPedido);
            }

            // ============================================
            // ETAPA 6: Batch insert - UMA UNICA chamada API
            // ============================================
            const insertResult = await appendMultipleRows(SHEET_NAME, allRows);
            console.log('[Importacao] Insert result:', JSON.stringify(insertResult));
        }

        const endTime = Date.now();
        const tempoProcessamento = endTime - startTime;

        const result: ImportResult = {
            success: true,
            totalLinhas: rawData.length,
            pedidosCancelados: cancelados.length,
            pedidosImportados: novos.length,
            pedidosAtualizados: atualizados.length,
            pedidosDuplicados: duplicadosSemAlteracao.length,
            pedidosNaoCancelados: naoCancelados.length,
            tempoProcessamento,
            detalhes: {
                importados: novos.map(d => `${d.numeroPedido}`),
                atualizados: atualizados.map(d => `${d.numeroPedido}`),
                duplicados: duplicadosSemAlteracao.map(d => `${d.numeroPedido}`),
                naoCancelados: naoCancelados.map(n => `${n.numeroPedido}`),
            }
        };

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Erro na importacao:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Erro ao processar arquivo' 
        }, { status: 500 });
    }
}
