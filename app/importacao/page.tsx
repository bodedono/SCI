"use client";

import { FileUp, CheckCircle, Upload, AlertTriangle, XCircle, FileSpreadsheet, RefreshCw, ArrowUpCircle } from "lucide-react";
import { useState } from "react";
import FileDropzone from "@/components/FileDropzone";
import { Button } from "@/components/ui/Button";

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

export default function ImportacaoPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleUpload = async () => {
        if (!file) return;
        setIsUploading(true);
        setError(null);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/importacao', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (data.success) {
                setResult(data);
            } else {
                setError(data.error || 'Erro desconhecido ao processar arquivo');
            }
        } catch (err: any) {
            setError(err.message || 'Erro de conexao com o servidor');
        } finally {
            setIsUploading(false);
        }
    };

    const handleReset = () => {
        setFile(null);
        setResult(null);
        setError(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-[var(--text-main)] font-serif">Importacao Automatica</h2>
                    <p className="text-[var(--text-secondary)] mt-2">Importe relatorios do iFood para processamento</p>
                </div>
                {(result || error) && (
                    <Button onClick={handleReset} variant="outline">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Nova Importacao
                    </Button>
                )}
            </div>

            {/* Resultado da Importacao */}
            {result && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                    {/* Card de Sucesso */}
                    <div className="bg-[var(--status-success-bg)] border border-[var(--status-success-text)]/30 rounded-2xl p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-[var(--status-success-text)]/20 rounded-full">
                                <CheckCircle className="w-8 h-8 text-[var(--status-success-text)]" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-[var(--status-success-text)] mb-2">
                                    Importacao Concluida!
                                </h3>
                                <p className="text-[var(--text-main)]">
                                    O arquivo <strong>"{file?.name}"</strong> foi processado com sucesso
                                    {result.tempoProcessamento && (
                                        <span className="text-[var(--text-muted)]"> em {(result.tempoProcessamento / 1000).toFixed(1)}s</span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Estatisticas */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-subtle)] text-center">
                            <p className="text-[10px] md:text-xs uppercase font-bold text-[var(--text-muted)] mb-1">Total de Linhas</p>
                            <p className="text-2xl md:text-3xl font-bold text-[var(--text-main)] font-serif">{result.totalLinhas}</p>
                        </div>
                        <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-subtle)] text-center">
                            <p className="text-[10px] md:text-xs uppercase font-bold text-[var(--text-muted)] mb-1">Cancelados</p>
                            <p className="text-2xl md:text-3xl font-bold text-[var(--secondary)] font-serif">{result.pedidosCancelados}</p>
                        </div>
                        <div className="bg-[var(--status-success-bg)] p-4 rounded-xl border border-[var(--status-success-text)]/30 text-center">
                            <p className="text-[10px] md:text-xs uppercase font-bold text-[var(--status-success-text)] mb-1">Novos</p>
                            <p className="text-2xl md:text-3xl font-bold text-[var(--status-success-text)] font-serif">{result.pedidosImportados}</p>
                        </div>
                        <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/30 text-center">
                            <p className="text-[10px] md:text-xs uppercase font-bold text-blue-500 mb-1">Atualizados</p>
                            <p className="text-2xl md:text-3xl font-bold text-blue-500 font-serif">{result.pedidosAtualizados}</p>
                        </div>
                        <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-subtle)] text-center">
                            <p className="text-[10px] md:text-xs uppercase font-bold text-[var(--text-muted)] mb-1">Sem Alteracao</p>
                            <p className="text-2xl md:text-3xl font-bold text-[var(--text-muted)] font-serif">{result.pedidosDuplicados}</p>
                        </div>
                    </div>

                    {/* Detalhes */}
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
                        <div className="p-4 bg-[var(--bg-page)] border-b border-[var(--border-subtle)]">
                            <h3 className="font-bold text-[var(--text-main)]">Resumo da Importacao</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* Importados (novos) */}
                            {result.pedidosImportados > 0 && (
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-[var(--status-success-text)] mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-medium text-[var(--text-main)]">
                                            {result.pedidosImportados} pedido(s) novo(s) importado(s)
                                        </p>
                                        <p className="text-sm text-[var(--text-muted)] mt-1">
                                            Pedidos: {result.detalhes.importados.slice(0, 10).join(', ')}
                                            {result.detalhes.importados.length > 10 && ` e mais ${result.detalhes.importados.length - 10}...`}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Atualizados */}
                            {result.pedidosAtualizados > 0 && (
                                <div className="flex items-start gap-3">
                                    <ArrowUpCircle className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-medium text-[var(--text-main)]">
                                            {result.pedidosAtualizados} pedido(s) atualizado(s) automaticamente
                                        </p>
                                        <p className="text-sm text-[var(--text-muted)] mt-1">
                                            Pedidos: {result.detalhes.atualizados.slice(0, 10).join(', ')}
                                            {result.detalhes.atualizados.length > 10 && ` e mais ${result.detalhes.atualizados.length - 10}...`}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Sem alteracao */}
                            {result.pedidosDuplicados > 0 && (
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-[var(--text-muted)] mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-medium text-[var(--text-main)]">
                                            {result.pedidosDuplicados} pedido(s) ja existiam sem alteracoes
                                        </p>
                                        <p className="text-sm text-[var(--text-muted)] mt-1">
                                            Pedidos: {result.detalhes.duplicados.slice(0, 10).join(', ')}
                                            {result.detalhes.duplicados.length > 10 && ` e mais ${result.detalhes.duplicados.length - 10}...`}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Nao Cancelados */}
                            {result.pedidosNaoCancelados > 0 && (
                                <div className="flex items-start gap-3">
                                    <XCircle className="w-5 h-5 text-[var(--text-muted)] mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-medium text-[var(--text-main)]">
                                            {result.pedidosNaoCancelados} pedido(s) nao estavam cancelados
                                        </p>
                                        <p className="text-sm text-[var(--text-muted)] mt-1">
                                            Apenas pedidos com status "CANCELADO" sao importados.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Nenhum novo importado */}
                            {result.pedidosImportados === 0 && result.pedidosAtualizados === 0 && (
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-[var(--secondary)] mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-medium text-[var(--text-main)]">
                                            Nenhum pedido novo ou atualizado
                                        </p>
                                        <p className="text-sm text-[var(--text-muted)] mt-1">
                                            Todos os pedidos cancelados ja existiam no sistema sem alteracoes, ou a planilha nao continha pedidos cancelados.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Erro */}
            {error && (
                <div className="bg-[var(--status-error-bg)] border border-[var(--status-error-text)]/30 rounded-2xl p-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[var(--status-error-text)]/20 rounded-full">
                            <XCircle className="w-8 h-8 text-[var(--status-error-text)]" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-[var(--status-error-text)] mb-2">
                                Erro na Importacao
                            </h3>
                            <p className="text-[var(--text-main)]">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Area - Mostrar apenas se nao houver resultado */}
            {!result && !error && (
                <div className="max-w-xl mx-auto space-y-6 mt-8">
                    <FileDropzone
                        onFileSelect={setFile}
                        label="Upload do Relatorio iFood"
                        subLabel="Arraste o arquivo Excel (.xlsx) para processar"
                    />

                    {file && (
                        <Button
                            onClick={handleUpload}
                            isLoading={isUploading}
                            className="w-full cursor-pointer"
                            size="lg"
                            variant="primary"
                        >
                            <Upload className="w-5 h-5 mr-2" />
                            {isUploading ? 'Processando...' : 'Confirmar Importacao'}
                        </Button>
                    )}
                </div>
            )}

            {/* Info Box */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 flex gap-3 text-[var(--text-secondary)] shadow-sm">
                <FileUp className="w-5 h-5 shrink-0 text-[var(--secondary)]" />
                <div className="text-sm space-y-1">
                    <p><strong>Como funciona a importacao:</strong></p>
                    <ul className="list-disc list-inside text-[var(--text-muted)] space-y-0.5">
                        <li>Apenas pedidos com status <strong>"CANCELADO"</strong> serao importados</li>
                        <li>Pedidos que ja existem serao <strong>atualizados automaticamente</strong> se houver mudancas (ex: status, valor recuperado)</li>
                        <li>O responsavel e motivo especifico serao classificados automaticamente</li>
                        <li>Pedidos com reembolso automatico do iFood ja virao como "FINALIZADO"</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
