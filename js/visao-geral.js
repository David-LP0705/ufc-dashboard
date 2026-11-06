/* Visão geral: filtros, indicadores, destaques e gráficos (Chart.js). */
(function () {
  const { porId, escapar, formatarNumero, formatarDecimal, nomeCategoria, CORES, opcoesGrafico, htmlAvatar, observarFotos } = UFC;

  const ROTULOS_GRUPOS = {
    ko: 'KO/TKO',
    finalizacao: 'Finalização',
    decisao: 'Decisão dos juízes',
    outros: 'Outros (empate, sem resultado, DQ)'
  };

  const filtro = { categoria: -1, de: 0, ate: 0 };
  let dados, lutadores, categorias, maioresVencedores = [], pronto = false;
  const graficos = {};

  const linhasFiltradas = (ignorarCategoria) => dados.linhas.filter(([ano, categoria]) =>
    ano >= filtro.de && ano <= filtro.ate && (ignorarCategoria || filtro.categoria < 0 || categoria === filtro.categoria));

  function calcularMaioresVencedores(quantidade) {
    const lista = [];
    for (const lutador of lutadores) {
      let vitorias = 0;
      for (const [ano, categoria, quantidadeNoAno] of lutador.vitoriasPorAno) {
        if (ano >= filtro.de && ano <= filtro.ate && (filtro.categoria < 0 || categoria === filtro.categoria)) {
          vitorias += quantidadeNoAno;
        }
      }
      if (vitorias > 0) lista.push([lutador, vitorias]);
    }
    return lista
      .sort((a, b) => b[1] - a[1] || a[0].nome.localeCompare(b[0].nome))
      .slice(0, quantidade);
  }

  function criarGraficos() {
    graficos.metodos = new Chart(porId('graficoMetodos'), {
      type: 'doughnut',
      data: {
        labels: Object.values(ROTULOS_GRUPOS),
        datasets: [{
          data: [],
          backgroundColor: [CORES.ko, CORES.finalizacao, CORES.decisao, CORES.outros],
          borderColor: '#15171c'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: 'Participação de cada resultado (% das lutas)' },
          tooltip: { callbacks: { label: (item) => {
            const total = item.dataset.data.reduce((soma, valor) => soma + valor, 0) || 1;
            return ' ' + formatarNumero(item.parsed) + ' lutas (' + formatarDecimal((item.parsed / total) * 100) + '%)';
          } } }
        }
      }
    });

    graficos.anos = new Chart(porId('graficoAnos'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Lutas', data: [], borderColor: CORES.vermelho, backgroundColor: 'rgba(229,56,59,.18)',
          fill: true, tension: 0.25, pointRadius: 2
        }]
      },
      options: opcoesGrafico('Ano', 'Nº de lutas')
    });

    graficos.categorias = new Chart(porId('graficoCategorias'), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Lutas', data: [], backgroundColor: [] }] },
      options: opcoesGrafico('Categoria de peso', 'Nº de lutas')
    });

    graficos.vitorias = new Chart(porId('graficoVitorias'), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Vitórias', data: [], backgroundColor: CORES.vermelho }] },
      options: opcoesGrafico('Vitórias no UFC', 'Lutador', {
        indexAxis: 'y',
        onClick: (_evento, elementos) => {
          if (elementos.length && maioresVencedores[elementos[0].index]) {
            UFC.irPara('#/lutador/' + maioresVencedores[elementos[0].index][0].indice);
          }
        },
        scales: {
          x: { title: { display: true, text: 'Vitórias no UFC' }, grid: { color: CORES.grade }, beginAtZero: true },
          y: { title: { display: true, text: 'Lutador' }, grid: { display: false } }
        }
      })
    });
  }

  function atualizar() {
    const totais = { ko: 0, finalizacao: 0, decisao: 0, outros: 0 };
    const lutasPorAno = {};
    for (const [ano, , grupo, , quantidade] of linhasFiltradas(false)) {
      totais[grupo] += quantidade;
      lutasPorAno[ano] = (lutasPorAno[ano] || 0) + quantidade;
    }
    const totalLutas = totais.ko + totais.finalizacao + totais.decisao + totais.outros;
    const lutasDecididas = totais.ko + totais.finalizacao + totais.decisao;
    const anos = [];
    for (let ano = filtro.de; ano <= filtro.ate; ano++) anos.push(ano);

    porId('indicadorLutas').textContent = formatarNumero(totalLutas);
    porId('indicadorFinalizacao').textContent = lutasDecididas
      ? formatarDecimal(((totais.ko + totais.finalizacao) / lutasDecididas) * 100) + '%' : '–';

    graficos.metodos.data.datasets[0].data = [totais.ko, totais.finalizacao, totais.decisao, totais.outros];
    graficos.metodos.update();

    graficos.anos.data.labels = anos;
    graficos.anos.data.datasets[0].data = anos.map((ano) => lutasPorAno[ano] || 0);
    graficos.anos.update();

    // Os gráficos por categoria ignoram o filtro de categoria e destacam a escolhida em dourado
    const lutasPorCategoria = Array(categorias.length).fill(0);
    linhasFiltradas(true).forEach(([, categoria, , , quantidade]) => { lutasPorCategoria[categoria] += quantidade; });
    const categoriasComLutas = lutasPorCategoria
      .map((quantidade, categoria) => [categoria, quantidade])
      .filter(([, quantidade]) => quantidade > 0)
      .sort((a, b) => b[1] - a[1]);
    graficos.categorias.data.labels = categoriasComLutas.map(([categoria]) => nomeCategoria(categorias[categoria]));
    graficos.categorias.data.datasets[0].data = categoriasComLutas.map(([, quantidade]) => quantidade);
    graficos.categorias.data.datasets[0].backgroundColor = categoriasComLutas
      .map(([categoria]) => (categoria === filtro.categoria ? CORES.ouro : CORES.vermelho));
    graficos.categorias.update();

    maioresVencedores = calcularMaioresVencedores(10);
    graficos.vitorias.data.labels = maioresVencedores.map(([lutador]) => lutador.nome);
    graficos.vitorias.data.datasets[0].data = maioresVencedores.map(([, vitorias]) => vitorias);
    graficos.vitorias.update();

    porId('destaques').innerHTML = maioresVencedores.slice(0, 5).map(([lutador, vitorias]) =>
      '<a class="cartao-destaque" href="#/lutador/' + lutador.indice + '">' + htmlAvatar(lutador.nome, 'medio')
      + '<b>' + escapar(lutador.nome) + '</b><span>' + vitorias + ' vitórias</span>'
      + '<small>' + escapar(nomeCategoria(categorias[lutador.categoria])) + '</small></a>'
    ).join('') || '<p class="nota">Nenhum lutador com vitórias neste filtro.</p>';
    observarFotos(porId('destaques'));
  }

  async function desenharPreferido() {
    const cartao = porId('cartaoPreferido');
    let preferido = null;
    try { preferido = await UFC.favoritos.buscarPreferido(); } catch (erro) { preferido = null; }

    if (!preferido) {
      cartao.innerHTML = '<div class="cartao-preferido"><h3>Seu lutador preferido</h3>'
        + '<p class="nota">Você ainda não escolheu um favorito. Cadastre na aba Minha área para ele aparecer aqui.</p>'
        + '<a class="link-secundario" href="#/minha">Escolher lutador</a></div>';
      return;
    }
    const { lutador } = preferido;
    const precisao = lutador.golpesTentados > 0 ? Math.round((lutador.golpesAcertados / lutador.golpesTentados) * 100) : null;
    cartao.innerHTML = '<a class="cartao-preferido" href="#/lutador/' + lutador.indice + '" style="text-decoration:none;color:inherit">'
      + '<h3>Seu lutador preferido</h3>' + htmlAvatar(lutador.nome, 'medio')
      + '<b>' + escapar(lutador.nome) + '</b><small class="nota">' + escapar(nomeCategoria(categorias[lutador.categoria]))
      + ' · cartel ' + lutador.vitorias + '-' + lutador.derrotas + '-' + lutador.empates + '</small>'
      + '<div class="numeros"><span><b>' + lutador.vitoriasKo + '</b>KO/TKO</span>'
      + '<span><b>' + lutador.vitoriasFinalizacao + '</b>finalizações</span>'
      + '<span><b>' + lutador.sequenciaAtual + '</b>sequência</span>'
      + '<span><b>' + (precisao === null ? '–' : precisao + '%') + '</b>precisão</span></div></a>';
    observarFotos(cartao);
  }

  async function iniciar() {
    const [resumo, dadosLutadores] = await Promise.all([UFC.carregarDados('resumo'), UFC.carregarDados('lutadores')]);
    dados = resumo;
    lutadores = dadosLutadores.lutadores;
    categorias = resumo.categorias;
    const [primeiroAno, ultimoAno] = resumo.anos;
    filtro.de = primeiroAno;
    filtro.ate = ultimoAno;

    categorias.forEach((nome, indice) => porId('filtroCategoria').add(new Option(nomeCategoria(nome), indice)));
    for (let ano = primeiroAno; ano <= ultimoAno; ano++) {
      porId('filtroDe').add(new Option(ano, ano));
      porId('filtroAte').add(new Option(ano, ano));
    }
    porId('filtroDe').value = primeiroAno;
    porId('filtroAte').value = ultimoAno;

    porId('filtroCategoria').onchange = (evento) => { filtro.categoria = +evento.target.value; atualizar(); };
    porId('filtroDe').onchange = (evento) => {
      filtro.de = +evento.target.value;
      if (filtro.de > filtro.ate) { filtro.ate = filtro.de; porId('filtroAte').value = filtro.ate; }
      atualizar();
    };
    porId('filtroAte').onchange = (evento) => {
      filtro.ate = +evento.target.value;
      if (filtro.ate < filtro.de) { filtro.de = filtro.ate; porId('filtroDe').value = filtro.de; }
      atualizar();
    };
    porId('botaoLimpar').onclick = () => {
      filtro.categoria = -1; filtro.de = primeiroAno; filtro.ate = ultimoAno;
      porId('filtroCategoria').value = -1;
      porId('filtroDe').value = primeiroAno;
      porId('filtroAte').value = ultimoAno;
      atualizar();
    };

    porId('indicadorEventos').textContent = formatarNumero(resumo.totais.eventos);
    porId('indicadorLutadores').textContent = formatarNumero(resumo.totais.lutadores);
    criarGraficos();
    atualizar();
    pronto = true;
  }

  UFC.modulos.visao = {
    async abrir() {
      if (!pronto) await iniciar();
      else Object.values(graficos).forEach((grafico) => grafico.resize());
      desenharPreferido();
    }
  };
})();
