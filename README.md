# 🥊 UFC Dashboard — Análise de Dados e Estatísticas

Repositório dedicado ao desenvolvimento de um dashboard interativo para análise de dados históricos do **Ultimate Fighting Championship (UFC)**, permitindo explorar estatísticas de lutas, desempenho dos atletas e informações sobre eventos da organização.

O projeto transforma dados históricos em visualizações interativas, facilitando a comparação entre lutadores e a identificação de tendências ao longo dos anos.

**🌐 Acesse o projeto:** [UFC Dashboard](https://ufc-dashboard.vercel.app/)

---

## 📊 Funcionalidades Desenvolvidas

O projeto conta com três áreas principais, cada uma voltada a uma experiência diferente de análise:

### 1. Visão Geral
- **Indicadores Gerais:** Apresenta o total de lutas, eventos, lutadores e percentual de resultados antecipados.
- **Métodos de Vitória:** Visualiza a distribuição de resultados por KO/TKO, finalização e decisão dos juízes.
- **Evolução Histórica:** Demonstra a quantidade de lutas realizadas ao longo dos anos.
- **Categorias de Peso:** Compara o volume de lutas entre as diferentes categorias.
- **Ranking de Vitórias:** Destaca os lutadores com maior número de vitórias, considerando os filtros selecionados.

### 2. Lutadores
- **Busca e Filtros:** Permite pesquisar atletas e filtrar por categoria de peso.
- **Ranking de Atletas:** Organiza os lutadores por vitórias, quantidade de lutas e taxa de finalização.
- **Perfil Individual:** Apresenta informações físicas, cartel, biografia e estatísticas de cada atleta.
- **Estatísticas de Combate:** Exibe dados sobre golpes, precisão, vitórias e métodos de finalização.

### 3. Minha Área
- **Perfil Personalizado:** Permite cadastrar nome e foto de usuário.
- **Lutadores Favoritos:** Possibilita adicionar, editar, avaliar e remover atletas da lista pessoal.
- **Anotações e Previsões:** Permite registrar observações e previsões sobre os lutadores.
- **Lutador Preferido:** Destaca o atleta escolhido pelo usuário, apresentando suas principais estatísticas.

---

## 🛠️ Tecnologias e Ferramentas

- **HTML5:** Estruturação das páginas e componentes do dashboard.
- **CSS3:** Estilização da interface, organização dos componentes e responsividade.
- **JavaScript:** Implementação da lógica, manipulação dos dados e funcionalidades interativas.
- **Chart.js:** Criação dos gráficos e visualizações estatísticas.
- **Back4App:** Armazenamento e gerenciamento dos lutadores favoritos.
- **Wikipedia API:** Consulta de fotografias e biografias dos atletas.
- **Vercel:** Hospedagem e publicação da aplicação.

---

## 📁 Estrutura do Projeto

```text
ufc-dashboard/
│
├── data/                 # Bases de dados utilizadas
│
├── js/                   # Scripts e funcionalidades
│   ├── nucleo.js         # Funções e recursos compartilhados
│   ├── visao-geral.js    # Indicadores e gráficos
│   ├── lutadores.js      # Rankings e perfis dos atletas
│   ├── minha-area.js     # Perfil e gerenciamento de favoritos
│   └── principal.js      # Inicialização e navegação
│
├── config.js             # Configurações da aplicação
├── estilo.css            # Estilização da interface
└── index.html             # Página principal
```

---

## 📚 Fonte dos Dados

A base de dados utilizada no projeto foi obtida no **Kaggle**, a partir do conjunto *UFC datasets 1994–2025*, considerando somente os eventos realizados pelo UFC.

Outras informações complementares são obtidas por meio da API da Wikipedia, utilizada para consultar fotografias e biografias dos lutadores.

---

## 🚀 Como Executar o Projeto

1. Certifique-se de ter um navegador atualizado instalado.
2. Clone este repositório utilizando o comando abaixo:

```bash
git clone https://github.com/David-LP0705/ufc-dashboard.git
```

3. Acesse a pasta do projeto:

```bash
cd ufc-dashboard
```

4. Abra a pasta no VS Code.
5. Execute o arquivo `index.html` utilizando a extensão **Live Server** para iniciar a aplicação localmente.

**Observação:** Para utilizar o gerenciamento de favoritos com Back4App, é necessário configurar as credenciais e os serviços correspondentes. Sem essa configuração, a aplicação possui uma alternativa de armazenamento local no navegador.

---

## 🎓 Sobre o Projeto

Projeto acadêmico desenvolvido para o curso de **Sistemas para Internet — UNICAP**, com o objetivo de aplicar conceitos de desenvolvimento web, manipulação de dados e visualização de informações por meio de uma aplicação interativa.

