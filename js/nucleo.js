/* Funções compartilhadas: formatação, carregamento dos dados, fotos (API da Wikipedia) e perfil do usuário. */
window.UFC = (function () {
  const configuracao = window.CONFIG || {};
  const porId = (id) => document.getElementById(id);

  const escapar = (texto) => String(texto == null ? '' : texto).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const formatarNumero = (numero) => Number(numero).toLocaleString('pt-BR');
  const formatarDecimal = (numero, casas = 1) => Number(numero).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
  const formatarData = (dataIso) => (dataIso ? String(dataIso).split('-').reverse().join('/') : '–');
  const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const irPara = (hash) => { location.hash = hash; };
  const nomeCategoria = (nome) => (nome === 'Outras' ? 'Outras categorias' : nome);

  function calcularIdade(nascimento) {
    if (!nascimento) return null;
    const data = new Date(nascimento);
    if (isNaN(data)) return null;
    const hoje = new Date();
    let idade = hoje.getFullYear() - data.getFullYear();
    const diferencaMes = hoje.getMonth() - data.getMonth();
    if (diferencaMes < 0 || (diferencaMes === 0 && hoje.getDate() < data.getDate())) idade--;
    return idade;
  }

  /* ---------- dados ---------- */
  const dadosCarregados = {};
  function carregarDados(nome) {
    if (!dadosCarregados[nome]) {
      dadosCarregados[nome] = fetch('data/' + nome + '.json').then((resposta) => {
        if (!resposta.ok) throw new Error(nome + '.json: HTTP ' + resposta.status);
        return resposta.json();
      });
      dadosCarregados[nome].catch(() => { delete dadosCarregados[nome]; });
    }
    return dadosCarregados[nome];
  }

  /* ---------- gráficos ---------- */
  const CORES = {
    ko: '#e5383b', finalizacao: '#4cc9f0', decisao: '#8d99ae', outros: '#5b6270',
    ouro: '#d4af37', vermelho: '#e5383b', grade: '#222733'
  };

  function configurarGraficos() {
    Chart.defaults.color = '#c3c9d4';
    Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  }

  function opcoesGrafico(tituloX, tituloY, extras) {
    const opcoes = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: !!tituloX, text: tituloX }, grid: { color: CORES.grade } },
        y: { title: { display: !!tituloY, text: tituloY }, grid: { color: CORES.grade }, beginAtZero: true }
      }
    };
    return Object.assign(opcoes, extras || {});
  }

  /* ---------- fotos: API da Wikipedia ---------- */
  const CHAVE_FOTOS = 'ufc_fotos_v3';
  const LIMITE_REQUISICOES = 4;
  let memoriaFotos = {};
  try { memoriaFotos = JSON.parse(localStorage.getItem(CHAVE_FOTOS)) || {}; } catch (erro) { memoriaFotos = {}; }
  const guardarMemoriaFotos = () => {
    try { localStorage.setItem(CHAVE_FOTOS, JSON.stringify(memoriaFotos)); } catch (erro) { /* sem espaço */ }
  };

  let requisicoesAtivas = 0;
  const filaRequisicoes = [];
  function processarFila() {
    while (requisicoesAtivas < LIMITE_REQUISICOES && filaRequisicoes.length) {
      const tarefa = filaRequisicoes.shift();
      requisicoesAtivas++;
      tarefa.executar().then(tarefa.resolver, tarefa.rejeitar).then(() => { requisicoesAtivas--; processarFila(); });
    }
  }
  const agendar = (executar) => new Promise((resolver, rejeitar) => {
    filaRequisicoes.push({ executar, resolver, rejeitar });
    processarFila();
  });

  async function buscarPaginasWikipedia(termo) {
    const url = 'https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=5'
      + '&gsrsearch=' + encodeURIComponent(termo)
      + '&prop=pageimages%7Cextracts&piprop=thumbnail&pithumbsize=500'
      + '&exintro=1&explaintext=1&exsentences=2&exlimit=5&format=json&formatversion=2&origin=*';
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
    const json = await resposta.json();
    return ((json.query && json.query.pages) || []).slice().sort((a, b) => a.index - b.index);
  }

  async function consultarWikipedia(nome) {
    const partes = normalizar(nome).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((parte) => parte.length >= 2);
    const sobrenome = partes.filter((parte) => parte.length >= 3).pop();
    const primeiroNome = partes[0];

    // Só aceita páginas que descrevem um lutador e citam o sobrenome
    const pareceLutador = (pagina) => {
      const texto = normalizar(pagina.title + ' ' + (pagina.extract || '').slice(0, 220));
      return /mixed martial|martial artist|ufc|fighter|kickbox|wrestler|jiu-jitsu|boxer/.test(texto)
        && sobrenome && texto.includes(sobrenome);
    };

    let melhor = null;
    for (const termo of [nome + ' mixed martial artist', nome + ' UFC']) {
      const candidatas = (await buscarPaginasWikipedia(termo)).filter(pareceLutador);
      const escolhida = candidatas.find((p) => p.thumbnail && normalizar(p.title).includes(primeiroNome)) || candidatas[0];
      if (escolhida && (escolhida.thumbnail || !melhor)) melhor = escolhida;
      if (melhor && melhor.thumbnail) break;
    }
    if (!melhor) return null;
    return {
      imagem: melhor.thumbnail ? melhor.thumbnail.source : null,
      link: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(String(melhor.title).replace(/ /g, '_')),
      resumo: melhor.extract || '',
      titulo: melhor.title
    };
  }

  const buscasEmAndamento = {};
  function buscarFoto(nome) {
    if (Object.prototype.hasOwnProperty.call(memoriaFotos, nome)) return Promise.resolve(memoriaFotos[nome] || null);
    if (buscasEmAndamento[nome]) return buscasEmAndamento[nome];

    const busca = agendar(() => consultarWikipedia(nome))
      .then((resultado) => {
        memoriaFotos[nome] = resultado ? { ...resultado, resumo: resultado.resumo.slice(0, 320) } : 0;
        guardarMemoriaFotos();
        return memoriaFotos[nome] || null;
      })
      .catch(() => null); // falha de rede: não guarda, tenta de novo na próxima vez
    buscasEmAndamento[nome] = busca;
    busca.then(() => { delete buscasEmAndamento[nome]; });
    return busca;
  }

  const iniciais = (nome) => {
    const partes = String(nome).trim().split(/\s+/);
    return ((partes[0] || '')[0] || '') + (partes.length > 1 ? partes[partes.length - 1][0] : '');
  };

  const htmlAvatar = (nome, classe) =>
    '<span class="avatar ' + (classe || '') + '" data-foto="' + escapar(nome) + '"><b>' + escapar(iniciais(nome).toUpperCase()) + '</b></span>';

  function aplicarFoto(elemento) {
    buscarFoto(elemento.dataset.foto).then((foto) => {
      if (!foto || !foto.imagem) return;
      const imagem = new Image();
      imagem.alt = elemento.dataset.foto;
      imagem.onload = () => {
        elemento.innerHTML = '';
        elemento.appendChild(imagem);
      };
      imagem.src = foto.imagem;
    });
  }

  // Carrega a foto só quando o avatar aparece na tela
  let observador = null;
  function observarFotos(raiz) {
    (raiz || document).querySelectorAll('[data-foto]:not([data-observado])').forEach((elemento) => {
      elemento.dataset.observado = '1';
      if (!('IntersectionObserver' in window)) { aplicarFoto(elemento); return; }
      if (!observador) {
        observador = new IntersectionObserver((entradas) => entradas.forEach((entrada) => {
          if (entrada.isIntersecting) { observador.unobserve(entrada.target); aplicarFoto(entrada.target); }
        }), { rootMargin: '200px' });
      }
      observador.observe(elemento);
    });
  }

  /* ---------- perfil do usuário (salvo só neste navegador, sem login) ---------- */
  const CHAVE_PERFIL = 'ufc_perfil_usuario';
  const perfilUsuario = {
    ler() { try { return JSON.parse(localStorage.getItem(CHAVE_PERFIL)) || {}; } catch (erro) { return {}; } },
    salvar(perfil) {
      try { localStorage.setItem(CHAVE_PERFIL, JSON.stringify(perfil)); return true; } catch (erro) { return false; }
    }
  };

  // Recorta a foto em quadrado e reduz o tamanho para caber no armazenamento do navegador
  function redimensionarImagem(arquivo, lado = 256) {
    return new Promise((resolver, rejeitar) => {
      if (!arquivo || !/^image\//.test(arquivo.type)) { rejeitar(new Error('Escolha um arquivo de imagem.')); return; }
      const leitor = new FileReader();
      leitor.onerror = () => rejeitar(new Error('Não foi possível ler o arquivo.'));
      leitor.onload = () => {
        const imagem = new Image();
        imagem.onerror = () => rejeitar(new Error('Imagem inválida.'));
        imagem.onload = () => {
          const quadro = document.createElement('canvas');
          quadro.width = quadro.height = lado;
          const menorLado = Math.min(imagem.width, imagem.height);
          quadro.getContext('2d').drawImage(
            imagem, (imagem.width - menorLado) / 2, (imagem.height - menorLado) / 2, menorLado, menorLado, 0, 0, lado, lado
          );
          resolver(quadro.toDataURL('image/jpeg', 0.85));
        };
        imagem.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  function desenharChip() {
    const chip = porId('chipUsuario');
    if (!chip) return;
    const perfil = perfilUsuario.ler();
    const nome = perfil.nome || 'Visitante';
    chip.innerHTML = '<span class="avatar pequeno">'
      + (perfil.foto ? '<img alt="" src="' + escapar(perfil.foto) + '">' : '<b>' + escapar(iniciais(nome).toUpperCase()) + '</b>')
      + '</span><span class="nome-usuario">' + escapar(nome) + '</span>';
  }

  return {
    configuracao, porId, escapar, formatarNumero, formatarDecimal, formatarData, normalizar, irPara, nomeCategoria,
    calcularIdade, carregarDados, CORES, configurarGraficos, opcoesGrafico,
    buscarFoto, htmlAvatar, iniciais, observarFotos, perfilUsuario, redimensionarImagem, desenharChip,
    modulos: {}, favoritos: null, lutadorParaFavoritar: null
  };
})();
