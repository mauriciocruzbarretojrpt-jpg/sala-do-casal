# 💖 Sala do Casal

**Jogar sozinho:** entre numa sala e clique em "🤖 Jogar sozinho com o robô". O robô joga todos os jogos
(e sai sozinho quando seu amor entra). O porquê de cada decisão de design está em `GAME_DESIGN.md`.

Sala com chat em tempo real e 9 minigames para 2 pessoas:
Tênis 3D (com os avatares de vocês), Corrida, Bilhar, Jogo da Velha, Ligue 4, Pedra-Papel-Tesoura, Jogo da Memória, Desenhe e Adivinhe e Sintonia do Casal.

O lobby é uma sala 3D (Three.js): cada um tem um bonequinho, anda com WASD/setas, joystick na tela
ou tocando no chão, e escolhe o jogo indo até a máquina de fliperama. As mensagens do chat aparecem
em balões em cima do boneco. O botão "☰ Jogos" abre a lista tradicional.

Avatares: bonequinho, "Ela" e "Ele" (feitos em código) e "Ela 3D", modelada por script no Blender
(`tools/blender/ela.py`) com esqueleto e animações Idle/Walk. Para gerar o GLB de novo:
```
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup --python tools\blender\ela.py -- public\models\ela.glb
```
(um 2º caminho opcional no final salva renders de prévia nessa pasta)

Controles no celular (inspirados nos jogos mobile de cada gênero, ver `GAME_DESIGN.md`):
- **Tênis:** o boneco corre sozinho; deslize para cima quando a bola chegar (lado = mira, na hora exata = golpe forte).
- **Corrida:** acelera sozinho; segure a metade esquerda/direita da tela para virar; 🛑 freia.
- **Bilhar:** toque na mesa para mirar, faixa de ajuste fino, puxe a barra de FORÇA e solte.
- **Desenho:** quem adivinha monta a palavra com o banco de letras.
- Botão ⛶ deixa em tela cheia (no Android também deita a tela nos jogos de ação).

Funciona no celular/tablet (touch): botões na tela na corrida, mira arrastando o dedo no bilhar
(a mesa fica na vertical com o celular em pé) e o chat pode ser escondido pelo botão 💬.

## Rodar
```
npm install
npm start
```
Abra http://localhost:3000, digite seu nome e um código de sala. Ela entra com o **mesmo código**.

## Como ela acessa
- **Mesma rede Wi-Fi:** use o endereço `http://192.168.x.x:3000` que aparece no terminal (o Windows pode pedir para liberar o Node no firewall).
- **Cada um na sua casa:** com o servidor rodando, abra um túnel em outro terminal e mande o link para ela:
  ```
  npx cloudflared tunnel --url http://localhost:3000
  ```
- **Online 24h (grátis):** suba a pasta para o GitHub e crie um "Web Service" no Render.com (build: `npm install`, start: `npm start`).

Dica: dá para mandar o link já com a sala: `http://.../?sala=NOSSOAMOR`.
