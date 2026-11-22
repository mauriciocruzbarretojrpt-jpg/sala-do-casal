# 🎮 Game design da Sala do Casal

Este documento resume o que deixa um jogo divertido e como cada ideia foi aplicada aqui.

## 1. Os princípios

**MDA: Mecânica → Dinâmica → Estética.** O designer só controla as *mecânicas* (regras, controles). Delas
nascem as *dinâmicas* (o que acontece quando as pessoas jogam) e, por fim, a *estética*: a emoção sentida
(desafio, descoberta, expressão, companheirismo). Para um jogo de casal, a emoção-alvo é **companheirismo
com provocação carinhosa**: rir junto, se zoar, comemorar.

**Escolhas significativas.** Pessoas se entediam quando não têm agência. Toda ação deve ter uma decisão
interessante: arriscar ou jogar seguro, mirar no canto ou no meio, pegar o turbo fora da linha ideal.

**Flow (desafio ≈ habilidade).** Fácil demais entedia, difícil demais frustra. A dificuldade deve
acompanhar o jogador, e a partida deve ficar disputada até o fim.

**Fácil de aprender, difícil de dominar.** O básico tem que funcionar no primeiro toque (bom para quem joga
pelo celular), mas precisa existir um "algo a mais" para quem quer ficar bom: o *teto de habilidade*.

**Juice / game feel.** Feedback exagerado e multissensorial (olhos, ouvidos e mãos) faz cada ação parecer
importante: som em toda interação, partículas, tremor, animação de impacto. Mas o juice deve *ecoar a
mecânica central* e não pode esconder o que importa.

**Tensão crescente e ritmo.** Trocas de bola que aceleram, contagem regressiva e "match point" criam picos.
Depois de um pico vem um respiro (celebração, placar).

**Laço central + meta-laço.** Laço central: jogar uma rodada (segundos a minutos). Meta-laço: o motivo para
jogar mais uma, como um placar histórico do casal, a revanche e a rivalidade.

**Elástico com moderação.** Aproximar o jogo de quem está perdendo mantém tudo disputado, mas se for
perceptível o jogador sente que foi punido por jogar bem. Deve ser sutil.

**Interação social.** Em jogo de casal, o jogo é uma desculpa para interagir: emotes, balões de chat,
provocação no placar, comemorar juntos.

## 2. Como foi aplicado

| Princípio | Onde |
|---|---|
| Juice: som em toda ação | Módulo de efeitos `fx.js` com sons sintetizados (rebatida, quique, ponto, vitória, derrota, peça, carta, tacada, caçapa, turbo, contagem, mensagem) e botão 🔊/🔇 |
| Juice: celebração | Confete de corações na vitória, tremor de tela ao perder ponto, número do rally pulsando |
| Teto de habilidade | **Tênis:** além da rebatida automática, há o **golpe com timing** (Espaço/botão 🎾): no momento certo a bola sai mais rápida e mais angulada ("Na mosca! 💥") |
| Tensão crescente | Tênis: contador de rally 🔥 e bola acelerando; aviso de "Match point!" |
| Escolha significativa | **Corrida:** turbos ⚡ fora da linha ideal (arriscar o caminho mais longo para ganhar velocidade) |
| Informação clara | Corrida: posição 1º/2º na tela; Velha: destaca a linha vencedora |
| Flow / elástico sutil | Bot da corrida acelera um pouco quando fica para trás e alivia quando abre vantagem; o bot do tênis erra mais quando está ganhando |
| Meta-laço | **Placar do casal** no lobby: vitórias de cada um por jogo, visível nas máquinas |
| Social | **Emotes** no lobby (💖 😘 😂 👋) que sobem do boneco com som; o robô responde e conversa |
| Jogar sozinho | **Robô 🤖** que entra na sala e joga todos os 10 jogos, com IA própria para cada um |

## 3. Referências de jogos mobile (e o que foi adotado)

| Gênero | Como os jogos mobile fazem | O que adotamos |
|---|---|---|
| **Sinuca** (estilo 8 Ball Pool) | Mira arrastando o taco em volta da bola + roda de ajuste fino; **barra de força separada que se puxa para baixo**; linhas-guia mostrando para onde vai a bola-alvo e a branca | Mira por toque em volta da branca, faixa de ajuste fino, barra de força lateral (puxar e soltar), linha-guia com bola-fantasma e as duas trajetórias |
| **Tênis** (estilo Tennis Clash) | Jogador **se posiciona sozinho**; você **desliza o dedo para rebater**: a direção do swipe define o lado, o comprimento define a força; acertar o timing é a habilidade | No celular: movimento assistido + swipe para rebater (direção e força pelo gesto). No PC: teclado + Espaço continuam |
| **Corrida top-down** | **Aceleração automática**, segurar lado esquerdo/direito da tela para virar, botões de turbo/freio, **minimapa no canto** | Câmera seguindo o carro com zoom, minimapa, marcas de pneu; no celular acelera sozinho e você segura as laterais da tela para virar |
| **Desenhe e adivinhe** (estilo Draw Something) | Quem desenha escolhe entre **3 palavras (fácil/média/difícil)** com pontos diferentes; quem adivinha monta a resposta com um **banco de letras** (letras da palavra + algumas falsas) | Escolha de 3 palavras com 1/2/3 pontos, cronômetro, dicas que vão revelando letras, banco de letras tocáveis, desfazer traço |
| **Ligue 4 / Velha / Memória** | Peças "caem" com física, prévia da coluna, cartas viram em 3D, combos e contador de jogadas | Animação de queda com quique, destaque da linha vencedora, cartas com flip 3D e combo |
| **Pedra-papel-tesoura / quiz de casal** | Melhor de 3 com contagem "jo-ken-pô"; quiz de casal com X perguntas e **porcentagem de compatibilidade** no final | Melhor de 3 com contagem animada; Sintonia em 10 perguntas com resultado em % |

## Fontes
- [MDA framework (Wikipedia)](https://Www.Wikipedia.org/wiki/MDA_framework)
- [Game Loops & Decisions (The Sandbox docs)](https://docs.sandbox.game/en/creator/game-maker/creative-guides/experience-design-techniques/game-design/game-loops-and-decisions)
- [Game Design Principles in Your Favorite Games (Intel)](https://intel.com/content/www/us/en/gaming/resources/game-design-principles-in-games.html)
- [Squeezing more juice out of your game design (Game Developer)](https://gamedeveloper.com/design/squeezing-more-juice-out-of-your-game-design-)
- [Juicy game design: survey (arXiv 2011.09201)](https://arxiv.org/abs/2011.09201)
- [The "Juice" Factor: Designing Game Feel (Hackread)](https://hackread.com/the-juice-factor-designing-game-feel/)
- [Dynamic game difficulty balancing (Wikipedia)](https://en.wikipedia.org/wiki/Dynamic_game_difficulty_balancing)
- [The secrets of dynamic difficulty adjustment (Game Developer)](https://gamedeveloper.com/design/more-than-meets-the-eye-the-secrets-of-dynamic-difficulty-adjustment)
- [8 Ball Pool: controles básicos (Miniclip)](https://support.miniclip.com/hc/en-us/articles/35451942766865-Basic-Controls-Improving-your-skills-8-Ball-Pool)
- [8 Ball Pool: efeito/spin (Miniclip)](https://support.miniclip.com/hc/en-us/articles/35451960569361-Advanced-Plays-Spins-8-Ball-Pool)
- [How Tennis Clash scored a golden set (GameAnalytics)](https://gameanalytics.com/blog/how-tennis-clash-scored-a-golden-set/)
- [Tennis Mobile (GamePix)](https://www.gamepix.com/play/tennis-mobile)
- [VT Tennis review (Pocket Gamer)](https://www.pocketgamer.com/vt-tennis/review/)
- [Draw Something review (Pocket Gamer)](https://www.pocketgamer.com/draw-something/review/)
- [Draw Something review (iMore)](https://www.imore.com/review-draw-something-the-best-way-to-show-bad-art)
- [GT Drift Most Wanted (Drifted)](https://www.drifted.com/gt-drift-most-wanted/)
- [Mini Motor Racing (Windows Central)](https://www.windowscentral.com/mini-motor-racing-small-scale-racing-windows-phone-8)
- [F1 Mobile Racing: controles (Codemasters)](https://codemasters.helpshift.com/hc/en/3-f1-mobile-racing/faq/64-what-driving-controls-are-available)
