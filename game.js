
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const startBtn = document.getElementById("startBtn");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const stageEl = document.getElementById("stage");
  const modeLabel = document.getElementById("modeLabel");
  const storeDialog = document.getElementById("storeDialog");
  const storeMessage = document.getElementById("storeMessage");

  const CELL = 72;
  const COLS = 10;
  const ROWS = 10;

  let maze = [];
  let player = {x:0,y:0};
  let exit = {x:9,y:9};
  let traps = [];
  let running = false;
  let score = 0;
  let stage = 1;
  let timeLeft = 30;
  let lastTime = 0;
  let timerAccumulator = 0;
  let mode = "classic";
  let soundOn = true;

  const ownership = {
    pro_plus: localStorage.getItem("maze_tft_pro_plus") === "owned",
    ultra_plus: localStorage.getItem("maze_tft_ultra_plus") === "owned"
  };

  let best = Number(localStorage.getItem("maze_tft_best") || 0);
  bestEl.textContent = best;

  function randomInt(max){ return Math.floor(Math.random()*max); }

  function makeMaze(){
    maze = Array.from({length:ROWS}, () =>
      Array.from({length:COLS}, () => ({visited:false,walls:[true,true,true,true]}))
    );

    const stack = [];
    let current = {x:0,y:0};
    maze[0][0].visited = true;
    let visited = 1;

    while(visited < COLS*ROWS){
      const options = [];
      const dirs = [
        {dx:0,dy:-1,wall:0,opp:2},
        {dx:1,dy:0,wall:1,opp:3},
        {dx:0,dy:1,wall:2,opp:0},
        {dx:-1,dy:0,wall:3,opp:1}
      ];
      for(const d of dirs){
        const nx=current.x+d.dx, ny=current.y+d.dy;
        if(nx>=0&&nx<COLS&&ny>=0&&ny<ROWS&&!maze[ny][nx].visited){
          options.push({...d,nx,ny});
        }
      }
      if(options.length){
        const pick = options[randomInt(options.length)];
        maze[current.y][current.x].walls[pick.wall]=false;
        maze[pick.ny][pick.nx].walls[pick.opp]=false;
        stack.push(current);
        current={x:pick.nx,y:pick.ny};
        maze[current.y][current.x].visited=true;
        visited++;
      }else{
        current=stack.pop();
      }
    }

    traps = [];
    const trapCount = mode==="chaos" ? Math.min(18,5+stage) : Math.min(10,2+Math.floor(stage/2));
    while(traps.length<trapCount){
      const t={x:randomInt(COLS),y:randomInt(ROWS)};
      if((t.x||t.y) && !(t.x===exit.x&&t.y===exit.y) &&
         !traps.some(v=>v.x===t.x&&v.y===t.y)) traps.push(t);
    }

    player={x:0,y:0};
    exit={x:COLS-1,y:ROWS-1};
    timeLeft = mode==="zen" ? 999 : Math.max(14,32-stage);
  }

  function rotateMaze(){
    if(!running) return;
    const newMaze = Array.from({length:COLS},()=>Array(ROWS));
    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        const c=maze[y][x];
        newMaze[x][ROWS-1-y] = {
          visited:true,
          walls:[c.walls[3],c.walls[0],c.walls[1],c.walls[2]]
        };
      }
    }
    maze=newMaze;
    player={x:ROWS-1-player.y,y:player.x};
    exit={x:ROWS-1-exit.y,y:exit.x};
    traps=traps.map(t=>({x:ROWS-1-t.y,y:t.x}));
    beep(240,0.06);
  }

  function move(dx,dy){
    if(!running) return;
    const c=maze[player.y][player.x];
    let wallIndex = dx===1?1:dx===-1?3:dy===1?2:0;
    if(c.walls[wallIndex]) {
      beep(110,0.03);
      return;
    }
    player.x+=dx; player.y+=dy;

    if(traps.some(t=>t.x===player.x&&t.y===player.y)){
      score=Math.max(0,score-25);
      scoreEl.textContent=score;
      player={x:0,y:0};
      beep(90,0.12);
    } else {
      beep(520,0.025);
    }

    if(player.x===exit.x&&player.y===exit.y){
      score += 100 + Math.max(0,Math.floor(timeLeft))*3;
      stage++;
      scoreEl.textContent=score;
      stageEl.textContent=stage;
      if(score>best){
        best=score;
        localStorage.setItem("maze_tft_best",best);
        bestEl.textContent=best;
      }
      beep(880,0.16);
      makeMaze();
    }
  }

  function endGame(){
    running=false;
    overlay.classList.remove("hidden");
    overlayTitle.textContent="Run Over";
    overlayText.textContent=`Final score: ${score}. Reach the exit faster and avoid red traps.`;
    startBtn.textContent="Play Again";
  }

  function startGame(){
    score=0; stage=1;
    scoreEl.textContent=score;
    stageEl.textContent=stage;
    makeMaze();
    running=true;
    overlay.classList.add("hidden");
    lastTime=performance.now();
    requestAnimationFrame(loop);
  }

  function draw(){
    const w=canvas.width,h=canvas.height;
    ctx.clearRect(0,0,w,h);

    const bg=ctx.createLinearGradient(0,0,w,h);
    bg.addColorStop(0,"#071426");
    bg.addColorStop(1,"#020617");
    ctx.fillStyle=bg;
    ctx.fillRect(0,0,w,h);

    ctx.lineWidth=5;
    ctx.lineCap="round";

    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        const c=maze[y]?.[x];
        if(!c) continue;
        const px=x*CELL, py=y*CELL;

        ctx.fillStyle=((x+y)%2===0)?"rgba(56,189,248,.025)":"rgba(167,139,250,.025)";
        ctx.fillRect(px,py,CELL,CELL);

        ctx.strokeStyle="rgba(148,163,184,.52)";
        ctx.beginPath();
        if(c.walls[0]){ctx.moveTo(px,py);ctx.lineTo(px+CELL,py)}
        if(c.walls[1]){ctx.moveTo(px+CELL,py);ctx.lineTo(px+CELL,py+CELL)}
        if(c.walls[2]){ctx.moveTo(px,py+CELL);ctx.lineTo(px+CELL,py+CELL)}
        if(c.walls[3]){ctx.moveTo(px,py);ctx.lineTo(px,py+CELL)}
        ctx.stroke();
      }
    }

    for(const t of traps){
      const cx=t.x*CELL+CELL/2, cy=t.y*CELL+CELL/2;
      ctx.fillStyle="#fb7185";
      ctx.beginPath();
      ctx.moveTo(cx,cy-18);ctx.lineTo(cx+18,cy+16);ctx.lineTo(cx-18,cy+16);
      ctx.closePath();ctx.fill();
    }

    const ex=exit.x*CELL+CELL/2, ey=exit.y*CELL+CELL/2;
    const pulse=18+Math.sin(performance.now()/170)*5;
    ctx.strokeStyle="#4ade80";
    ctx.lineWidth=7;
    ctx.beginPath();ctx.arc(ex,ey,pulse,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle="#dcfce7";
    ctx.beginPath();ctx.arc(ex,ey,8,0,Math.PI*2);ctx.fill();

    const px=player.x*CELL+CELL/2, py=player.y*CELL+CELL/2;
    ctx.shadowBlur=22; ctx.shadowColor="#38bdf8";
    ctx.fillStyle="#7dd3fc";
    ctx.beginPath();ctx.arc(px,py,15,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;

    if(mode!=="zen"){
      ctx.fillStyle="rgba(15,23,42,.86)";
      ctx.fillRect(18,18,155,44);
      ctx.fillStyle="#f8fafc";
      ctx.font="bold 23px Segoe UI";
      ctx.fillText(`Time: ${Math.ceil(timeLeft)}`,32,48);
    }else{
      ctx.fillStyle="rgba(15,23,42,.86)";
      ctx.fillRect(18,18,155,44);
      ctx.fillStyle="#f8fafc";
      ctx.font="bold 21px Segoe UI";
      ctx.fillText("No Timer",38,48);
    }
  }

  function loop(now){
    if(!running) return;
    const dt=Math.min(.05,(now-lastTime)/1000);
    lastTime=now;

    if(mode!=="zen"){
      timeLeft-=dt;
      if(timeLeft<=0){ draw(); endGame(); return; }
    }

    if(mode==="chaos"){
      timerAccumulator+=dt;
      if(timerAccumulator>5.5){
        timerAccumulator=0;
        rotateMaze();
      }
    }

    draw();
    requestAnimationFrame(loop);
  }

  function beep(freq,duration){
    if(!soundOn) return;
    try{
      const ac=new (window.AudioContext||window.webkitAudioContext)();
      const o=ac.createOscillator(), g=ac.createGain();
      o.frequency.value=freq;
      g.gain.setValueAtTime(.05,ac.currentTime);
      g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+duration);
      o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+duration);
    }catch(e){}
  }

  function setMode(next){
    if(next==="zen"&&!ownership.pro_plus&&!ownership.ultra_plus){
      openStore("Zen Pro requires Pro Plus or Ultra Plus.");
      return;
    }
    if(next==="chaos"&&!ownership.ultra_plus){
      openStore("Shift Ultra requires Ultra Plus.");
      return;
    }
    mode=next;
    modeLabel.textContent=next==="classic"?"Classic":next==="zen"?"Zen Pro":"Shift Ultra";
    document.querySelectorAll(".mode").forEach(b=>b.classList.remove("active"));
    document.getElementById(next==="classic"?"classicBtn":next==="zen"?"zenBtn":"chaosBtn").classList.add("active");
  }

  function refreshOwnership(){
    const zenBtn=document.getElementById("zenBtn");
    const chaosBtn=document.getElementById("chaosBtn");
    zenBtn.classList.toggle("locked",!(ownership.pro_plus||ownership.ultra_plus));
    chaosBtn.classList.toggle("locked",!ownership.ultra_plus);
    document.querySelectorAll(".buy-btn").forEach(btn=>{
      const id=btn.dataset.product;
      const owned=id==="pro_plus"?(ownership.pro_plus||ownership.ultra_plus):ownership.ultra_plus;
      btn.textContent=owned?"Owned":"Unlock "+(id==="pro_plus"?"Pro Plus":"Ultra Plus");
      btn.disabled=owned;
    });
  }

  function openStore(message=""){
    storeMessage.textContent=message;
    refreshOwnership();
    storeDialog.showModal();
  }

  document.addEventListener("keydown",e=>{
    const k=e.key.toLowerCase();
    if(["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"," ","r"].includes(k)) e.preventDefault();
    if(k==="arrowup"||k==="w") move(0,-1);
    else if(k==="arrowdown"||k==="s") move(0,1);
    else if(k==="arrowleft"||k==="a") move(-1,0);
    else if(k==="arrowright"||k==="d") move(1,0);
    else if(k==="r") rotateMaze();
    else if(k===" "&&!running) startGame();
  });

  startBtn.addEventListener("click",startGame);
  document.getElementById("openStore").addEventListener("click",()=>openStore());
  document.getElementById("closeStore").addEventListener("click",()=>storeDialog.close());
  document.getElementById("classicBtn").addEventListener("click",()=>setMode("classic"));
  document.getElementById("zenBtn").addEventListener("click",()=>setMode("zen"));
  document.getElementById("chaosBtn").addEventListener("click",()=>setMode("chaos"));
  document.getElementById("soundBtn").addEventListener("click",e=>{
    soundOn=!soundOn;
    e.currentTarget.textContent=`Sound: ${soundOn?"On":"Off"}`;
  });

  document.querySelectorAll(".buy-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id=btn.dataset.product;
      ownership[id]=true;
      if(id==="ultra_plus") ownership.pro_plus=true;
      localStorage.setItem("maze_tft_"+id,"owned");
      if(id==="ultra_plus") localStorage.setItem("maze_tft_pro_plus","owned");
      storeMessage.textContent=(id==="pro_plus"?"Pro Plus":"Ultra Plus")+" unlocked permanently in this demo.";
      refreshOwnership();
    });
  });

  document.getElementById("restoreBtn").addEventListener("click",()=>{
    ownership.pro_plus=localStorage.getItem("maze_tft_pro_plus")==="owned";
    ownership.ultra_plus=localStorage.getItem("maze_tft_ultra_plus")==="owned";
    storeMessage.textContent=(ownership.pro_plus||ownership.ultra_plus)
      ?"Purchases restored."
      :"No purchases were found in this demo.";
    refreshOwnership();
  });

  refreshOwnership();
  makeMaze();
  draw();
})();
