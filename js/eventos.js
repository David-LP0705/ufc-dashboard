/* Eventos e lutas: lista com busca e filtro por ano, e detalhe do card de lutas. */
(function () {
  const { porId, escapar, formatarNumero, normalizar, formatarData, nomeCategoria, htmlAvatar, observarFotos } = UFC;
  const POR_PAGINA = 30;
  const VENCEDOR_VERMELHO = 0, VENCEDOR_AZUL = 1, EMPATE = 2;

  const filtro = { busca: '', ano: '', quantidade: POR_PAGINA };
  let eventos, categorias, metodos, pronto = false;

  function eventosFiltrados() {
    const busca = normalizar(filtro.busca);
    const indices = [];
    eventos.forEach(([nome, data, local], indice) => {
      if (filtro.ano && data.slice(0, 4) !== filtro.ano) return;
      if (busca && !normalizar(nome + ' ' + (local || '')).includes(busca)) return;
      indices.push(indice);
    });
    return indices;
  }

  function desenharLista() {
    const indices = eventosFiltrados();
    const visiveis = indices.slice(0, filtro.quantidade);
    porId('listaEventos').innerHTML = visiveis.map((indice) => {
      const [nome, data, local, lutas] = eventos[indice];
      return '<a class="item-evento" href="#/evento/' + indice + '"><span class="data-evento">' + formatarData(data) + '</span>'
        + '<b>' + escapar(nome) + '</b><small>' + escapar(local || 'Local não informado') + ' · ' + lutas.length + ' lutas</small></a>';
    }).join('') || '<p class="nota">Nenhum evento encontrado.</p>';
    porId('infoEventos').textContent = 'Mostrando ' + visiveis.length + ' de ' + formatarNumero(indices.length) + ' eventos';
    porId('botaoMaisEventos').hidden = visiveis.length >= indices.length;
  }

  const linkLutador = (nome, indice) => (indice >= 0 ? '<a href="#/lutador/' + indice + '">' + escapar(nome) + '</a>' : escapar(nome));

  function textoResultado(vencedor, metodo, round) {
    if (vencedor === VENCEDOR_VERMELHO || vencedor === VENCEDOR_AZUL) {
      return metodos[metodo] + (round ? ' · round ' + round : '');
    }
    return vencedor === EMPATE ? 'Empate' : 'Sem resultado';
  }

  function desenharDetalhe(indice) {
    const [nome, data, local, lutas] = eventos[indice];
    const disputaDeTitulo = lutas[0] && lutas[0][8] === 1 ? lutas[0] : null;

    const itens = lutas.map(([vermelho, azul, indiceVermelho, indiceAzul, vencedor, categoria, metodo, round, titulo]) =>
      '<li class="item-luta"><span class="categoria-luta">' + (titulo ? '<em>Cinturão</em> ' : '') + escapar(nomeCategoria(categorias[categoria])) + '</span>'
      + '<div class="confronto"><span class="lado' + (vencedor === VENCEDOR_VERMELHO ? ' vencedor' : '') + '">'
      + linkLutador(vermelho, indiceVermelho) + (vencedor === VENCEDOR_VERMELHO ? ' ✔' : '') + '</span>'
      + '<span class="versus">vs</span>'
      + '<span class="lado' + (vencedor === VENCEDOR_AZUL ? ' vencedor' : '') + '">'
      + linkLutador(azul, indiceAzul) + (vencedor === VENCEDOR_AZUL ? ' ✔' : '') + '</span></div>'
      + '<small>' + escapar(textoResultado(vencedor, metodo, round)) + '</small></li>'
    ).join('');

    porId('detalheEvento').innerHTML =
      '<a class="voltar" href="#/eventos">← Todos os eventos</a>'
      + '<article class="cartao"><h2>' + escapar(nome) + '</h2>'
      + '<p class="nota">' + formatarData(data) + ' · ' + escapar(local || 'Local não informado') + ' · ' + lutas.length + ' lutas</p>'
      + (disputaDeTitulo
        ? '<div class="duelo">' + htmlAvatar(disputaDeTitulo[0], 'medio') + '<span>Disputa de cinturão</span>' + htmlAvatar(disputaDeTitulo[1], 'medio') + '</div>'
        : '')
      + '<ul class="lista-lutas">' + itens + '</ul></article>';
    observarFotos(porId('detalheEvento'));
  }

  async function iniciar() {
    const dados = await UFC.carregarDados('eventos');
    eventos = dados.eventos;
    categorias = dados.categorias;
    metodos = dados.metodos;

    const anos = [...new Set(eventos.map(([, data]) => data.slice(0, 4)))].sort().reverse();
    anos.forEach((ano) => porId('filtroAnoEvento').add(new Option(ano, ano)));

    porId('buscaEvento').oninput = (evento) => { filtro.busca = evento.target.value; filtro.quantidade = POR_PAGINA; desenharLista(); };
    porId('filtroAnoEvento').onchange = (evento) => { filtro.ano = evento.target.value; filtro.quantidade = POR_PAGINA; desenharLista(); };
    porId('botaoMaisEventos').onclick = () => { filtro.quantidade += POR_PAGINA; desenharLista(); };
    desenharLista();
    pronto = true;
  }

  UFC.modulos.eventos = {
    async abrir(pagina, argumento) {
      if (!pronto) await iniciar();
      const indice = argumento != null ? +argumento : -1;
      if (pagina === 'evento' && eventos[indice]) {
        porId('blocoListaEventos').hidden = true;
        porId('detalheEvento').hidden = false;
        desenharDetalhe(indice);
      } else {
        porId('detalheEvento').hidden = true;
        porId('blocoListaEventos').hidden = false;
      }
    }
  };
})();
