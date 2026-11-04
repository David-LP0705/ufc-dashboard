"""Gera os JSONs usados pelo site a partir da base do Kaggle "UFC datasets 1994-2025".

Uso: python preparar_dados.py <pasta_com_master.csv> <pasta_de_saida>
Saída: resumo.json, lutadores.json e eventos.json
"""
import json
import os
import re
import sys

import numpy as np
import pandas as pd

pasta_entrada, pasta_saida = sys.argv[1], sys.argv[2]
os.makedirs(pasta_saida, exist_ok=True)

NOMES_CATEGORIAS = {
    'Lightweight': 'Peso Leve',
    'Welterweight': 'Meio-Médio',
    'Middleweight': 'Médio',
    'Featherweight': 'Peso Pena',
    'Heavyweight': 'Peso Pesado',
    'Bantamweight': 'Peso Galo',
    'Light Heavyweight': 'Meio-Pesado',
    'Flyweight': 'Peso Mosca',
    "Women's Strawweight": 'Palha (F)',
    'Open Weight': 'Peso Aberto',
    "Women's Flyweight": 'Mosca (F)',
    "Women's Bantamweight": 'Galo (F)',
    'Catch Weight': 'Peso Casado',
    "Women's Featherweight": 'Pena (F)',
}
CATEGORIAS = sorted(NOMES_CATEGORIAS.values()) + ['Outras']
INDICE_CATEGORIA = {nome: indice for indice, nome in enumerate(CATEGORIAS)}

METODOS = ['KO/TKO', 'Finalização', 'Decisão unânime', 'Decisão dividida',
           'Decisão majoritária', 'Paralisação médica', 'Desqualificação', 'Outro']
INDICE_METODO = {'KO/TKO': 0, 'Submission': 1, 'Decision - Unanimous': 2, 'Decision': 2,
                 'Decision - Split': 3, 'Decision - Majority': 4,
                 "TKO - Doctor's Stoppage": 5, 'DQ': 6}
INDICE_METODO_OUTRO = 7

# ---------- leitura e filtro: só eventos do UFC (a base mistura outras organizações) ----------
lutas = pd.read_csv(os.path.join(pasta_entrada, 'master.csv'), low_memory=False)
eh_ufc = lutas.event_name.str.contains(r'UFC|Ultimate Fighter|Ultimate Ultimate', case=False, na=False)
eh_outro_circuito = lutas.event_name.str.contains(r'Road to UFC|Contender Series|DWCS', case=False, na=False)
lutas = lutas[eh_ufc & ~eh_outro_circuito].reset_index(drop=True)

lutas['data'] = lutas.event_date.astype(str)
lutas['ano'] = pd.to_datetime(lutas.event_date).dt.year
lutas['categoria'] = lutas.weight_class.map(NOMES_CATEGORIAS).fillna('Outras').map(INDICE_CATEGORIA)
lutas['metodo'] = lutas.method.map(INDICE_METODO).fillna(INDICE_METODO_OUTRO).astype(int)


def agrupar_resultado(luta):
    if luta.result_status != 'win':
        return 'outros'
    if luta.metodo in (0, 5):
        return 'ko'
    if luta.metodo == 1:
        return 'finalizacao'
    if luta.metodo in (2, 3, 4):
        return 'decisao'
    return 'outros'


def calcular_duracao(luta):
    """Minutos até o fim da luta: rounds completos anteriores + tempo do round final."""
    try:
        minutos_por_round = [int(x) for x in re.search(r'\(([\d\-]+)\)', luta.time_format).group(1).split('-')]
        round_final = int(luta.finish_round)
        minutos, segundos = luta.finish_time.split(':')
        if round_final < 1 or round_final > len(minutos_por_round):
            return np.nan
        return sum(minutos_por_round[:round_final - 1]) + int(minutos) + int(segundos) / 60
    except Exception:
        return np.nan


lutas['grupo'] = lutas.apply(agrupar_resultado, axis=1)
lutas['round_final'] = np.where(lutas.grupo.isin(['ko', 'finalizacao']),
                                lutas.finish_round.fillna(1).clip(1, 5), 0).astype(int)
lutas['duracao'] = lutas.apply(calcular_duracao, axis=1)

# ---------- resumo.json: dados da Visão geral ----------
contagem = lutas.groupby(['ano', 'categoria', 'grupo', 'round_final']).size().reset_index(name='quantidade')
duracoes = (lutas.dropna(subset=['duracao']).groupby(['ano', 'categoria']).duracao
            .agg(lutas='count', minutos='sum').reset_index())
total_lutadores = len(set(lutas.r_fighter_id) | set(lutas.b_fighter_id))

resumo = {
    'linhas': [[int(l.ano), int(l.categoria), l.grupo, int(l.round_final), int(l.quantidade)]
               for l in contagem.itertuples()],
    'duracoes': [[int(d.ano), int(d.categoria), int(d.lutas), round(float(d.minutos), 1)]
                 for d in duracoes.itertuples()],
    'categorias': CATEGORIAS,
    'anos': [int(lutas.ano.min()), int(lutas.ano.max())],
    'totais': {'lutas': int(len(lutas)), 'eventos': int(lutas.event_id.nunique()),
               'lutadores': int(total_lutadores)},
}

# ---------- uma linha por lutador em cada luta (lado vermelho e lado azul empilhados) ----------
COLUNAS_LUTADOR = {
    'fighter_id': 'id', 'fighter_name': 'nome', 'fighter_nick_name': 'apelido',
    'height': 'altura', 'reach_inches': 'envergadura', 'stance': 'guarda', 'dob': 'nascimento',
    'slpm': 'golpesPorMin', 'str_acc': 'precisao', 'sapm': 'absorvidosPorMin', 'str_def': 'defesa',
    'td_avg': 'quedasPor15', 'td_acc': 'precisaoQuedas', 'td_def': 'defesaQuedas',
    'sub_avg': 'finalizacoesPor15',
}
ESTATISTICAS_CARREIRA = ['golpesPorMin', 'precisao', 'absorvidosPorMin', 'defesa',
                         'quedasPor15', 'precisaoQuedas', 'defesaQuedas', 'finalizacoesPor15']
COLUNAS_GOLPES = {'sig_landed': 'golpesAcertados', 'sig_atmp': 'golpesTentados',
                  'sig_str_landed_head': 'golpesCabeca', 'sig_str_landed_body': 'golpesCorpo',
                  'sig_str_landed_leg': 'golpesPerna'}


def visao_do_lutador(lado, oponente):
    tabela = pd.DataFrame({novo: lutas[f'{lado}_{antigo}'] for antigo, novo in COLUNAS_LUTADOR.items()})
    tabela['adversario'] = lutas[f'{oponente}_fighter_name']
    tabela['idAdversario'] = lutas[f'{oponente}_fighter_id']
    for antigo, novo in COLUNAS_GOLPES.items():
        tabela[novo] = lutas[f'{lado}_total_{antigo}']
    venceu = (lutas.result_status == 'win') & (lutas.winner_id == lutas[f'{lado}_fighter_id'])
    tabela['resultado'] = np.where(lutas.result_status == 'draw', 'E',
                          np.where(lutas.result_status == 'no_contest', 'S',
                          np.where(venceu, 'V', 'D')))
    for coluna, novo in [('data', 'data'), ('ano', 'ano'), ('event_name', 'evento'),
                         ('categoria', 'categoria'), ('metodo', 'metodo'), ('grupo', 'grupo'),
                         ('title_fight', 'titulo'), ('finish_round', 'round'), ('fight_id', 'idLuta')]:
        tabela[novo] = lutas[coluna]
    return tabela


participacoes = pd.concat([visao_do_lutador('r', 'b'), visao_do_lutador('b', 'r')], ignore_index=True)
participacoes = participacoes.sort_values(['data', 'idLuta'])
colunas_golpes = list(COLUNAS_GOLPES.values())
participacoes[colunas_golpes] = participacoes[colunas_golpes].fillna(0)
sem_estatistica = participacoes.golpesTentados <= 0
participacoes.loc[sem_estatistica, colunas_golpes] = 0


def altura_em_cm(texto):
    achado = re.match(r"(\d+)'\s*(\d+)", str(texto))
    return round((int(achado.group(1)) * 12 + int(achado.group(2))) * 2.54) if achado else None


def valor_ou_none(valor):
    return None if pd.isna(valor) else valor


lutas_por_lutador = participacoes.groupby('id').size()
ids_incluidos = set(lutas_por_lutador[lutas_por_lutador >= 5].index)

lutadores = []
for id_lutador, historico in participacoes.groupby('id'):
    if id_lutador not in ids_incluidos:
        continue
    historico = historico.sort_values(['data', 'idLuta'])
    ultima = historico.iloc[-1]
    vitorias = historico[historico.resultado == 'V']

    sequencia = 0
    for resultado in historico.resultado:
        if resultado == 'V':
            sequencia += 1
        elif resultado in ('D', 'E'):
            sequencia = 0

    categorias_lutadas = historico[historico.categoria != INDICE_CATEGORIA['Outras']].categoria
    categoria_principal = int(categorias_lutadas.mode().iloc[0]) if len(categorias_lutadas) else INDICE_CATEGORIA['Outras']
    vitorias_por_ano = vitorias.groupby(['ano', 'categoria']).size().reset_index(name='quantidade')
    ultimas_lutas = [[l.data, l.adversario, l.resultado, int(l.metodo),
                      int(l.round) if pd.notna(l.round) else None, l.evento, l.idAdversario]
                     for l in historico.iloc[::-1].head(8).itertuples()]
    soma = historico[colunas_golpes].sum()

    lutadores.append({
        'id': id_lutador,
        'nome': ultima['nome'],
        'apelido': valor_ou_none(ultima['apelido']),
        'categoria': categoria_principal,
        'altura': altura_em_cm(ultima['altura']),
        'envergadura': round(float(ultima['envergadura']) * 2.54) if pd.notna(ultima['envergadura']) else None,
        'guarda': valor_ou_none(ultima['guarda']),
        'nascimento': str(ultima['nascimento']) if pd.notna(ultima['nascimento']) else None,
        'vitorias': int(len(vitorias)),
        'derrotas': int((historico.resultado == 'D').sum()),
        'empates': int((historico.resultado == 'E').sum()),
        'semResultado': int((historico.resultado == 'S').sum()),
        'vitoriasKo': int((vitorias.grupo == 'ko').sum()),
        'vitoriasFinalizacao': int((vitorias.grupo == 'finalizacao').sum()),
        'vitoriasDecisao': int((vitorias.grupo == 'decisao').sum()),
        'vitoriasTitulo': int(vitorias.titulo.fillna(0).astype(int).sum()),
        'sequenciaAtual': sequencia,
        'lutas': int(len(historico)),
        'anoInicial': int(historico.ano.min()),
        'anoFinal': int(historico.ano.max()),
        'golpesAcertados': int(soma.golpesAcertados),
        'golpesTentados': int(soma.golpesTentados),
        'golpesCabeca': int(soma.golpesCabeca),
        'golpesCorpo': int(soma.golpesCorpo),
        'golpesPerna': int(soma.golpesPerna),
        'estatisticas': {nome: (float(ultima[nome]) if pd.notna(ultima[nome]) else None)
                         for nome in ESTATISTICAS_CARREIRA},
        'vitoriasPorAno': [[int(v.ano), int(v.categoria), int(v.quantidade)] for v in vitorias_por_ano.itertuples()],
        'ultimasLutas': ultimas_lutas,
    })

lutadores.sort(key=lambda l: (-l['vitorias'], -l['lutas'], l['nome']))
indice_por_id = {l['id']: posicao for posicao, l in enumerate(lutadores)}
for posicao, lutador in enumerate(lutadores):
    lutador['indice'] = posicao
    for luta in lutador['ultimasLutas']:
        luta[6] = indice_por_id.get(luta[6], -1)

# Último vencedor de luta de cinturão por categoria (apenas títulos disputados a partir de 2022)
titulos = lutas[(lutas.title_fight == 1) & (lutas.result_status == 'win')
                & (lutas.categoria != INDICE_CATEGORIA['Outras'])].copy()
venceu_vermelho = titulos.winner_id == titulos.r_fighter_id
titulos['nomeVencedor'] = np.where(venceu_vermelho, titulos.r_fighter_name, titulos.b_fighter_name)
titulos['idVencedor'] = np.where(venceu_vermelho, titulos.r_fighter_id, titulos.b_fighter_id)
titulos['nomeAdversario'] = np.where(venceu_vermelho, titulos.b_fighter_name, titulos.r_fighter_name)

campeoes = []
for categoria, disputas in titulos.groupby('categoria'):
    ultima_disputa = disputas.sort_values(['data', 'fight_id']).iloc[-1]
    if ultima_disputa.data < '2022-01-01':
        continue
    campeoes.append([int(categoria), indice_por_id.get(ultima_disputa.idVencedor, -1), ultima_disputa.nomeVencedor,
                     ultima_disputa.data, ultima_disputa.event_name, ultima_disputa.nomeAdversario])

# ---------- eventos.json ----------
VENCEDOR_VERMELHO, VENCEDOR_AZUL, EMPATE, SEM_RESULTADO = 0, 1, 2, 3
eventos = []
for id_evento, luta_do_evento in lutas.groupby('event_id'):
    luta_do_evento = luta_do_evento.sort_values('title_fight', ascending=False)
    primeira = luta_do_evento.iloc[0]
    card = []
    for l in luta_do_evento.itertuples():
        if l.result_status == 'win':
            vencedor = VENCEDOR_VERMELHO if l.winner_id == l.r_fighter_id else VENCEDOR_AZUL
        else:
            vencedor = EMPATE if l.result_status == 'draw' else SEM_RESULTADO
        card.append([l.r_fighter_name, l.b_fighter_name,
                     indice_por_id.get(l.r_fighter_id, -1), indice_por_id.get(l.b_fighter_id, -1),
                     vencedor, int(l.categoria), int(l.metodo),
                     int(l.finish_round) if pd.notna(l.finish_round) else None, int(l.title_fight)])
    eventos.append([primeira.event_name, primeira.data, valor_ou_none(primeira.event_location), card])
eventos.sort(key=lambda e: e[1], reverse=True)


def salvar(nome_arquivo, conteudo):
    with open(os.path.join(pasta_saida, nome_arquivo), 'w', encoding='utf-8') as arquivo:
        json.dump(conteudo, arquivo, ensure_ascii=False, separators=(',', ':'))


salvar('resumo.json', resumo)
salvar('lutadores.json', {'lutadores': lutadores, 'categorias': CATEGORIAS, 'metodos': METODOS, 'campeoes': campeoes})
salvar('eventos.json', {'eventos': eventos, 'categorias': CATEGORIAS, 'metodos': METODOS})

for nome_arquivo in ('resumo.json', 'lutadores.json', 'eventos.json'):
    print(nome_arquivo, os.path.getsize(os.path.join(pasta_saida, nome_arquivo)) // 1024, 'KB')
print(len(lutadores), 'lutadores,', len(eventos), 'eventos,', resumo['totais'])
