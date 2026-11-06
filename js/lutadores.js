/* Lutadores: ranking com busca/filtro/ordenação e perfil individual. */
(function () {
  const { porId, escapar, formatarNumero, normalizar, formatarData, nomeCategoria, htmlAvatar, observarFotos, CORES, opcoesGrafico } = UFC;
  const POR_PAGINA = 20;
  const RESULTADOS = { V: 'Vitória', D: 'Derrota', E: 'Empate', S: 'Sem resultado' };

  const filtro = { busca: '', categoria: -1, ordem: 'vitorias', quantidade: POR_PAGINA };
  let lutadores, categorias, metodos, pronto = false, graficosPerfil = [];

  const porcentagem = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : null);
  const taxaFinalizacao = (lutador) => porcentagem(lutador.vitoriasKo + lutador.vitoriasFinalizacao, lutador.vitorias);
  const precisaoGolpes = (lutador) => porcentagem(lutador.golpesAcertados, lutador.golpesTentados);
  const categoriaDe = (lutador) => nomeCategoria(categorias[lutador.categoria]);

  const ORDENACOES = {
    vitorias: { rotulo: 'Mais vitórias', aceita: () => true, comparar: (a, b) => b.vitorias - a.vitorias || b.lutas - a.lutas },
    lutas: { rotulo: 'Mais lutas', aceita: () => true, comparar: (a, b) => b.lutas - a.lutas || b.vitorias - a.vitorias },
    taxaFinalizacao: {
      rotulo: 'Maior % de finalização (mín. 8 vitórias)',
      aceita: (lutador) => lutador.vitorias >= 8,
      comparar: (a, b) => taxaFinalizacao(b) - taxaFinalizacao(a) || b.vitorias - a.vitorias
    }
  };

  /* ---------- ranking ---------- */
  function lutadoresFiltrados() {
    const busca = normalizar(filtro.busca);
    const ordenacao = ORDENACOES[filtro.ordem];
    return lutadores
      .filter((lutador) => (filtro.categoria < 0 || lutador.categoria === filtro.categoria)
        && ordenacao.aceita(lutador)
        && (!busca || normalizar(lutador.nome + ' ' + (lutador.apelido || '')).includes(busca)))
      .sort(ordenacao.comparar);
  }

  function desenharRanking() {
    const lista = lutadoresFiltrados();
    const visiveis = lista.slice(0, filtro.quantidade);
    porId('corpoLutadores').innerHTML = visiveis.map((lutador, posicao) => {
      const taxa = taxaFinalizacao(lutador);
      const precisao = precisaoGolpes(lutador);
      return '<tr data-indice="' + lutador.indice + '" tabindex="0"><td class="posicao">' + (posicao + 1) + '</td>'
        + '<td><div class="lutador-linha">' + htmlAvatar(lutador.nome, 'pequeno') + '<div><b>' + escapar(lutador.nome) + '</b>'
        + (lutador.apelido ? '<small>“' + escapar(lutador.apelido) + '”</small>' : '') + '</div></div></td>'
        + '<td>' + escapar(categoriaDe(lutador)) + '</td>'
        + '<td>' + lutador.vitorias + '-' + lutador.derrotas + '-' + lutador.empates + '</td>'
        + '<td>' + (taxa === null ? '–' : taxa + '%') + '</td>'
        + '<td>' + (precisao === null ? '–' : precisao + '%') + '</td><td>' + lutador.lutas + '</td></tr>';
    }).join('') || '<tr><td colspan="7">Nenhum lutador encontrado.</td></tr>';
    porId('infoLutadores').textContent = 'Mostrando ' + visiveis.length + ' de ' + formatarNumero(lista.length) + ' lutadores';
    porId('botaoMaisLutadores').hidden = visiveis.length >= lista.length;
    observarFotos(porId('corpoLutadores'));
  }

  /* ---------- perfil ---------- */
  function destruirGraficosPerfil() {
    graficosPerfil.forEach((grafico) => grafico.destroy());
    graficosPerfil = [];
  }

  // Escreve o valor no centro do gráfico de rosca
  const pluginTextoCentral = {
    id: 'textoCentral',
    afterDraw(grafico) {
      const texto = grafico.options.textoCentral;
      if (!texto) return;
      const { ctx, chartArea: { left, right, top, bottom } } = grafico;
      ctx.save();
      ctx.fillStyle = '#eceef2';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 36px Oswald, system-ui, sans-serif';
      ctx.fillText(texto, (left + right) / 2, (top + bottom) / 2);
      ctx.restore();
    }
  };

  function desenharPerfil(indice) {
    const lutador = lutadores[indice];
    destruirGraficosPerfil();
    porId('blocoListaLutadores').hidden = true;
    const perfil = porId('perfilLutador');
    perfil.hidden = false;
    perfil.dataset.indice = indice;

    const idade = UFC.calcularIdade(lutador.nascimento);
    const precisao = precisaoGolpes(lutador);
    const totalGolpesPorAlvo = lutador.golpesCabeca + lutador.golpesCorpo + lutador.golpesPerna;

    const ultimasLutas = lutador.ultimasLutas.map(([data, adversario, resultado, metodo, round, evento, indiceAdversario]) =>
      '<tr><td>' + formatarData(data) + '</td><td>' + escapar(evento) + '</td>'
      + '<td>' + (indiceAdversario >= 0 ? '<a href="#/lutador/' + indiceAdversario + '">' + escapar(adversario) + '</a>' : escapar(adversario)) + '</td>'
      + '<td><span class="resultado resultado-' + resultado + '" title="' + RESULTADOS[resultado] + '">' + (resultado === 'S' ? 'SR' : resultado) + '</span></td>'
      + '<td>' + escapar(metodos[metodo]) + '</td><td>' + (round || '–') + '</td></tr>'
    ).join('');

    perfil.innerHTML =
      '<a class="voltar" href="#/lutadores">← Ranking de lutadores</a>'
      + '<article class="cartao cabecalho-lutador">' + htmlAvatar(lutador.nome, 'grande')
      + '<div class="dados-lutador"><div class="etiquetas"><span>' + escapar(categoriaDe(lutador)) + '</span>'
      + '<span>No UFC de ' + lutador.anoInicial + ' a ' + lutador.anoFinal + '</span>'
      + (lutador.vitoriasTitulo
        ? '<span class="ouro">' + lutador.vitoriasTitulo + (lutador.vitoriasTitulo > 1 ? ' vitórias' : ' vitória') + ' em disputa de cinturão</span>'
        : '') + '</div>'
      + '<h2>' + escapar(lutador.nome) + '</h2>' + (lutador.apelido ? '<p class="apelido">“' + escapar(lutador.apelido) + '”</p>' : '')
      + '<p class="cartel">Cartel no UFC: <b>' + lutador.vitorias + '-' + lutador.derrotas + '-' + lutador.empates + '</b>'
      + (lutador.semResultado ? ' (' + lutador.semResultado + ' sem resultado)' : '') + '</p>'
      + '<div class="ficha"><div><small>Altura</small><b>' + (lutador.altura ? lutador.altura + ' cm' : '–') + '</b></div>'
      + '<div><small>Envergadura</small><b>' + (lutador.envergadura ? lutador.envergadura + ' cm' : '–') + '</b></div>'
      + '<div><small>Guarda</small><b>' + escapar(lutador.guarda || '–') + '</b></div>'
      + '<div><small>Idade</small><b>' + (idade == null ? '–' : idade + ' anos') + '</b></div></div>'
      + '<p class="biografia" id="biografiaLutador">Buscando biografia na Wikipedia…</p>'
      + '<div class="acoes"><button type="button" id="botaoFavoritar">★ Adicionar aos favoritos</button>'
      + '<a id="linkWikipedia" class="link-secundario" target="_blank" rel="noopener" hidden>Ler na Wikipedia</a></div></div></article>'

      + '<section class="painel-numeros"><div><b>' + lutador.sequenciaAtual + '</b><small>sequência atual de vitórias</small></div>'
      + '<div><b>' + lutador.vitoriasKo + '</b><small>vitórias por KO/TKO</small></div>'
      + '<div><b>' + lutador.vitoriasFinalizacao + '</b><small>vitórias por finalização</small></div>'
      + '<div><b>' + lutador.vitoriasDecisao + '</b><small>vitórias por decisão</small></div></section>'

      + '<div class="grade">'
      + '<article class="cartao"><h3>Precisão de golpes significativos</h3>'
      + (precisao === null
        ? '<p class="nota">Sem estatísticas de golpes para este lutador.</p>'
        : '<div class="area-grafico"><canvas id="graficoPrecisao"></canvas></div><p class="nota texto-centro">'
          + formatarNumero(lutador.golpesAcertados) + ' acertados de ' + formatarNumero(lutador.golpesTentados) + ' tentados</p>') + '</article>'
      + '<article class="cartao"><h3>Golpes significativos por alvo</h3>'
      + (totalGolpesPorAlvo
        ? '<div class="area-grafico"><canvas id="graficoAlvos"></canvas></div>'
        : '<p class="nota">Sem estatísticas por alvo.</p>') + '</article>'
      + '<article class="cartao"><h3>Vitórias por ano</h3><div class="area-grafico"><canvas id="graficoVitoriasAno"></canvas></div></article>'
      + '<article class="cartao larga"><h3>Últimas lutas</h3><div class="tabela-rolagem"><table>'
      + '<thead><tr><th>Data</th><th>Evento</th><th>Adversário</th><th>Res.</th><th>Método</th><th>Round</th></tr></thead><tbody>'
      + ultimasLutas + '</tbody></table></div></article>'
      + '</div>';

    observarFotos(perfil);
    porId('botaoFavoritar').onclick = () => { UFC.lutadorParaFavoritar = lutador.nome; UFC.irPara('#/minha'); };

    UFC.buscarFoto(lutador.nome).then((foto) => {
      if (porId('perfilLutador').dataset.indice !== String(indice)) return;
      const biografia = porId('biografiaLutador');
      if (foto && foto.resumo) {
        biografia.textContent = foto.resumo;
        porId('linkWikipedia').href = foto.link;
        porId('linkWikipedia').hidden = false;
      } else {
        biografia.textContent = 'Biografia não encontrada na Wikipedia para este lutador.';
      }
    });

    if (precisao !== null) {
      graficosPerfil.push(new Chart(porId('graficoPrecisao'), {
        type: 'doughnut',
        data: { labels: ['Acertos', 'Erros'], datasets: [{ data: [precisao, 100 - precisao], backgroundColor: [CORES.ouro, '#262a33'], borderWidth: 0 }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '78%',
          textoCentral: precisao + '%',
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (item) => ' ' + item.label + ': ' + item.parsed + '%' } } }
        },
        plugins: [pluginTextoCentral]
      }));
    }

    if (totalGolpesPorAlvo) {
      graficosPerfil.push(new Chart(porId('graficoAlvos'), {
        type: 'bar',
        data: {
          labels: ['Cabeça', 'Corpo', 'Perna'],
          datasets: [{ data: [lutador.golpesCabeca, lutador.golpesCorpo, lutador.golpesPerna], backgroundColor: [CORES.vermelho, CORES.ouro, CORES.decisao] }]
        },
        options: opcoesGrafico('Golpes significativos acertados', 'Alvo', {
          indexAxis: 'y',
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (item) => ' ' + formatarNumero(item.parsed.x) + ' golpes (' + Math.round((item.parsed.x / totalGolpesPorAlvo) * 100) + '%)' } }
          },
          scales: {
            x: { title: { display: true, text: 'Golpes significativos acertados' }, grid: { color: CORES.grade }, beginAtZero: true },
            y: { title: { display: true, text: 'Alvo' }, grid: { display: false } }
          }
        })
      }));
    }

    const anos = [];
    const vitorias = [];
    const vitoriasPorAno = {};
    lutador.vitoriasPorAno.forEach(([ano, , quantidade]) => { vitoriasPorAno[ano] = (vitoriasPorAno[ano] || 0) + quantidade; });
    for (let ano = lutador.anoInicial; ano <= lutador.anoFinal; ano++) {
      anos.push(ano);
      vitorias.push(vitoriasPorAno[ano] || 0);
    }
    graficosPerfil.push(new Chart(porId('graficoVitoriasAno'), {
      type: 'bar',
      data: { labels: anos, datasets: [{ label: 'Vitórias', data: vitorias, backgroundColor: CORES.vermelho }] },
      options: opcoesGrafico('Ano', 'Vitórias')
    }));
  }

  /* ---------- início ---------- */
  async function iniciar() {
    const dados = await UFC.carregarDados('lutadores');
    lutadores = dados.lutadores;
    categorias = dados.categorias;
    metodos = dados.metodos;

    categorias.forEach((nome, indice) => porId('filtroCategoriaLutador').add(new Option(nomeCategoria(nome), indice)));
    Object.entries(ORDENACOES).forEach(([chave, ordenacao]) => porId('ordemLutadores').add(new Option(ordenacao.rotulo, chave)));

    porId('buscaLutador').oninput = (evento) => { filtro.busca = evento.target.value; filtro.quantidade = POR_PAGINA; desenharRanking(); };
    porId('filtroCategoriaLutador').onchange = (evento) => { filtro.categoria = +evento.target.value; filtro.quantidade = POR_PAGINA; desenharRanking(); };
    porId('ordemLutadores').onchange = (evento) => { filtro.ordem = evento.target.value; filtro.quantidade = POR_PAGINA; desenharRanking(); };
    porId('botaoMaisLutadores').onclick = () => { filtro.quantidade += POR_PAGINA; desenharRanking(); };

    const abrirPerfil = (evento) => {
      const linha = evento.target.closest('tr[data-indice]');
      if (linha && !evento.target.closest('a')) UFC.irPara('#/lutador/' + linha.dataset.indice);
    };
    porId('corpoLutadores').onclick = abrirPerfil;
    porId('corpoLutadores').onkeydown = (evento) => { if (evento.key === 'Enter') abrirPerfil(evento); };
    desenharRanking();
    pronto = true;
  }

  UFC.modulos.lutadores = {
    async abrir(pagina, argumento) {
      if (!pronto) await iniciar();
      const indice = argumento != null ? +argumento : -1;
      if (pagina === 'lutador' && lutadores[indice]) {
        desenharPerfil(indice);
      } else {
        destruirGraficosPerfil();
        porId('perfilLutador').hidden = true;
        porId('blocoListaLutadores').hidden = false;
      }
    }
  };
})();
