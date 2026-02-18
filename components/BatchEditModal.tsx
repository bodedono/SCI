"use client";

import { useState } from "react";
import { X, Save, Loader2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

interface BatchEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: string[];
    onSave: () => void;
}

export default function BatchEditModal({ isOpen, onClose, selectedIds, onSave }: BatchEditModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        status: '',
        dataResolucao: '',
        resultado: '',
        valorRecuperado: '',
        observacoes: ''
    });

    if (!isOpen || selectedIds.length === 0) return null;

    const hasChanges = Object.values(formData).some(v => v !== '');

    const handleSave = async () => {
        if (!hasChanges) {
            alert('Preencha pelo menos um campo para atualizar.');
            return;
        }

        const confirmMsg = `Tem certeza que deseja atualizar ${selectedIds.length} pedido(s)?`;
        if (!confirm(confirmMsg)) return;

        setIsLoading(true);
        try {
            // Montar apenas os campos preenchidos
            const updates: Record<string, string> = {};
            if (formData.status) updates.status = formData.status;
            if (formData.dataResolucao) updates.dataResolucao = formData.dataResolucao;
            if (formData.resultado) updates.resultado = formData.resultado;
            if (formData.valorRecuperado) updates.valorRecuperado = formData.valorRecuperado;
            if (formData.observacoes) updates.observacoes = formData.observacoes;

            const res = await fetch('/api/contestacoes/batch-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds, updates }),
            });
            const json = await res.json();
            if (json.success) {
                alert(`✅ ${json.updatedCount} pedido(s) atualizado(s) com sucesso!`);
                // Limpar formulário
                setFormData({ status: '', dataResolucao: '', resultado: '', valorRecuperado: '', observacoes: '' });
                onSave();
                onClose();
            } else {
                alert('❌ Erro ao atualizar: ' + json.error);
            }
        } catch (error) {
            alert('❌ Erro de conexão');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({ status: '', dataResolucao: '', resultado: '', valorRecuperado: '', observacoes: '' });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[var(--bg-surface)] w-full max-w-2xl rounded-2xl shadow-2xl border border-[var(--border-subtle)] max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-surface)] z-10">
                    <h2 className="text-xl font-bold text-[var(--text-main)] font-serif flex items-center gap-2">
                        <Edit3 className="w-5 h-5" />
                        Editar {selectedIds.length} pedido(s)
                    </h2>
                    <button onClick={handleClose} className="p-2 hover:bg-[var(--bg-surface-hover)] rounded-lg text-[var(--text-secondary)]">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Info */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                            As alteracoes serao aplicadas a todos os <strong>{selectedIds.length} pedidos</strong> selecionados.
                            Apenas os campos preenchidos serao atualizados.
                        </p>
                    </div>

                    {/* Editable Fields */}
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Select
                                label="Status"
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="">— Manter atual —</option>
                                <option value="AGUARDANDO">Aguardando</option>
                                <option value="EM ANÁLISE">Em Analise</option>
                                <option value="FINALIZADO">Finalizado</option>
                                <option value="CANCELADO">Cancelado</option>
                            </Select>

                            <Input
                                label="Data Resolucao"
                                type="date"
                                value={formData.dataResolucao}
                                onChange={e => setFormData({ ...formData, dataResolucao: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wide text-[11px]">Resultado</label>
                            <textarea
                                className="w-full px-4 py-3 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-main)] focus:border-[var(--secondary)] focus:ring-4 focus:ring-[var(--secondary)]/10 transition-all outline-none resize-none h-24"
                                placeholder="Deixe vazio para manter o valor atual..."
                                value={formData.resultado}
                                onChange={e => setFormData({ ...formData, resultado: e.target.value })}
                            />
                        </div>

                        <div>
                            <Input
                                label="Valor Recuperado (R$)"
                                type="number"
                                step="0.01"
                                placeholder="Deixe vazio para manter o valor atual"
                                value={formData.valorRecuperado}
                                onChange={e => setFormData({ ...formData, valorRecuperado: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wide text-[11px]">Observacoes</label>
                            <textarea
                                className="w-full px-4 py-3 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-main)] focus:border-[var(--secondary)] focus:ring-4 focus:ring-[var(--secondary)]/10 transition-all outline-none resize-none h-20"
                                placeholder="Deixe vazio para manter o valor atual..."
                                value={formData.observacoes}
                                onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] sticky bottom-0 flex justify-end gap-3 z-10">
                    <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
                        Cancelar
                    </Button>
                    <Button variant="danger" onClick={handleSave} isLoading={isLoading} disabled={!hasChanges}>
                        <Save className="w-4 h-4 mr-2" />
                        Atualizar {selectedIds.length} pedido(s)
                    </Button>
                </div>
            </div>
        </div>
    );
}
