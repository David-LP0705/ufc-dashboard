/* Minha área: perfil do usuário, lutador preferido em destaque e CRUD de favoritos (Back4App). */
(function () {
  const { porId, escapar, normalizar, htmlAvatar, observarFotos, configuracao, nomeCategoria } = UFC;
  const USA_BACK4APP = Boolean(configuracao.ID_APLICATIVO && configuracao.CHAVE_REST);
  const CHAVE_FAVORITOS_LOCAIS = 'ufc_favoritos_local';

  let lutadores = null, categorias = [], nomesValidos = new Set(), favoritos = [], pronto = false;

  /* ---------- acesso aos dados (Back4App ou, sem chaves, o navegador) ---------- */
  const lerFavoritosLocais = () => {
    try { return JSON.parse(localStorage.getItem(CHAVE_FAVORITOS_LOCAIS)) || []; } catch (erro) { return []; }
  };
  const salvarFavoritosLocais = (lista) => {
    try { localStorage.setItem(CHAVE_FAVORITOS_LOCAIS, JSON.stringify(lista)); } catch (erro) { /* sem armazenamento */ }
  };

  async function requisicaoBack4App(metodo, caminho, corpo) {
    const resposta = await fetch(configuracao.URL_BASE + '/classes/' + configuracao.CLASSE + (caminho || ''), {
      method: metodo,
      headers: {
        'X-Parse-Application-Id': configuracao.ID_APLICATIVO,
        'X-Parse-REST-API-Key': configuracao.CHAVE_REST,
        'Content-Type': 'application/json'
      },
      body: corpo ? JSON.stringify(corpo) : undefined
    });
    const json = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(json.error || 'Erro ' + resposta.status);
    return json;
  }

  const bancoFavoritos = {
    async listar() {
      if (!USA_BACK4APP) return lerFavoritosLocais().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return (await requisicaoBack4App('GET', '?order=-createdAt&limit=200')).results;
    },
    async criar(dados) {
      if (!USA_BACK4APP) {
        const lista = lerFavoritosLocais();
        lista.push({ objectId: 'l' + Date.now(), createdAt: new Date().toISOString(), ...dados });
        salvarFavoritosLocais(lista);
        return;
      }
      await requisicaoBack4App('POST', '', dados);
    },
    async editar(id, dados) {
      if (!USA_BACK4APP) {
        salvarFavoritosLocais(lerFavoritosLocais().map((favorito) => (favorito.objectId === id ? { ...favorito, ...dados } : favorito)));
        return;
      }
      await requisicaoBack4App('PUT', '/' + id, dados);
    },
    async excluir(id) {
      if (!USA_BACK4APP) {
        salvarFavoritosLocais(lerFavoritosLocais().filter((favorito) => favorito.objectId !== id));
        return;
      }
      await requisicaoBack4App('DELETE', '/' + id);
    }
  };

  // Usado também pela Visão geral
  UFC.favoritos = {
    async buscarPreferido() {
      if (!lutadores) lutadores = (await UFC.carregarDados('lutadores')).lutadores;
      const favorito = (await bancoFavoritos.listar()).find((item) => item.preferido);
      const lutador = favorito && lutadores.find((item) => item.nome === favorito.lutador);
      return lutador ? { lutador, favorito } : null;
    }
  };

  /* ---------- perfil do usuário ---------- */
  function desenharPerfilUsuario() {
    const perfil = UFC.perfilUsuario.ler();
    const nome = perfil.nome || 'Visitante';
    porId('avatarUsuario').innerHTML = perfil.foto
      ? '<span class="avatar destaque"><img alt="Foto do usuário" src="' + escapar(perfil.foto) + '"></span>'
      : '<span class="avatar destaque"><b>' + escapar(UFC.iniciais(nome).toUpperCase()) + '</b></span>';
    porId('nomeUsuario').textContent = nome;
    UFC.desenharChip();
  }

  function configurarPerfilUsuario() {
    const fecharFormulario = () => {
      porId('formularioPerfil').hidden = true;
      porId('botaoEditarPerfil').hidden = false;
      porId('mensagemPerfil').textContent = '';
    };

    porId('botaoEditarPerfil').onclick = () => {
      porId('campoNomeUsuario').value = UFC.perfilUsuario.ler().nome || '';
      porId('campoFotoUsuario').value = '';
      porId('formularioPerfil').hidden = false;
      porId('botaoEditarPerfil').hidden = true;
      porId('campoNomeUsuario').focus();
    };
    porId('botaoFecharPerfil').onclick = fecharFormulario;
    porId('botaoRemoverFoto').onclick = () => {
      const perfil = UFC.perfilUsuario.ler();
      delete perfil.foto;
      UFC.perfilUsuario.salvar(perfil);
      desenharPerfilUsuario();
      porId('mensagemPerfil').textContent = 'Foto removida.';
    };
    porId('formularioPerfil').onsubmit = async (evento) => {
      evento.preventDefault();
      const perfil = UFC.perfilUsuario.ler();
      perfil.nome = porId('campoNomeUsuario').value.trim().slice(0, 40);
      const arquivo = porId('campoFotoUsuario').files && porId('campoFotoUsuario').files[0];
      try {
        if (arquivo) perfil.foto = await UFC.redimensionarImagem(arquivo);
        if (!UFC.perfilUsuario.salvar(perfil)) throw new Error('Não foi possível salvar neste navegador.');
        desenharPerfilUsuario();
        fecharFormulario();
      } catch (erro) {
        porId('mensagemPerfil').textContent = erro.message;
      }
    };
    desenharPerfilUsuario();
  }

  /* ---------- lutador preferido em destaque ---------- */
  const estrelas = (nota) => '★'.repeat(nota) + '☆'.repeat(5 - nota);

  function desenharDestaque() {
    const caixa = porId('destaquePreferido');
    const favorito = favoritos.find((item) => item.preferido);
    const lutador = favorito && lutadores.find((item) => item.nome === favorito.lutador);

    if (!lutador) {
      caixa.innerHTML = '<div class="cartao"><h3>Lutador preferido</h3>'
        + '<p class="nota">Adicione um favorito e use o botão “Preferido” na lista para destacá-lo aqui.</p></div>';
      return;
    }
    const precisao = lutador.golpesTentados > 0 ? Math.round((lutador.golpesAcertados / lutador.golpesTentados) * 100) : null;
    caixa.innerHTML =
      '<article class="cartao cabecalho-lutador destaque-preferido">' + htmlAvatar(lutador.nome, 'enorme')
      + '<div class="dados-lutador"><div class="etiquetas"><span class="ouro">★ Lutador preferido</span>'
      + '<span>' + escapar(nomeCategoria(categorias[lutador.categoria])) + '</span></div>'
      + '<h2>' + escapar(lutador.nome) + '</h2>' + (lutador.apelido ? '<p class="apelido">“' + escapar(lutador.apelido) + '”</p>' : '')
      + '<p class="cartel">Cartel no UFC: <b>' + lutador.vitorias + '-' + lutador.derrotas + '-' + lutador.empates + '</b></p>'
      + '<p class="biografia" id="biografiaPreferido">Buscando biografia na Wikipedia…</p>'
      + '<p class="nota">Minha nota: <span class="estrelas">' + estrelas(Number(favorito.nota) || 0) + '</span>'
      + (favorito.previsao ? ' · Previsão: ' + escapar(favorito.previsao) : '')
      + (favorito.anotacao ? ' · ' + escapar(favorito.anotacao) : '') + '</p>'
      + '<div class="acoes"><a class="link-secundario" href="#/lutador/' + lutador.indice + '">Ver perfil completo</a>'
      + '<a id="linkWikipediaPreferido" class="link-secundario" target="_blank" rel="noopener" hidden>Ler na Wikipedia</a></div></div></article>'
      + '<section class="painel-numeros"><div><b>' + lutador.vitorias + '</b><small>vitórias no UFC</small></div>'
      + '<div><b>' + lutador.vitoriasKo + '</b><small>vitórias por KO/TKO</small></div>'
      + '<div><b>' + lutador.vitoriasFinalizacao + '</b><small>vitórias por finalização</small></div>'
      + '<div><b>' + lutador.sequenciaAtual + '</b><small>sequência atual</small></div>'
      + '<div><b>' + (precisao === null ? '–' : precisao + '%') + '</b><small>precisão de golpes</small></div></section>';
    observarFotos(caixa);

    const biografia = porId('biografiaPreferido');
    UFC.buscarFoto(lutador.nome).then((foto) => {
      if (!biografia.isConnected) return;
      if (foto && foto.resumo) {
        biografia.textContent = foto.resumo;
        porId('linkWikipediaPreferido').href = foto.link;
        porId('linkWikipediaPreferido').hidden = false;
      } else {
        biografia.textContent = 'Biografia não encontrada na Wikipedia para este lutador.';
      }
    });
  }

  /* ---------- favoritos ---------- */
  function mostrarMensagem(texto, ehErro) {
    const elemento = porId('mensagemFavorito');
    elemento.textContent = texto;
    elemento.style.color = ehErro ? '#ff8a8a' : '';
  }

  function desenharTabela() {
    const busca = normalizar(porId('buscaFavorito').value.trim());
    const visiveis = favoritos.filter((favorito) =>
      !busca || normalizar(favorito.lutador + ' ' + (favorito.previsao || '') + ' ' + (favorito.anotacao || '')).includes(busca));
    const corpo = porId('corpoFavoritos');

    if (!visiveis.length) {
      corpo.innerHTML = '<tr><td colspan="5">' + (favoritos.length
        ? 'Nenhum favorito encontrado na busca.'
        : 'Você ainda não tem favoritos. Adicione o primeiro acima ou pelo perfil de um lutador.') + '</td></tr>';
      return;
    }
    corpo.innerHTML = visiveis.map((favorito) => {
      const indice = lutadores.findIndex((lutador) => lutador.nome === favorito.lutador);
      const nome = indice >= 0 ? '<a href="#/lutador/' + indice + '">' + escapar(favorito.lutador) + '</a>' : escapar(favorito.lutador);
      return '<tr><td><div class="lutador-linha">' + htmlAvatar(favorito.lutador, 'pequeno') + '<div><b>' + nome + '</b>'
        + (favorito.preferido ? '<small class="texto-ouro">★ Preferido</small>' : '') + '</div></div></td>'
        + '<td class="estrelas" title="' + escapar(favorito.nota) + ' de 5">' + estrelas(Number(favorito.nota) || 0) + '</td>'
        + '<td>' + escapar(favorito.previsao) + '</td><td>' + escapar(favorito.anotacao) + '</td>'
        + '<td class="botoes-linha"><button class="secundario pequeno" data-preferir="' + escapar(favorito.objectId) + '">'
        + (favorito.preferido ? 'Tirar destaque' : 'Preferido') + '</button>'
        + '<button class="secundario pequeno" data-editar="' + escapar(favorito.objectId) + '">Editar</button>'
        + '<button class="perigo pequeno" data-excluir="' + escapar(favorito.objectId) + '">Excluir</button></td></tr>';
    }).join('');
    observarFotos(corpo);
  }

  async function carregarFavoritos() {
    try {
      favoritos = await bancoFavoritos.listar();
    } catch (erro) {
      favoritos = [];
      mostrarMensagem('Não foi possível carregar os favoritos: ' + erro.message, true);
    }
    desenharTabela();
    desenharDestaque();
  }

  function limparFormulario() {
    porId('formularioFavorito').reset();
    porId('favoritoId').value = '';
    porId('botaoSalvarFavorito').textContent = 'Adicionar favorito';
    porId('botaoCancelarFavorito').hidden = true;
  }

  // Só um favorito pode ser o preferido: ao escolher outro, o anterior perde o destaque
  async function alternarPreferido(id) {
    const alvo = favoritos.find((favorito) => favorito.objectId === id);
    if (!alvo) return;
    const virarPreferido = !alvo.preferido;
    if (virarPreferido) {
      for (const outro of favoritos.filter((favorito) => favorito.preferido && favorito.objectId !== id)) {
        await bancoFavoritos.editar(outro.objectId, { preferido: false });
      }
    }
    await bancoFavoritos.editar(id, { preferido: virarPreferido });
  }

  function iniciarEdicao(favorito) {
    porId('favoritoId').value = favorito.objectId;
    porId('campoLutador').value = favorito.lutador;
    porId('campoNota').value = favorito.nota;
    porId('campoPrevisao').value = favorito.previsao || '';
    porId('campoAnotacao').value = favorito.anotacao || '';
    porId('botaoSalvarFavorito').textContent = 'Salvar alterações';
    porId('botaoCancelarFavorito').hidden = false;
    porId('formularioFavorito').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function iniciar() {
    const dados = await UFC.carregarDados('lutadores');
    lutadores = dados.lutadores;
    categorias = dados.categorias;
    nomesValidos = new Set(lutadores.map((lutador) => lutador.nome));
    porId('listaNomes').innerHTML = lutadores.map((lutador) => '<option value="' + escapar(lutador.nome) + '"></option>').join('');
    configurarPerfilUsuario();

    if (!USA_BACK4APP) {
      const aviso = porId('aviso');
      aviso.hidden = false;
      aviso.textContent = 'Back4App ainda não configurado (config.js). Os favoritos estão sendo salvos só neste navegador, em modo de teste.';
    }

    porId('formularioFavorito').onsubmit = async (evento) => {
      evento.preventDefault();
      const dadosFavorito = {
        lutador: porId('campoLutador').value.trim(),
        nota: Number(porId('campoNota').value),
        previsao: porId('campoPrevisao').value.trim(),
        anotacao: porId('campoAnotacao').value.trim()
      };
      if (!nomesValidos.has(dadosFavorito.lutador)) {
        mostrarMensagem('Escolha um lutador da lista (digite o nome e selecione).', true);
        return;
      }
      try {
        const id = porId('favoritoId').value;
        if (id) {
          await bancoFavoritos.editar(id, dadosFavorito);
        } else {
          if (!favoritos.some((favorito) => favorito.preferido)) dadosFavorito.preferido = true; // o primeiro favorito já vira o preferido
          await bancoFavoritos.criar(dadosFavorito);
        }
        mostrarMensagem(id ? 'Favorito atualizado.' : 'Favorito adicionado.');
        limparFormulario();
        await carregarFavoritos();
      } catch (erro) {
        mostrarMensagem('Erro ao salvar: ' + erro.message, true);
      }
    };
    porId('botaoCancelarFavorito').onclick = () => { limparFormulario(); mostrarMensagem(''); };
    porId('buscaFavorito').oninput = desenharTabela;

    porId('corpoFavoritos').onclick = async (evento) => {
      const { editar, excluir, preferir } = evento.target.dataset;
      if (preferir) {
        try {
          await alternarPreferido(preferir);
          mostrarMensagem('');
          await carregarFavoritos();
        } catch (erro) {
          mostrarMensagem('Erro ao definir o preferido: ' + erro.message, true);
        }
      }
      if (editar) {
        const favorito = favoritos.find((item) => item.objectId === editar);
        if (favorito) iniciarEdicao(favorito);
      }
      if (excluir && confirm('Excluir este favorito?')) {
        try {
          await bancoFavoritos.excluir(excluir);
          mostrarMensagem('Favorito excluído.');
          await carregarFavoritos();
        } catch (erro) {
          mostrarMensagem('Erro ao excluir: ' + erro.message, true);
        }
      }
    };
    await carregarFavoritos();
    pronto = true;
  }

  UFC.modulos.minha = {
    async abrir() {
      if (!pronto) await iniciar();
      if (UFC.lutadorParaFavoritar) {
        limparFormulario();
        porId('campoLutador').value = UFC.lutadorParaFavoritar;
        UFC.lutadorParaFavoritar = null;
        porId('campoPrevisao').focus();
      }
    }
  };
})();
