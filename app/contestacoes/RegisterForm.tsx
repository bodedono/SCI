"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

// ... (Keep Data Arrays: RESTAURANTES, MOTIVOS_GERAIS, etc.)
const RESTAURANTES = [
    // Bode do Nô
    { label: "Bode do Nô Afogados", value: "Bode do Nô Afogados", group: "Bode do Nô" },
    { label: "Bode do Nô Boa Viagem", value: "Bode do Nô Boa Viagem", group: "Bode do Nô" },
    { label: "Bode do Nô Guararapes", value: "Bode do Nô Guararapes", group: "Bode do Nô" },
    { label: "Bode do Nô Olinda", value: "Bode do Nô Olinda", group: "Bode do Nô" },
    { label: "Bode do Nô Tacaruna", value: "Bode do Nô Tacaruna", group: "Bode do Nô" },
    // Burguer do Nô
    { label: "Burguer do Nô Almoço", value: "Burguer do Nô Almoço", group: "Burguer do Nô" },
    { label: "Burguer do Nô Boa Viagem", value: "Burguer do Nô Boa Viagem", group: "Burguer do Nô" },
    { label: "Burguer do Nô Guararapes", value: "Burguer do Nô Guararapes", group: "Burguer do Nô" },
    { label: "Burguer do Nô Rio Mar", value: "Burguer do Nô Rio Mar", group: "Burguer do Nô" },
    // Italianô Pizzas
    { label: "Italianô Pizzas Afogados", value: "Italianô Pizzas Afogados", group: "Italianô Pizzas" },
    { label: "Italianô Pizzas Guararapes", value: "Italianô Pizzas Guararapes", group: "Italianô Pizzas" },
    { label: "Italianô Pizzas Olinda", value: "Italianô Pizzas Olinda", group: "Italianô Pizzas" },
    { label: "Italianô Pizzas Tacaruna", value: "Italianô Pizzas Tacaruna", group: "Italianô Pizzas" },
];

const MOTIVOS_GERAIS = [
    "Cancelamento indevido", "Pedido não recebido pelo cliente", "Taxa cobrada incorretamente",
    "Problema com pagamento", "Erro no valor do pedido", "Pedido duplicado",
    "Produto não disponível", "Erro do entregador", "Sistema - falha técnica", "Outros"
];

const RESPONSAVEIS = ["Restaurante", "Cliente", "Logística", "Plataforma"];

const MOTIVOS_ESPECIFICOS: Record<string, string[]> = {
    'Restaurante': [
        'Falta de carne', 'Falta de queijo', 'Falta de bacon', 'Falta de refrigerante',
        'Falta de batata', 'Fogão quebrado', 'Freezer com defeito', 'Atraso na produção',
        'Erro no preparo', 'Produto estragado', 'Falta de energia', 'Falta de gás',
        'Funcionário faltou', 'Sistema da loja fora', 'Pedido não foi recebido',
        'Sem entregador disponível', 'Loja fechou mais cedo', 'Outro problema interno'
    ],
    'Cliente': [
        'Cliente ausente', 'Endereço incorreto', 'Telefone não atende', 'Cliente mudou de ideia',
        'Forma de pagamento recusada', 'Cliente não tinha troco', 'Local de difícil acesso',
        'Cliente solicitou cancelamento', 'Problema no interfone', 'Outro problema do cliente'
    ],
    'Logística': [
        'Motoboy não encontrou endereço', 'Motoboy atrasou muito', 'Acidente com motoboy',
        'Moto quebrou', 'Problema no app do entregador', 'Entregador não aceitou',
        'Rota muito longa', 'Trânsito intenso', 'Outro problema logístico'
    ],
    'Plataforma': [
        'Erro no aplicativo', 'Sistema iFood fora do ar', 'Falha na integração', 'Pedido duplicado',
        'Valor incorreto no sistema', 'Problema no pagamento online', 'Bug da plataforma', 'Outro problema técnico'
    ]
};

export default function RegisterForm() {
    const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
        defaultValues: {
            dataAbertura: new Date().toISOString().split('T')[0],
            numeroPedido: "",
            restaurante: "",
            valorRecuperado: "",
            motivo: "",
            descricao: "",
            valor: "",
            responsavel: "",
            motivoEspecifico: "",
            status: "AGUARDANDO",
            observacoes: ""
        }
    });

    const [isLoading, setIsLoading] = useState(false);
    const responsavel = watch("responsavel");

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/contestacoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await res.json();

            if (result.success) {
                alert('✅ Contestação registrada com sucesso!');
                reset();
            } else {
                alert('❌ Erro: ' + result.error);
            }
        } catch (error) {
            alert('❌ Erro na comunicação com o servidor');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 w-full bg-[var(--bg-surface)] p-8 rounded-2xl shadow-sm border border-[var(--border-subtle)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                    label="Data de Abertura"
                    type="date"
                    {...register("dataAbertura", { required: "Data é obrigatória" })}
                    error={errors.dataAbertura?.message}
                />
                <Input
                    label="Número do Pedido"
                    placeholder="Ex: 1234"
                    {...register("numeroPedido", { required: "Número é obrigatório" })}
                    error={errors.numeroPedido?.message}
                />
            </div>

            <Select
                label="Restaurante"
                {...register("restaurante", { required: "Selecione um restaurante" })}
                error={errors.restaurante?.message}
            >
                <option value="">Selecione...</option>
                {RESTAURANTES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Select
                    label="Motivo Geral"
                    {...register("motivo", { required: "Selecione um motivo" })}
                    error={errors.motivo?.message}
                >
                    <option value="">Selecione...</option>
                    {MOTIVOS_GERAIS.map(m => <option key={m} value={m}>{m}</option>)}
                </Select>

                <Input
                    label="Valor (R$)"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register("valor", { required: "Valor é obrigatório" })}
                    error={errors.valor?.message}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                    label="Descrição Detalhada"
                    placeholder="O que aconteceu?"
                    {...register("descricao", { required: "Descrição é obrigatória" })}
                    error={errors.descricao?.message}
                />
                <Input
                    label="Valor Recuperado (R$)"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register("valorRecuperado", { required: "Valor é obrigatório" })}
                    error={errors.valorRecuperado?.message}
                />
            </div>




            <div className="p-4 bg-[var(--bg-page)] rounded-xl space-y-4 border border-[var(--border-subtle)]">
                <h3 className="font-semibold text-[var(--text-main)] text-sm uppercase tracking-wide">Classificação de responsabilidade</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Select
                        label="Responsável"
                        {...register("responsavel", { required: "Defina o responsável" })}
                        error={errors.responsavel?.message}
                    >
                        <option value="">Selecione...</option>
                        {RESPONSAVEIS.map(r => <option key={r} value={r}>{r}</option>)}
                    </Select>

                    <Select
                        label="Motivo Específico"
                        disabled={!responsavel}
                        {...register("motivoEspecifico", { required: "Defina o motivo específico" })}
                        error={errors.motivoEspecifico?.message}
                    >
                        <option value="">Selecione...</option>
                        {responsavel && MOTIVOS_ESPECIFICOS[responsavel]?.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </Select>
                </div>
            </div>

            <div className="pt-4">
                <Button type="submit" className=" cursor-pointer w-full shadow-lg hover:shadow-xl hover:-translate-y-0.5" size="lg" isLoading={isLoading} variant="primary">
                    💾 Registrar Contestação
                </Button>
            </div>
        </form>
    );
}
