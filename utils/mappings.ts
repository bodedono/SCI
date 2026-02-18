
// Palavras-chave para determinar status CANCELADO na importação
const KEYWORDS_CANCELADO = [
    'SUA LOJA CANCELOU',
    'FOI CANCELADO PELA SUA LOJA',
    'SUA LOJA ACEITOU',
];

// Palavras-chave para determinar status FINALIZADO na importação
const KEYWORDS_FINALIZADO = [
    'REEMBOLSO',
    'REEMBOLSOU',
    'NÃO É CONTESTÁVEL',
    'NAO E CONTESTAVEL',
    'NÃO É CONTESTAVEL',
    'NAO É CONTESTÁVEL',
];

/**
 * Determina o status inicial de uma contestação durante a importação
 * baseado no motivo da impossibilidade de contestar e no valor líquido.
 * Usa busca parcial por palavras-chave para lidar com variações de texto do iFood.
 */
export function determinarStatusImportacao(
    motivoNaoContestar: string,
    valorLiquido: number
): 'AGUARDANDO' | 'FINALIZADO' | 'CANCELADO' {
    const motivo = (motivoNaoContestar || '').trim().toUpperCase();

    // 1. N/A ou vazio = FINALIZADO (não há impedimento)
    if (motivo === 'N/A' || motivo === '') {
        return 'FINALIZADO';
    }

    // 2. Buscar por palavras-chave de CANCELADO (loja cancelou/aceitou)
    if (KEYWORDS_CANCELADO.some(kw => motivo.includes(kw))) {
        return 'CANCELADO';
    }

    // 3. Buscar por palavras-chave de FINALIZADO (reembolso, não contestável)
    if (KEYWORDS_FINALIZADO.some(kw => motivo.includes(kw))) {
        return 'FINALIZADO';
    }

    // 4. Fallback: se teve reembolso (valor líquido > 0)
    if (valorLiquido > 0) {
        return 'FINALIZADO';
    }

    // 5. Default: aguardando contestação
    return 'AGUARDANDO';
}

export const MAPEAMENTO_MOTIVOS: Record<string, { responsavel: string; motivoEspecifico: string; contestavel: boolean }> = {
    // CLIENTE
    'Cliente ausente': { responsavel: 'Cliente', motivoEspecifico: 'Cliente ausente', contestavel: false },
    'Endereço incorreto': { responsavel: 'Cliente', motivoEspecifico: 'Endereço incorreto', contestavel: false },
    'Cliente cancelou': { responsavel: 'Cliente', motivoEspecifico: 'Cliente solicitou cancelamento', contestavel: false },
    'Telefone não atende': { responsavel: 'Cliente', motivoEspecifico: 'Telefone não atende', contestavel: false },
    'Cliente mudou de ideia': { responsavel: 'Cliente', motivoEspecifico: 'Cliente mudou de ideia', contestavel: false },

    // RESTAURANTE
    'Pedido ou item veio errado': { responsavel: 'Restaurante', motivoEspecifico: 'Erro no preparo', contestavel: true },
    'Item indisponível': { responsavel: 'Restaurante', motivoEspecifico: 'Falta de produto', contestavel: true },
    'Produto não disponível': { responsavel: 'Restaurante', motivoEspecifico: 'Falta de produto', contestavel: true },
    'Falta de ingrediente': { responsavel: 'Restaurante', motivoEspecifico: 'Falta de carne', contestavel: true },
    'Loja fechada': { responsavel: 'Restaurante', motivoEspecifico: 'Loja fechou mais cedo', contestavel: true },
    'Erro no pedido': { responsavel: 'Restaurante', motivoEspecifico: 'Erro no preparo', contestavel: true },
    'Atraso na produção': { responsavel: 'Restaurante', motivoEspecifico: 'Atraso na produção', contestavel: true },

    // LOGÍSTICA
    'Atraso na entrega': { responsavel: 'Logística', motivoEspecifico: 'Motoboy atrasou muito', contestavel: true },
    'Erro do entregador': { responsavel: 'Logística', motivoEspecifico: 'Problema no app do entregador', contestavel: true },
    'Entregador não encontrou': { responsavel: 'Logística', motivoEspecifico: 'Motoboy não encontrou endereço', contestavel: true },
    'Acidente': { responsavel: 'Logística', motivoEspecifico: 'Acidente com motoboy', contestavel: true },
    'Moto quebrada': { responsavel: 'Logística', motivoEspecifico: 'Moto quebrou', contestavel: true },

    // PLATAFORMA
    'Problemas de sistema': { responsavel: 'Plataforma', motivoEspecifico: 'Sistema iFood fora do ar', contestavel: true },
    'Sistema - falha técnica': { responsavel: 'Plataforma', motivoEspecifico: 'Falha na integração', contestavel: true },
    'Erro no aplicativo': { responsavel: 'Plataforma', motivoEspecifico: 'Erro no aplicativo', contestavel: true },
    'Falha no pagamento': { responsavel: 'Plataforma', motivoEspecifico: 'Problema no pagamento online', contestavel: true },
    'Pedido duplicado': { responsavel: 'Plataforma', motivoEspecifico: 'Pedido duplicado', contestavel: true }
};

export const MAPEAMENTO_ORIGEM: Record<string, { contestavel: boolean }> = {
    'RESTAURANTE': { contestavel: true },
    'CLIENTE': { contestavel: false },
    'IFOOD': { contestavel: true },
    'LOGISTICA': { contestavel: true },
    'LOGÍSTICA': { contestavel: true }
};

const MAPEAMENTO_RESTAURANTES: Record<string, string> = {
    // Bode do Nô - todas as variações mapeiam para nome padronizado
    'BODE DO NÔ (AF)': 'Bode do Nô Afogados',
    'BODE DO NÔ AFOGADOS': 'Bode do Nô Afogados',
    'BODE DO NO AFOGADOS': 'Bode do Nô Afogados',
    'BODE DO NÔ (GUA)': 'Bode do Nô Guararapes',
    'BODE DO NÔ GUARARAPES': 'Bode do Nô Guararapes',
    'BODE DO NO GUARARAPES': 'Bode do Nô Guararapes',
    'BODE DO NÔ (OL)': 'Bode do Nô Olinda',
    'BODE DO NÔ OLINDA': 'Bode do Nô Olinda',
    'BODE DO NO OLINDA': 'Bode do Nô Olinda',
    'BODE DO NÔ (TACA)': 'Bode do Nô Tacaruna',
    'BODE DO NÔ TACARUNA': 'Bode do Nô Tacaruna',
    'BODE DO NO TACARUNA': 'Bode do Nô Tacaruna',
    'BODE DO NÔ - BOA VIAGEM': 'Bode do Nô Boa Viagem',
    'BODE DO NÔ BOA VIAGEM': 'Bode do Nô Boa Viagem',
    'BODE DO NO BOA VIAGEM': 'Bode do Nô Boa Viagem',

    // Burguer do Nô
    'BURGUER DO NÔ (GUARA)': 'Burguer do Nô Guararapes',
    'BURGUER DO NÔ GUARARAPES': 'Burguer do Nô Guararapes',
    'BURGUER DO NO GUARARAPES': 'Burguer do Nô Guararapes',
    'BURGUER DO NÔ (ALMOÇO)': 'Burguer do Nô Almoço',
    'BURGUER DO NÔ ALMOÇO': 'Burguer do Nô Almoço',
    'BURGUER DO NÔ - (BOA VIAGEM)': 'Burguer do Nô Boa Viagem',
    'BURGUER DO NÔ BOA VIAGEM': 'Burguer do Nô Boa Viagem',
    'BURGUER DO NO BOA VIAGEM': 'Burguer do Nô Boa Viagem',
    'BURGUER DO NÔ (RM)': 'Burguer do Nô Rio Mar',
    'BURGUER DO NÔ RM': 'Burguer do Nô Rio Mar',
    'BURGUER DO NO RM': 'Burguer do Nô Rio Mar',
    'BURGUER DO NÔ RIO MAR': 'Burguer do Nô Rio Mar',
    'BURGUER DO NO RIO MAR': 'Burguer do Nô Rio Mar',
    'BURGUER DO NÔ - RECIFE': 'Burguer do Nô Boa Viagem',
    'BURGUER DO NÔ (RECIFE)': 'Burguer do Nô Boa Viagem',
    'BURGUER DO NÔ RECIFE': 'Burguer do Nô Boa Viagem',
    'BURGUER DO NO RECIFE': 'Burguer do Nô Boa Viagem',

    // Italianô Pizzas
    'ITALIANÔ PIZZAS (GUA)': 'Italianô Pizzas Guararapes',
    'ITALIANÔ PIZZAS GUARARAPES': 'Italianô Pizzas Guararapes',
    'ITALIANO PIZZAS GUARARAPES': 'Italianô Pizzas Guararapes',
    'ITALIANÔ PIZZAS (OL)': 'Italianô Pizzas Olinda',
    'ITALIANÔ PIZZAS OLINDA': 'Italianô Pizzas Olinda',
    'ITALIANO PIZZAS OLINDA': 'Italianô Pizzas Olinda',
    'ITALIANÔ PIZZAS (AFOGADOS)': 'Italianô Pizzas Afogados',
    'ITALIANÔ PIZZAS AFOGADOS': 'Italianô Pizzas Afogados',
    'ITALIANO PIZZAS AFOGADOS': 'Italianô Pizzas Afogados',
    'ITALIANÔ PIZZAS (TACA)': 'Italianô Pizzas Tacaruna',
    'ITALIANÔ PIZZAS TACARUNA': 'Italianô Pizzas Tacaruna',
    'ITALIANO PIZZAS TACARUNA': 'Italianô Pizzas Tacaruna',
    'ITALIANÔ PIZZAS (RECIFE)': 'Italianô Pizzas Guararapes'
};

export function normalizarNomeRestaurante(nomeIfood: string): string {
    if (!nomeIfood) return '';
    
    // Remove caracteres extras e normaliza espaços
    const nomeClean = nomeIfood.trim().replace(/\s+/g, ' ');
    const nomeUpper = nomeClean.toUpperCase();

    // 1. Tentar mapeamento exato
    if (MAPEAMENTO_RESTAURANTES[nomeUpper]) {
        return MAPEAMENTO_RESTAURANTES[nomeUpper];
    }

    // 2. Tentar mapeamento por palavras-chave
    const nomeLower = nomeClean.toLowerCase();

    // BODE DO NÔ - detecta variações
    if (nomeLower.includes('bode')) {
        if (nomeLower.includes('(af)') || nomeLower.includes('afogados') || nomeLower.includes('afog')) {
            return 'Bode do Nô Afogados';
        }
        if (nomeLower.includes('(gua)') || nomeLower.includes('guararapes') || nomeLower.includes('guara')) {
            return 'Bode do Nô Guararapes';
        }
        if (nomeLower.includes('(ol)') || nomeLower.includes('olinda')) {
            return 'Bode do Nô Olinda';
        }
        if (nomeLower.includes('(taca)') || nomeLower.includes('tacaruna')) {
            return 'Bode do Nô Tacaruna';
        }
        if (nomeLower.includes('boa viagem') || nomeLower.includes('bv')) {
            return 'Bode do Nô Boa Viagem';
        }
    }

    // BURGUER DO NÔ - detecta variações
    if (nomeLower.includes('burguer')) {
        if (nomeLower.includes('(guara)') || nomeLower.includes('guararapes')) {
            return 'Burguer do Nô Guararapes';
        }
        if (nomeLower.includes('(almoço)') || nomeLower.includes('(almoco)') || nomeLower.includes('almoço') || nomeLower.includes('almoco')) {
            return 'Burguer do Nô Almoço';
        }
        if (nomeLower.includes('boa viagem') || nomeLower.includes('bv') || nomeLower.includes('recife')) {
            return 'Burguer do Nô Boa Viagem';
        }
        if (nomeLower.includes('(rm)') || nomeLower.includes(' rm') || nomeLower.includes('rio mar')) {
            return 'Burguer do Nô Rio Mar';
        }
    }

    // ITALIANÔ PIZZAS - detecta variações
    if (nomeLower.includes('italiano') || nomeLower.includes('italianô') || nomeLower.includes('italian')) {
        if (nomeLower.includes('(gua)') || nomeLower.includes('guararapes') || nomeLower.includes('guara')) {
            return 'Italianô Pizzas Guararapes';
        }
        if (nomeLower.includes('(ol)') || nomeLower.includes('olinda')) {
            return 'Italianô Pizzas Olinda';
        }
        if (nomeLower.includes('(af)') || nomeLower.includes('afogados') || nomeLower.includes('afog')) {
            return 'Italianô Pizzas Afogados';
        }
        if (nomeLower.includes('(taca)') || nomeLower.includes('tacaruna')) {
            return 'Italianô Pizzas Tacaruna';
        }
    }

    // 3. Retorna o nome original se não encontrou correspondência
    return nomeClean;
}

export function mapearMotivo(motivoIfood: string, origem: string) {
    // 1. Tentar Mapeamento Exato
    if (MAPEAMENTO_MOTIVOS[motivoIfood]) {
        return MAPEAMENTO_MOTIVOS[motivoIfood];
    }

    // 2. Tentar Mapeamento por Palavras-Chave
    const motivoLower = motivoIfood.toLowerCase();

    if (motivoLower.includes('cliente') || motivoLower.includes('ausente') || motivoLower.includes('endereço')) {
        return { responsavel: 'Cliente', motivoEspecifico: motivoIfood, contestavel: false };
    }

    if (motivoLower.includes('produto') || motivoLower.includes('item') || motivoLower.includes('falta')) {
        return { responsavel: 'Restaurante', motivoEspecifico: 'Falta de produto', contestavel: true };
    }

    if (motivoLower.includes('entrega') || motivoLower.includes('moto') || motivoLower.includes('atraso')) {
        return { responsavel: 'Logística', motivoEspecifico: 'Motoboy atrasou muito', contestavel: true };
    }

    if (motivoLower.includes('sistema') || motivoLower.includes('app') || motivoLower.includes('falha')) {
        return { responsavel: 'Plataforma', motivoEspecifico: 'Sistema iFood fora do ar', contestavel: true };
    }

    // 3. Fallback pela Origem
    const origemUpper = origem.toUpperCase();
    if (MAPEAMENTO_ORIGEM[origemUpper]) {
        return {
            responsavel: origemUpper === 'CLIENTE' ? 'Cliente' :
                origemUpper === 'RESTAURANTE' ? 'Restaurante' :
                    origemUpper.includes('LOGISTICA') || origemUpper.includes('LOGÍSTICA') ? 'Logística' : 'Plataforma',
            motivoEspecifico: motivoIfood,
            contestavel: MAPEAMENTO_ORIGEM[origemUpper].contestavel
        };
    }

    // 4. Default
    return { responsavel: 'Plataforma', motivoEspecifico: motivoIfood, contestavel: true };
}
