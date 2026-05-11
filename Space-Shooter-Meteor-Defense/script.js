const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const music = document.getElementById("bgMusic");

const keys = {};
let gameState = "start";
let highScore = 0;
try { highScore = parseInt(localStorage.getItem("spaceShooterHighScore")) || 0; } catch(e){}
let screenShake = 0;

const player = { x: canvas.width/2-30, y: canvas.height-95, width: 60, height: 80, speed: 7 };
let bullets=[], meteors=[], stars=[], particles=[], planets=[];
let score=0, lives=3, level=1;
let maxHealth=100, health=100, damagePerHit=25;
let meteorSpawnTimer=0, meteorSpawnInterval=85, meteorsPerSpawn=1;
let planetSpawnTimer=0, planetSpawnInterval=500;
let bulletCooldown=0, difficultyTimer=0, blink=0;
let isMuted=false, isPaused=false;

let pauseResumeBtn=null, pauseRestartBtn=null, gameoverRestartBtn=null;


let bigMeteorTimer = 0;


let celebration = null;

function startCelebration(){
  let cp = [];
  for(let i=0;i<80;i++){
    const angle = Math.random()*Math.PI*2;
    const speed = Math.random()*6+2;
    const colors = ["#f59e0b","#ef4444","#a855f7","#22c55e","#38bdf8","#f472b6","#fde047","#ffffff"];
    cp.push({
      x: canvas.width/2, y: canvas.height/2,
      dx: Math.cos(angle)*speed, dy: Math.sin(angle)*speed - 3,
      size: Math.random()*5+3,
      color: colors[Math.floor(Math.random()*colors.length)],
      life: 180, maxLife: 180, gravity: 0.08
    });
  }
  celebration = {timer:220, maxTimer:220, particles:cp};
}

function updateCelebration(){
  if(!celebration) return;
  celebration.timer--;
  for(let i=celebration.particles.length-1;i>=0;i--){
    let p=celebration.particles[i];
    p.x+=p.dx; p.y+=p.dy; p.dy+=p.gravity; p.life--;
    if(p.life<=0) celebration.particles.splice(i,1);
  }
  if(celebration.timer<=0) celebration=null;
}

function drawCelebration(){
  if(!celebration) return;
  for(let p of celebration.particles){
    ctx.save(); ctx.globalAlpha=p.life/p.maxLife;
    ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
  const alpha = celebration.timer>60 ? 1 : celebration.timer/60;
  ctx.save(); ctx.globalAlpha=alpha; ctx.textAlign="center"; ctx.textBaseline="middle";
  const scale = celebration.timer>200 ? (220-celebration.timer)/20 : 1;
  ctx.translate(canvas.width/2, canvas.height/2-100); ctx.scale(scale,scale);
  ctx.font="bold 46px Arial"; ctx.shadowBlur=30; ctx.shadowColor="#fcd34d"; ctx.fillStyle="#fde047";
  ctx.fillText("NEW RECORD!", 0, 0); ctx.shadowBlur=0;
  ctx.font="bold 24px Arial"; ctx.fillStyle="#f8fafc"; ctx.fillText("Score: "+score, 0, 52);
  ctx.restore();
}


let combo = 0, comboTimer = 0;
const COMBO_TIMEOUT = 180;
let comboPopups = [];


let announcements = [];

function showAnnouncement(text, color, shadowColor, duration=150){
  announcements.push({text, color, shadowColor, timer: duration, maxTimer: duration, scale: 0});
}

function updateAnnouncements(){
  for(let i=announcements.length-1;i>=0;i--){
    let a = announcements[i];
    a.timer--;
    if(a.timer > a.maxTimer - 20) a.scale += (1 - a.scale) * 0.25;
    else a.scale = 1;
    if(a.timer <= 0) announcements.splice(i,1);
  }
}

function drawAnnouncements(){
  const cx = canvas.width/2, cy = canvas.height/2;
  let offset = 0;
  for(let a of announcements){
    const alpha = a.timer < 40 ? a.timer/40 : 1;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.translate(cx, cy - 60 + offset); ctx.scale(a.scale, a.scale);
    ctx.font = "bold 54px Arial"; ctx.shadowBlur = 30; ctx.shadowColor = a.shadowColor;
    ctx.fillStyle = a.color; ctx.fillText(a.text, 0, 0); ctx.shadowBlur = 0;
    ctx.strokeStyle = a.shadowColor; ctx.lineWidth = 2; ctx.globalAlpha = alpha * 0.5;
    const tw = ctx.measureText(a.text).width * 0.5;
    ctx.beginPath(); ctx.moveTo(-tw, 34); ctx.lineTo(tw, 34); ctx.stroke();
    ctx.restore(); offset += 70;
  }
}


let hudNotifs = [];

function showHudNotif(text, color, duration=120){
  hudNotifs.push({text, color, timer: duration, maxTimer: duration, y: 145});
}

function updateHudNotifs(){
  for(let i=hudNotifs.length-1;i>=0;i--){
    hudNotifs[i].timer--; hudNotifs[i].y -= 0.3;
    if(hudNotifs[i].timer <= 0) hudNotifs.splice(i,1);
  }
}

function drawHudNotifs(){
  for(let n of hudNotifs){
    const alpha = n.timer < 30 ? n.timer/30 : 1;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.font = "bold 14px Arial"; ctx.fillStyle = n.color;
    ctx.fillText(n.text, 25, n.y); ctx.restore();
  }
}


function addCombo(){
  if(combo < 5) combo++;
  else combo = 1;
  comboTimer = COMBO_TIMEOUT;
  if(combo >= 2){
    comboPopups.push({text:"COMBO x"+combo, x:player.x+player.width/2, y:player.y-30, timer:60, maxTimer:60});
  }
}

function resetCombo(){
  if(combo >= 5) showHudNotif("Combo ended! (x"+combo+")", "#94a3b8");
  combo = 0; comboTimer = 0;
}

function updateCombo(){
  if(combo > 0){ comboTimer--; if(comboTimer <= 0) resetCombo(); }
  for(let i=comboPopups.length-1;i>=0;i--){
    comboPopups[i].timer--; comboPopups[i].y -= 1;
    if(comboPopups[i].timer <= 0) comboPopups.splice(i,1);
  }
}

function drawComboPopups(){
  for(let p of comboPopups){
    const alpha = p.timer / p.maxTimer;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "bold 20px Arial"; ctx.shadowBlur = 10; ctx.shadowColor = "#a855f7";
    ctx.fillStyle = "#f0abfc"; ctx.fillText(p.text, p.x, p.y); ctx.restore();
  }
}

function drawComboBar(){
  if(combo < 2) return;
  const cx = canvas.width/2;
  const timeRatio = comboTimer / COMBO_TIMEOUT;
  const barW = 160, barH = 14;
  const bx = cx - barW/2, by = canvas.height - 30;
  ctx.save();
  ctx.fillStyle = "rgba(15,23,42,0.8)"; ctx.fillRect(bx-2, by-2, barW+4, barH+4);
  ctx.fillStyle = "#4c1d95"; ctx.fillRect(bx, by, barW, barH);
  ctx.fillStyle = "#a855f7"; ctx.fillRect(bx, by, barW * timeRatio, barH);
  ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 1.5; ctx.strokeRect(bx-2, by-2, barW+4, barH+4);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "bold 13px Arial"; ctx.fillStyle = "#f0abfc";
  ctx.shadowBlur = 8; ctx.shadowColor = "#a855f7";
  ctx.fillText("COMBO x" + combo, cx, by + barH/2);
  ctx.restore();
}


function playMusic(){ if(music){ music.volume=0.4; music.muted=isMuted; music.play().catch(()=>{}); } }
function stopMusic(){ if(music){ music.pause(); music.currentTime=0; } }


function randomBetween(a,b){ return Math.random()*(b-a)+a; }

function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function inBtn(mx,my,btn){ return btn && mx>=btn.x && mx<=btn.x+btn.w && my>=btn.y && my<=btn.y+btn.h; }


function createStars(){
  stars=[];
  for(let i=0;i<150;i++) stars.push({
    x:Math.random()*canvas.width, y:Math.random()*canvas.height,
    size:Math.random()*2.2+0.4, speed:Math.random()*0.9+0.2, alpha:Math.random()*0.8+0.2
  });
}
createStars();

function updateStars(){
  for(let s of stars){ s.y+=s.speed; if(s.y>canvas.height){ s.y=-2; s.x=Math.random()*canvas.width; } }
}

function drawBackground(){
  const g=ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0,"#020b2d"); g.addColorStop(0.5,"#08143f"); g.addColorStop(1,"#030814");
  ctx.fillStyle=g; ctx.fillRect(0,0,canvas.width,canvas.height);
  drawNebula(180,120,220,"rgba(59,130,246,0.10)");
  drawNebula(760,200,260,"rgba(147,51,234,0.09)");
  drawNebula(420,500,240,"rgba(56,189,248,0.08)");
}

function drawNebula(x,y,r,c){
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,c); g.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
}

function drawStars(){
  for(let s of stars){
    ctx.save(); ctx.globalAlpha=s.alpha; ctx.fillStyle="#fff";
    ctx.fillRect(s.x,s.y,s.size,s.size); ctx.restore();
  }
}


document.addEventListener("keydown", e=>{
  keys[e.key]=true;
  if(e.code==="Space") keys["Space"]=true;
  if(gameState==="start" && e.key==="Enter"){ gameState="playing"; isPaused=false; playMusic(); }
  if(gameState==="gameover" && e.code==="Space") resetGame();
  if(e.key==="m"||e.key==="M"){ isMuted=!isMuted; if(music) music.muted=isMuted; }
  if(e.key==="p"||e.key==="P"||e.key==="Escape") togglePause();
  if(e.code==="Space"||e.key==="ArrowLeft"||e.key==="ArrowRight") e.preventDefault();
});

document.addEventListener("keyup", e=>{
  keys[e.key]=false;
  if(e.code==="Space") keys["Space"]=false;
});

canvas.addEventListener("click", e=>{
  const rect=canvas.getBoundingClientRect();
  const scaleX=canvas.width/rect.width, scaleY=canvas.height/rect.height;
  const mx=(e.clientX-rect.left)*scaleX, my=(e.clientY-rect.top)*scaleY;
  const size=42, pad=12;
  const muteX=canvas.width-size*2-pad*2, pauseX=canvas.width-size-pad, iy=pad;
  if(mx>=muteX&&mx<=muteX+size&&my>=iy&&my<=iy+size){ isMuted=!isMuted; if(music) music.muted=isMuted; return; }
  if(mx>=pauseX&&mx<=pauseX+size&&my>=iy&&my<=iy+size){ togglePause(); return; }
  if(gameState==="paused"){
    if(inBtn(mx,my,pauseResumeBtn)){ togglePause(); return; }
    if(inBtn(mx,my,pauseRestartBtn)){ resetGame(); return; }
  }
  if(gameState==="gameover"){
    if(inBtn(mx,my,gameoverRestartBtn)){ resetGame(); return; }
  }
});

function togglePause(){
  if(gameState==="playing"){ gameState="paused"; isPaused=true; if(music) music.pause(); }
  else if(gameState==="paused"){ gameState="playing"; isPaused=false; if(!isMuted) playMusic(); }
}


function resetGame(){
  player.x=canvas.width/2-30; player.y=canvas.height-95;
  bullets=[]; meteors=[]; particles=[]; planets=[];
  score=0; lives=3; level=1; health=100;
  meteorSpawnInterval=85; meteorsPerSpawn=1; meteorSpawnTimer=0;
  planetSpawnTimer=0; difficultyTimer=0; bulletCooldown=0;
  bigMeteorTimer=0; celebration=null;
  combo=0; comboTimer=0; comboPopups=[];
  announcements=[]; hudNotifs=[];
  gameState="playing"; isPaused=false;
  if(music) music.currentTime=0;
  playMusic();
}


function movePlayer(){
  if(keys["ArrowLeft"]&&player.x>12) player.x-=player.speed;
  if(keys["ArrowRight"]&&player.x+player.width<canvas.width-12) player.x+=player.speed;
}

function drawPlayer(){
  const x=player.x, y=player.y, w=player.width, h=player.height;
  ctx.save();
  const eg=ctx.createRadialGradient(x+w/2,y+h-5,4,x+w/2,y+h-5,28);
  eg.addColorStop(0,"rgba(59,130,246,0.9)"); eg.addColorStop(1,"rgba(59,130,246,0)");
  ctx.fillStyle=eg; ctx.beginPath(); ctx.arc(x+w/2,y+h-2,26,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(96,165,250,0.55)";
  ctx.beginPath(); ctx.ellipse(x+18,y+h-8,6,18,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x+w-18,y+h-8,6,18,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#cbd5e1";
  ctx.beginPath(); ctx.moveTo(x+8,y+52); ctx.lineTo(x-10,y+75); ctx.lineTo(x+18,y+70); ctx.lineTo(x+24,y+48); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x+w-8,y+52); ctx.lineTo(x+w+10,y+75); ctx.lineTo(x+w-18,y+70); ctx.lineTo(x+w-24,y+48); ctx.closePath(); ctx.fill();
  const bg=ctx.createLinearGradient(x,y,x+w,y+h);
  bg.addColorStop(0,"#f8fafc"); bg.addColorStop(0.5,"#cbd5e1"); bg.addColorStop(1,"#94a3b8");
  ctx.fillStyle=bg;
  ctx.beginPath(); ctx.moveTo(x+w/2,y); ctx.lineTo(x+10,y+56); ctx.lineTo(x+18,y+h); ctx.lineTo(x+w-18,y+h); ctx.lineTo(x+w-10,y+56); ctx.closePath(); ctx.fill();
  const cg=ctx.createLinearGradient(x,y+10,x,y+50);
  cg.addColorStop(0,"#93c5fd"); cg.addColorStop(1,"#1d4ed8");
  ctx.fillStyle=cg;
  ctx.beginPath(); ctx.moveTo(x+w/2,y+10); ctx.lineTo(x+w/2-10,y+40); ctx.lineTo(x+w/2+10,y+40); ctx.closePath(); ctx.fill();
  ctx.strokeStyle="#64748b"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(x+w/2,y+6); ctx.lineTo(x+w/2,y+h-10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+17,y+58); ctx.lineTo(x+w-17,y+58); ctx.stroke();
  ctx.fillStyle="#475569";
  ctx.fillRect(x+13,y+h-8,10,12); ctx.fillRect(x+w-23,y+h-8,10,12); ctx.fillRect(x+w/2-6,y+h-10,12,16);
  ctx.restore();
}


function shootBullet(){
  if(bulletCooldown<=0){
    bullets.push({x:player.x+player.width/2-3, y:player.y-6, width:6, height:18, speed:9});
    bulletCooldown=12;
  }
}

function moveBullets(){
  for(let b of bullets) b.y-=b.speed;
  bullets=bullets.filter(b=>b.y+b.height>0);
}

function drawBullets(){
  for(let b of bullets){
    ctx.save(); ctx.shadowBlur=14; ctx.shadowColor="#f8ff75"; ctx.fillStyle="#fde047";
    ctx.fillRect(b.x,b.y,b.width,b.height); ctx.restore();
  }
}


function createMeteorShape(r){
  let pts=[];
  for(let a=0;a<Math.PI*2;a+=Math.PI/4) pts.push({angle:a, radius:r*randomBetween(0.75,1.15)});
  return pts;
}

function createMeteor(isBig){
  isBig = isBig || false;
  const size = isBig ? randomBetween(80,120) : randomBetween(24,48);
  const x=Math.random()*(canvas.width-size*2)+size;
  const minS=Math.min(0.6+level*0.05,1.8), maxS=Math.min(1.2+level*0.08,3);
  const speed = isBig ? randomBetween(0.7, 1.4) : randomBetween(minS,maxS);
  meteors.push({
    x, y:-size, radius:size/2, speed,
    rotation:Math.random()*Math.PI*2, rotationSpeed:randomBetween(-0.03,0.03),
    shape:createMeteorShape(size/2),
    isBig,
    hp: isBig ? 5 : 1,
    maxHp: isBig ? 5 : 1,
    hitFlash: 0,
    craters:[
      {x:-size*0.12, y:-size*0.08, r:size*0.10},
      {x:size*0.15,  y:size*0.04,  r:size*0.08},
      {x:-size*0.02, y:size*0.16,  r:size*0.07}
    ]
  });
}

function moveMeteors(){
  for(let m of meteors){ m.y+=m.speed; m.rotation+=m.rotationSpeed; if(m.hitFlash>0) m.hitFlash--; }
  for(let i=meteors.length-1;i>=0;i--){
    if(meteors[i].y-meteors[i].radius>canvas.height){
      const dmg = meteors[i].isBig ? damagePerHit*3 : damagePerHit;
      meteors.splice(i,1); applyDamage(dmg); resetCombo();
    }
  }
}

function drawMeteor(m){
  ctx.save(); ctx.translate(m.x,m.y); ctx.rotate(m.rotation);

  if(m.hitFlash > 0) ctx.globalAlpha = 0.5 + 0.5*(m.hitFlash/8);

  const rg=ctx.createRadialGradient(-m.radius*0.25,-m.radius*0.3,m.radius*0.2,0,0,m.radius);
  rg.addColorStop(0,"#a8a29e"); rg.addColorStop(0.45,"#78716c"); rg.addColorStop(1,"#44403c");
  ctx.fillStyle=rg;
  ctx.beginPath();
  for(let i=0;i<m.shape.length;i++){
    const px=Math.cos(m.shape[i].angle)*m.shape[i].radius, py=Math.sin(m.shape[i].angle)*m.shape[i].radius;
    i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
  }
  ctx.closePath(); ctx.fill();

  
  if(m.isBig){
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#94a3b8";
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 3.5;
  } else {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#292524";
    ctx.lineWidth = 2;
  }
  ctx.beginPath();
  for(let i=0;i<m.shape.length;i++){
    const px=Math.cos(m.shape[i].angle)*m.shape[i].radius, py=Math.sin(m.shape[i].angle)*m.shape[i].radius;
    i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
  }
  ctx.closePath(); ctx.stroke();
  ctx.shadowBlur=0;

  for(let c of m.craters){ ctx.fillStyle="rgba(41,37,36,0.55)"; ctx.beginPath(); ctx.arc(c.x,c.y,c.r,0,Math.PI*2); ctx.fill(); }

  
  if(m.isBig){
    ctx.globalAlpha=1;
    ctx.rotate(-m.rotation);
    const bw=m.radius*2, bh=8;
    const bx=-bw/2, by=-m.radius-16;
    ctx.fillStyle="#1f2937"; ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle="#94a3b8"; ctx.fillRect(bx,by,bw*(m.hp/m.maxHp),bh);
    ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,bh);
  }

  ctx.restore();
}


function createPlanet(){
  const size=randomBetween(35,55), x=Math.random()*(canvas.width-size*2)+size;
  const type=Math.random()>0.5?1:2;
  planets.push({x, y:-size, radius:size/2, speed:randomBetween(1.2,2.2), type, heal:type===1?10:15, color:type===1?"#34d399":"#60a5fa", pulse:0});
}

function movePlanets(){
  for(let p of planets){ p.y+=p.speed; p.pulse+=0.05; }
  for(let i=planets.length-1;i>=0;i--){
    if(planets[i].y-planets[i].radius>canvas.height) planets.splice(i,1);
  }
}

function drawPlanets(){
  for(let p of planets){
    ctx.save(); ctx.shadowBlur=15+Math.sin(p.pulse)*5; ctx.shadowColor=p.color;
    const g=ctx.createRadialGradient(p.x-p.radius/3,p.y-p.radius/3,p.radius/4,p.x,p.y,p.radius);
    g.addColorStop(0,"#ffffff"); g.addColorStop(0.3,p.color); g.addColorStop(1,"#1e293b");
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,p.radius,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="white"; ctx.font="bold 12px Arial"; ctx.textAlign="center"; ctx.fillText("+"+p.heal,p.x,p.y+5);
    ctx.restore();
  }
}


function createExplosion(x,y,color,count){
  const n=count||18;
  for(let i=0;i<n;i++){
    particles.push({x, y, dx:randomBetween(-3.5,3.5), dy:randomBetween(-3.5,3.5), size:randomBetween(2,6), life:35, maxLife:35, color});
  }
}

function updateParticles(){
  for(let i=particles.length-1;i>=0;i--){
    let p=particles[i]; p.x+=p.dx; p.y+=p.dy; p.life--; p.size*=0.96;
    if(p.life<=0) particles.splice(i,1);
  }
}

function drawParticles(){
  for(let p of particles){
    ctx.save(); ctx.globalAlpha=p.life/p.maxLife; ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
}


function applyDamage(amount){
  health -= amount;
  screenShake = 12;
  if(health <= 0){ lives--; health = maxHealth; if(lives <= 0){ health = 0; endGame(); } }
}

function endGame(){
  gameState="gameover"; isPaused=false; stopMusic();
  const isNewRecord = score > highScore;
  if(isNewRecord){
    highScore=score;
    try{ localStorage.setItem("spaceShooterHighScore",highScore); }catch(e){}
    startCelebration();
  }
}


function checkCollisionRectCircle(r,c){
  const cx=Math.max(r.x,Math.min(c.x,r.x+r.width)), cy=Math.max(r.y,Math.min(c.y,r.y+r.height));
  const dx=c.x-cx, dy=c.y-cy; return dx*dx+dy*dy<c.radius*c.radius;
}

function checkBulletMeteorCollision(){
  for(let i=bullets.length-1;i>=0;i--){
    for(let j=meteors.length-1;j>=0;j--){
      if(checkCollisionRectCircle(bullets[i],meteors[j])){
        const m=meteors[j];
        m.hp--; m.hitFlash=8;
        bullets.splice(i,1);

        if(m.hp <= 0){
          const pts = m.isBig ? 50 : 10;
          createExplosion(m.x, m.y, "#f59e0b", m.isBig ? 40 : 18);
          meteors.splice(j,1);

          let multiplier = 1;
          if(combo >= 5)      multiplier = 10;
          else if(combo >= 2) multiplier = 5;

          score += pts * multiplier;
          if(combo >= 2) showHudNotif("+"+pts*multiplier+" (x"+multiplier+")", "#f0abfc");
          addCombo();
        } else {
          createExplosion(m.x, m.y, "#94a3b8", 6);
        }
        break;
      }
    }
  }
}

function checkPlayerMeteorCollision(){
  for(let i=meteors.length-1;i>=0;i--){
    if(checkCollisionRectCircle(player,meteors[i])){
      const dmg = meteors[i].isBig ? damagePerHit*2 : damagePerHit;
      createExplosion(meteors[i].x,meteors[i].y,"#ef4444"); meteors.splice(i,1);
      applyDamage(dmg); resetCombo();
    }
  }
}

function checkPlayerPlanetCollision(){
  for(let i=planets.length-1;i>=0;i--){
    if(checkCollisionRectCircle(player,planets[i])){
      health=Math.min(maxHealth,health+planets[i].heal);
      createExplosion(planets[i].x,planets[i].y,planets[i].color); planets.splice(i,1); score+=5;
    }
  }
}


function updateDifficulty(){
  difficultyTimer++;
  if(difficultyTimer % 700 === 0){
    level++;
    showAnnouncement("LEVEL " + level, "#7dd3fc", "#38bdf8", 150);
    showHudNotif("LEVEL UP! → " + level, "#7dd3fc");
    if(meteorSpawnInterval>50) meteorSpawnInterval-=3;
    if(level%3===0 && meteorsPerSpawn<3) meteorsPerSpawn++;
  }

  
  if(level >= 5){
    bigMeteorTimer++;
    const interval = Math.max(600, 900 - (level-5)*30);
    if(bigMeteorTimer >= interval){
      createMeteor(true);
      bigMeteorTimer = 0;
      screenShake = 5;
    }
  }
}


function drawPixelHeart(x,y,scale){
  const s=scale;
  const pixels=[[1,0],[2,0],[4,0],[5,0],[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[1,3],[2,3],[3,3],[4,3],[5,3],[2,4],[3,4],[4,4],[3,5]];
  for(let p of pixels){ ctx.fillStyle="#0f172a"; ctx.fillRect(x+p[0]*s+1,y+p[1]*s+1,s,s); ctx.fillStyle="#ff2d55"; ctx.fillRect(x+p[0]*s,y+p[1]*s,s,s); }
  ctx.fillStyle="#fff"; ctx.fillRect(x+s,y+s,s,s); ctx.fillRect(x+2*s,y+s,s,s);
}

function drawHealthBar(x,y,w,h){
  const ratio=Math.max(0,health/maxHealth);
  ctx.fillStyle="#111827"; ctx.fillRect(x,y,w,h);
  ctx.strokeStyle="#334155"; ctx.lineWidth=3; ctx.strokeRect(x,y,w,h);
  const p=5, ix=x+p, iy=y+p, iw=w-p*2, ih=h-p*2;
  ctx.fillStyle="#ef4444"; ctx.fillRect(ix,iy,iw,ih);
  ctx.fillStyle="#22c55e"; ctx.fillRect(ix,iy,iw*ratio,ih);
  ctx.fillStyle="white"; ctx.font="bold 14px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(Math.round(ratio*100)+"%",x+w/2,y+h/2);
}

function drawHUD(){
  ctx.save();
  ctx.fillStyle="rgba(15,23,42,0.78)"; ctx.fillRect(15,15,270,115);
  ctx.strokeStyle="rgba(147,197,253,0.65)"; ctx.lineWidth=2; ctx.strokeRect(15,15,270,115);
  ctx.textAlign="left"; ctx.textBaseline="alphabetic";
  ctx.fillStyle="#e2e8f0"; ctx.font="bold 18px Arial"; ctx.fillText("Score: "+score,25,40);
  ctx.fillStyle="#fcd34d"; ctx.font="bold 15px Arial"; ctx.fillText("Best: "+highScore,25,60);
  drawPixelHeart(25,73,4); drawHealthBar(65,72,200,24);
  ctx.fillStyle="#e2e8f0"; ctx.font="bold 18px Arial"; ctx.fillText("Lives:",50,117);
  for(let i=0;i<lives;i++) drawPixelHeart(90+i*26,100,3);
  ctx.font="bold 15px Arial"; ctx.fillText("Level: "+level,225,117);
  ctx.restore();
  drawHudNotifs();
}

function drawTopRightIcons(){
  const size=42, pad=12;
  const muteX=canvas.width-size*2-pad*2, pauseX=canvas.width-size-pad, y=pad;
  ctx.save();
  ctx.fillStyle="rgba(15,23,42,0.78)"; ctx.fillRect(muteX,y,size,size); ctx.fillRect(pauseX,y,size,size);
  ctx.strokeStyle="rgba(147,197,253,0.9)"; ctx.lineWidth=2; ctx.strokeRect(muteX,y,size,size); ctx.strokeRect(pauseX,y,size,size);
  ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.font="22px Arial";
  ctx.fillText(isMuted?"🔇":"🔊",muteX+size/2,y+size/2);
  ctx.fillText(isPaused?"▶️":"⏸️",pauseX+size/2,y+size/2);
  ctx.restore();
}


function drawStartScreen(){
  ctx.save(); ctx.textAlign="center"; ctx.textBaseline="middle";
  const cx=canvas.width/2, cy=canvas.height/2;
  ctx.fillStyle="rgba(15,23,42,0.85)"; roundRect(cx-240,cy-200,480,380,18); ctx.fill();
  ctx.strokeStyle="rgba(147,197,253,0.5)"; ctx.lineWidth=2; roundRect(cx-240,cy-200,480,380,18); ctx.stroke();
  ctx.fillStyle="#93c5fd"; ctx.font="bold 42px Arial"; ctx.shadowBlur=20; ctx.shadowColor="#38bdf8";
  ctx.fillText("🚀 SPACE SHOOTER",cx,cy-145); ctx.shadowBlur=0;
  ctx.strokeStyle="rgba(147,197,253,0.3)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(cx-200,cy-110); ctx.lineTo(cx+200,cy-110); ctx.stroke();
  ctx.fillStyle="#e2e8f0"; ctx.font="bold 20px Arial"; ctx.fillText("CONTROLS",cx,cy-75);
  const controls=[["⬅ ➡","Move left / right"],["Space","Shoot"],["M","Toggle mute"],["P / Esc","Pause / Resume"]];
  ctx.font="15px Arial";
  controls.forEach(([k,v],i)=>{
    const ky=cy-40+i*35;
    ctx.fillStyle="#fcd34d"; ctx.textAlign="right"; ctx.fillText(k,cx-10,ky);
    ctx.fillStyle="#94a3b8"; ctx.textAlign="left"; ctx.fillText(v,cx+10,ky);
  });
  ctx.strokeStyle="rgba(147,197,253,0.3)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(cx-200,cy+110); ctx.lineTo(cx+200,cy+110); ctx.stroke();
  blink+=0.05; const alpha=(Math.sin(blink)+1)/2;
  ctx.fillStyle="#93c5fd"; ctx.font="bold 26px Arial"; ctx.shadowBlur=15; ctx.shadowColor="#38bdf8";
  ctx.globalAlpha=0.5+alpha*0.5; ctx.textAlign="center";
  ctx.fillText("PRESS ENTER TO START",cx,cy+150);
  ctx.restore();
}

function drawPauseScreen(){
  ctx.save();
  ctx.fillStyle="rgba(2,6,23,0.7)"; ctx.fillRect(0,0,canvas.width,canvas.height);
  const cx=canvas.width/2, cy=canvas.height/2;
  ctx.fillStyle="rgba(15,23,42,0.95)"; roundRect(cx-220,cy-140,440,280,18); ctx.fill();
  ctx.strokeStyle="rgba(147,197,253,0.6)"; ctx.lineWidth=2; roundRect(cx-220,cy-140,440,280,18); ctx.stroke();
  ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillStyle="#f8fafc"; ctx.font="bold 52px Arial"; ctx.shadowBlur=15; ctx.shadowColor="#38bdf8";
  ctx.fillText("⏸ PAUSED",cx,cy-60); ctx.shadowBlur=0;
  ctx.strokeStyle="rgba(147,197,253,0.25)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(cx-170,cy-10); ctx.lineTo(cx+170,cy-10); ctx.stroke();
  const btnW=160, btnH=48, gap=20;
  const btn1x=cx-btnW-gap/2, btn2x=cx+gap/2, btny=cy+20;
  ctx.fillStyle="rgba(30,58,138,0.9)"; roundRect(btn1x,btny,btnW,btnH,10); ctx.fill();
  ctx.strokeStyle="#3b82f6"; ctx.lineWidth=2; roundRect(btn1x,btny,btnW,btnH,10); ctx.stroke();
  ctx.fillStyle="#93c5fd"; ctx.font="bold 18px Arial"; ctx.fillText("▶ Resume",btn1x+btnW/2,btny+btnH/2);
  ctx.fillStyle="rgba(127,29,29,0.9)"; roundRect(btn2x,btny,btnW,btnH,10); ctx.fill();
  ctx.strokeStyle="#ef4444"; ctx.lineWidth=2; roundRect(btn2x,btny,btnW,btnH,10); ctx.stroke();
  ctx.fillStyle="#fca5a5"; ctx.font="bold 18px Arial"; ctx.fillText("↺ Restart",btn2x+btnW/2,btny+btnH/2);
  ctx.fillStyle="#64748b"; ctx.font="14px Arial"; ctx.fillText("or press P to resume",cx,cy+105);
  ctx.restore();
  pauseResumeBtn={x:btn1x, y:btny, w:btnW, h:btnH};
  pauseRestartBtn={x:btn2x, y:btny, w:btnW, h:btnH};
}

function drawGameOverScreen(){
  ctx.save();
  ctx.fillStyle="rgba(2,6,23,0.7)"; ctx.fillRect(0,0,canvas.width,canvas.height);
  drawCelebration();
  const cx=canvas.width/2, cy=canvas.height/2;
  ctx.fillStyle="rgba(15,23,42,0.95)"; roundRect(cx-240,cy-160,480,320,18); ctx.fill();
  ctx.strokeStyle="rgba(191,219,254,0.6)"; ctx.lineWidth=2; roundRect(cx-240,cy-160,480,320,18); ctx.stroke();
  ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillStyle="#f8fafc"; ctx.font="bold 52px Arial"; ctx.shadowBlur=15; ctx.shadowColor="#ef4444";
  ctx.fillText("GAME OVER",cx,cy-95); ctx.shadowBlur=0;
  ctx.strokeStyle="rgba(147,197,253,0.25)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(cx-190,cy-45); ctx.lineTo(cx+190,cy-45); ctx.stroke();
  ctx.fillStyle="#e2e8f0"; ctx.font="26px Arial"; ctx.fillText("Score: "+score,cx,cy-10);
  if(celebration){
    ctx.fillStyle="#fcd34d"; ctx.font="bold 22px Arial";
    ctx.shadowBlur=10; ctx.shadowColor="#f59e0b";
    ctx.fillText("NEW RECORD! Best: "+highScore,cx,cy+28);
    ctx.shadowBlur=0;
  } else {
    ctx.fillStyle="#fcd34d"; ctx.font="bold 20px Arial"; ctx.fillText("Best: "+highScore,cx,cy+28);
  }
  ctx.strokeStyle="rgba(147,197,253,0.25)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(cx-190,cy+58); ctx.lineTo(cx+190,cy+58); ctx.stroke();
  const btnW=180, btnH=52, btny=cy+80;
  ctx.fillStyle="rgba(30,58,138,0.9)"; roundRect(cx-btnW/2,btny,btnW,btnH,12); ctx.fill();
  ctx.strokeStyle="#3b82f6"; ctx.lineWidth=2; roundRect(cx-btnW/2,btny,btnW,btnH,12); ctx.stroke();
  ctx.fillStyle="#93c5fd"; ctx.font="bold 20px Arial"; ctx.fillText("↺ Play Again",cx,btny+btnH/2);
  gameoverRestartBtn={x:cx-btnW/2, y:btny, w:btnW, h:btnH};
  ctx.fillStyle="#475569"; ctx.font="14px Arial"; ctx.fillText("or press Space",cx,btny+btnH+22);
  ctx.restore();
}


function update(){
  updateStars(); updateParticles(); updateAnnouncements(); updateHudNotifs(); updateCombo(); updateCelebration();
  if(gameState!=="playing") return;
  movePlayer();
  if(keys[" "]||keys["Space"]) shootBullet();
  if(bulletCooldown>0) bulletCooldown--;
  moveBullets(); moveMeteors(); movePlanets();
  meteorSpawnTimer++;
  if(meteorSpawnTimer>=meteorSpawnInterval){ for(let i=0;i<meteorsPerSpawn;i++) createMeteor(false); meteorSpawnTimer=0; }
  if(level>1){ planetSpawnTimer++; if(planetSpawnTimer>=planetSpawnInterval){ createPlanet(); planetSpawnTimer=0; } }
  checkBulletMeteorCollision(); checkPlayerMeteorCollision(); checkPlayerPlanetCollision();
  updateDifficulty();
}

function draw(){
  drawBackground(); drawStars(); drawParticles();
  if(gameState==="start"){ drawStartScreen(); drawTopRightIcons(); return; }
  drawPlayer(); drawBullets();
  for(let m of meteors) drawMeteor(m);
  drawPlanets(); drawHUD(); drawComboBar(); drawComboPopups(); drawAnnouncements();
  drawTopRightIcons();
  if(gameState==="paused") drawPauseScreen();
  if(gameState==="gameover") drawGameOverScreen();
}

function gameLoop(){
  update();
  if(screenShake > 0){
    const sx = (Math.random()-0.5) * screenShake;
    const sy = (Math.random()-0.5) * screenShake;
    ctx.save(); ctx.translate(sx, sy);
    draw();
    ctx.restore();
    screenShake *= 0.75;
    if(screenShake < 0.5) screenShake = 0;
  } else {
    draw();
  }
  requestAnimationFrame(gameLoop);
}
gameLoop();