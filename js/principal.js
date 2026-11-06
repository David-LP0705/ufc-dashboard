/* Navegação por hash: #/visao, #/lutadores, #/lutador/N e #/minha. */
(function () {
  const { porId } = UFC;
  const PAGINAS = ['visao', 'lutadores', 'minha'];
  let ultimoHash = null;

  function descobrirDestino() {
    const [rota, argumento] = (location.hash || '#/visao').replace(/^#\/?/, '').split('/');
    if (rota === 'lutador') return { pagina: 'lutadores', rota, argumento };
    if (PAGINAS.includes(rota)) return { pagina: rota, rota, argumento };
    return { pagina: 'visao', rota: 'visao', argumento: null };
  }

  async function navegar() {
    const destino = descobrirDestino();
    PAGINAS.forEach((pagina) => { porId('pagina-' + pagina).hidden = pagina !== destino.pagina; });
    document.querySelectorAll('#menu a').forEach((link) => {
      link.classList.toggle('ativo', link.dataset.pagina === destino.pagina);
    });

    const secao = porId('pagina-' + destino.pagina);
    secao.querySelectorAll('.erro-dados').forEach((aviso) => aviso.remove());
    try {
      await UFC.modulos[destino.pagina].abrir(destino.rota, destino.argumento);
    } catch (erro) {
      secao.insertAdjacentHTML('afterbegin',
        '<div class="cartao aviso erro-dados">Não foi possível carregar os dados (' + UFC.escapar(erro.message)
        + '). Abra o site por um servidor (Live Server ou o link publicado), não direto pelo arquivo.</div>');
    }
    if (ultimoHash !== location.hash) window.scrollTo(0, 0);
    ultimoHash = location.hash;
  }

  UFC.configurarGraficos();
  UFC.desenharChip();
  window.addEventListener('hashchange', navegar);
  navegar();
})();
