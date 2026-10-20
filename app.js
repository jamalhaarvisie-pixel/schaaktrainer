'use strict';
// ---------- opslag ----------
const KEY='schaaktrainer-v1';
let S=JSON.parse(localStorage.getItem(KEY)||'null')||{niveau:null,history:[],games:0};
const save=()=>localStorage.setItem(KEY,JSON.stringify(S));
const MIN=200,MAX=3200;
function applyResult(res){ // res: 'win'|'loss'|'draw'
  const before=S.niveau;
  if(res==='win')S.niveau=Math.min(MAX,S.niveau*1.05);
  else if(res==='loss')S.niveau=Math.max(MIN,S.niveau*0.95);
  S.games++;S.history.push({t:Date.now(),res,before:Math.round(before),after:Math.round(S.niveau)});save();
  return S.niveau;
}
// niveau (Elo-achtig) -> Stockfish-instellingen
function engineCfg(n){
  const skill=Math.max(0,Math.min(20,Math.round((n-600)/110)));
  const depth=Math.max(1,Math.min(22,Math.round(1+(n-300)/130)));
  const random=n<1000?Math.max(0,(1000-n)/1600):0; // kans op een willekeurige zet bij laag niveau
  return {skill,depth,random,movetime:Math.min(2500,300+n/2)};
}
// ---------- engine ----------
class Engine{
  constructor(){this.w=new Worker(URL.createObjectURL(new Blob([window.SF_SRC],{type:'text/javascript'})));
    this.q=Promise.resolve();this.on=null;this.w.onmessage=e=>{const l=typeof e.data==='string'?e.data:e;this.on&&this.on(l)};this.send('uci');}
  send(c){this.w.postMessage(c)}
  search(fen,{skill=20,depth=12,movetime=null}={}){
    const job=()=>new Promise(res=>{let score=null;
      this.on=l=>{let m=l.match(/score (cp|mate) (-?\d+)/);if(m)score=m[1]==='cp'?+m[2]:(+m[2]>0?10000:-10000);
        if(l.startsWith('bestmove')){this.on=null;res({move:l.split(' ')[1],score});}};
      this.send('setoption name Skill Level value '+skill);this.send('position fen '+fen);
      this.send('go depth '+depth+(movetime?' movetime '+movetime:''));});
    return (this.q=this.q.then(job));
  }
}
let E;try{E=new Engine()}catch(e){console.error(e)}
// ---------- bord ----------
const G={'p':'♟','n':'♞','b':'♝','r':'♜','q':'♛','k':'♚'};
function Board(el,onMove){
  const b={el,flip:false,sel:null,game:null,marks:{},enabled:false};
  b.render=()=>{el.innerHTML='';const bd=b.game.board();
    for(let r=0;r<8;r++)for(let f=0;f<8;f++){const rr=b.flip?7-r:r,ff=b.flip?7-f:f;
      const sq='abcdefgh'[ff]+(8-rr),p=bd[rr][ff],d=document.createElement('div');
      d.className='sq '+((rr+ff)%2?'d':'l')+(b.marks[sq]?' '+b.marks[sq]:'');d.dataset.sq=sq;
      if(p)d.innerHTML='<span class="pc '+p.color+'">'+G[p.type]+'</span>';
      if(f===0)d.insertAdjacentHTML('beforeend','<span class="coord">'+(8-rr)+'</span>');el.appendChild(d);} };
  b.mark=(sqs,cls)=>{for(const k in b.marks)if(b.marks[k]===cls)delete b.marks[k];sqs.forEach(s=>b.marks[s]=cls)};
  const sqAt=(x,y)=>{const e=document.elementFromPoint(x,y);return e&&e.closest('.sq')?e.closest('.sq').dataset.sq:null};
  const select=s=>{b.sel=s;b.mark(s?[s]:[],'sel');b.mark(s?b.game.moves({square:s,verbose:true}).map(m=>m.to):[],'tgt');b.render()};
  const tryMove=(from,to)=>{const mv=b.game.moves({square:from,verbose:true}).find(m=>m.to===to);
    if(!mv)return false;select(null);onMove(from,to,mv.promotion?'q':undefined);return true};
  let drag=null;
  el.addEventListener('pointerdown',e=>{if(!b.enabled)return;const s=sqAt(e.clientX,e.clientY);if(!s)return;
    const p=b.game.get(s);
    if(b.sel&&b.sel!==s&&tryMove(b.sel,s))return;
    if(p&&p.color===b.game.turn()){select(s);const g=document.createElement('div');g.className='drag pc '+p.color;g.textContent=G[p.type];
      g.style.left=e.clientX+'px';g.style.top=e.clientY+'px';document.body.appendChild(g);drag={s,g,moved:false};
      const pc=el.querySelector('[data-sq="'+s+'"] .pc');if(pc)pc.style.opacity=.3;}
    else select(null);});
  window.addEventListener('pointermove',e=>{if(!drag)return;drag.moved=true;drag.g.style.left=e.clientX+'px';drag.g.style.top=e.clientY+'px'});
  window.addEventListener('pointerup',e=>{if(!drag)return;const d=drag;drag=null;d.g.remove();
    const t=sqAt(e.clientX,e.clientY);if(t&&t!==d.s&&tryMove(d.s,t))return;b.render();});
  return b;
}
const $=id=>document.getElementById(id);
// ---------- weergaven ----------
function show(v){document.querySelectorAll('.view').forEach(x=>x.classList.toggle('on',x.id==='v-'+v));if(v==='stats')drawStats();}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.v));
// ---------- niveautest ----------
const PUZ=[ // [fen, oplossing (uci), rating, omschrijving]
 ['6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1','d1d8',500,'Wit geeft mat in 1'],
 ['r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1','f3f7',700,'Wit geeft mat in 1'],
 ['6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1','g5f7',900,'Wit geeft mat in 1'],
 ['7k/8/5N2/8/8/8/8/6RK w - - 0 1','g1g8',1100,'Wit geeft mat in 1'],
 ['r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1','b5c7',1300,'Wit: win materiaal'],
 ['2r3k1/5ppp/8/8/8/8/1q3PPP/2R1R1K1 b - - 0 1','c8c1',1500,'Zwart: vind de beste zet'],
];
let T=null;const tb=Board($('tboard'),(f,t)=>{const p=PUZ[T.i],ok=(f+t)===p[1];
  T.game.move({from:f,to:t,promotion:'q'});tb.mark([f,t],'last');tb.enabled=false;tb.render();
  if(ok){T.score+=1;T.solved.push(p[2]);}
  $('t-status').textContent=ok?'✅ Goed!':'❌ Helaas, de oplossing was '+p[1].slice(0,2)+'–'+p[1].slice(2);
  setTimeout(nextPuzzle,1300);});
function nextPuzzle(){T.i++;if(T.i>=PUZ.length)return finishTest();const p=PUZ[T.i];
  T.game=new Chess(p[0]);tb.game=T.game;tb.flip=T.game.turn()==='b';tb.marks={};tb.enabled=true;tb.render();
  $('t-info').textContent='Puzzel '+(T.i+1)+'/'+PUZ.length+' – '+p[3];$('t-status').textContent='';}
function finishTest(){const s=T.solved;
  const est=s.length?Math.round(Math.max(...s)+150+ (s.length-1)*20):400;
  S.niveau=est;S.history=S.history||[];S.history.push({t:Date.now(),res:'test',before:est,after:est});save();
  $('t-info').textContent='Klaar! Je hebt '+s.length+' van de '+PUZ.length+' puzzels opgelost. Startniveau: '+est+'. De eerste partijen stellen dit verder bij.';
  setTimeout(()=>{show('play');newGame()},2500);}
$('t-start').onclick=()=>{T={i:-1,score:0,solved:[]};nextPuzzle();};
$('t-skip').onclick=()=>{S.niveau=800;save();show('play');newGame();};
tb.game=new Chess();tb.render();
// ---------- partij ----------
let game,pColor='w',busy=false,over=true,moveLog=[];
const pb=Board($('board'),(f,t,pr)=>playerMove(f,t,pr));
function upd(){$('lvl').textContent=S.niveau?Math.round(S.niveau):'-';
  $('moves').innerHTML='';const h=game.history();for(let i=0;i<h.length;i+=2){const li=document.createElement('li');li.textContent=h[i]+(h[i+1]?'  '+h[i+1]:'');$('moves').appendChild(li);}
  $('turn').textContent=over?'':(game.turn()===pColor?'Jij bent aan zet':'Computer denkt…');pb.enabled=!over&&!busy&&game.turn()===pColor;pb.render();}
function newGame(){if(!S.niveau){show('test');return}
  pColor=S.games%2===0?'w':'b';game=new Chess();moveLog=[];pb.game=game;pb.flip=pColor==='b';pb.marks={};over=false;busy=false;
  $('analysis').innerHTML='';$('status').textContent='Nieuwe partij – jij speelt '+(pColor==='w'?'wit':'zwart')+'. Niveau '+Math.round(S.niveau)+'.';upd();
  if(pColor==='b')engineMove();}
function playerMove(f,t,pr){if(over)return;const fenBefore=game.fen();const m=game.move({from:f,to:t,promotion:pr});
  moveLog.push({fen:fenBefore,san:m.san,uci:f+t+(pr||'')});pb.mark([f,t],'last');pb.mark([],'hint');upd();if(!checkEnd())engineMove();}
async function engineMove(){busy=true;upd();const c=engineCfg(S.niveau);let mv;
  const legal=game.moves({verbose:true});
  if(Math.random()<c.random){await new Promise(r=>setTimeout(r,400));const m=legal[Math.floor(Math.random()*legal.length)];mv=m.from+m.to+(m.promotion||'');}
  else mv=(await E.search(game.fen(),{skill:c.skill,depth:c.depth,movetime:c.movetime})).move;
  if(over){busy=false;return}
  game.move({from:mv.slice(0,2),to:mv.slice(2,4),promotion:mv[4]||'q'});pb.mark([mv.slice(0,2),mv.slice(2,4)],'last');busy=false;upd();checkEnd();}
function checkEnd(){if(!game.isGameOver())return false;
  if(game.isCheckmate())finish(game.turn()===pColor?'loss':'win','Schaakmat!');else finish('draw','Remise.');return true;}
function finish(res,why){over=true;const b=Math.round(S.niveau),a=Math.round(applyResult(res));
  $('status').textContent=why+' '+({win:'🎉 Gewonnen! Niveau +5%',loss:'Verloren. Niveau −5%',draw:'Gelijkspel, niveau blijft gelijk'}[res])+' ('+b+' → '+a+')';upd();analyse();}
$('new').onclick=()=>{if(!over&&game.history().length>1&&!confirm('Partij afbreken? Dat telt als verlies.'))return;if(!over&&game&&game.history().length>1)finish('loss','Afgebroken.');newGame();};
$('resign').onclick=()=>{if(!over&&confirm('Weet je zeker dat je opgeeft?'))finish('loss','Opgegeven.');};
$('hint').onclick=async()=>{if(over||busy||game.turn()!==pColor)return;$('status').textContent='Hint wordt berekend…';
  const r=await E.search(game.fen(),{depth:12});pb.mark([r.move.slice(0,2),r.move.slice(2,4)],'hint');pb.render();$('status').textContent='💡 Probeer de groen gemarkeerde zet.';};
async function analyse(){const moves=moveLog.slice(-12);if(!moves.length)return;
  $('analysis').innerHTML='<p>Analyse van je laatste zetten…</p>';const out=[];
  for(const m of moves){const best=await E.search(m.fen,{depth:10});const g=new Chess(m.fen);g.move(m.uci.length>4?{from:m.uci.slice(0,2),to:m.uci.slice(2,4),promotion:'q'}:{from:m.uci.slice(0,2),to:m.uci.slice(2,4)});
    if(g.isGameOver()||best.move===m.uci.slice(0,4)||best.move===m.uci)continue;const after=await E.search(g.fen(),{depth:10});
    const loss=(best.score??0)+(after.score??0);
    if(loss>=150){const bm=new Chess(m.fen).move({from:best.move.slice(0,2),to:best.move.slice(2,4),promotion:'q'});
      out.push('<li><b>'+m.san+'</b> '+(loss>=300?'❌ blunder':'⚠️ onnauwkeurig')+' – beter was <b>'+bm.san+'</b></li>');}}
  $('analysis').innerHTML='<h3>Analyse</h3>'+(out.length?'<ol>'+out.join('')+'</ol>':'<p>Geen grote fouten gevonden in je laatste zetten. Goed gespeeld!</p>');}
// ---------- statistiek ----------
function drawStats(){const h=S.history||[],c=$('chart'),x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);
  const pts=h.map(e=>e.after);const w=h.filter(e=>e.res==='win').length,l=h.filter(e=>e.res==='loss').length,d=h.filter(e=>e.res==='draw').length;
  $('stats').innerHTML=[['Niveau',S.niveau?Math.round(S.niveau):'-'],['Hoogste',pts.length?Math.max(...pts):'-'],['Partijen',w+l+d],['Winst',w],['Verlies',l],['Remise',d]].map(a=>'<div>'+a[0]+'<b>'+a[1]+'</b></div>').join('');
  $('hist').innerHTML=h.slice().reverse().slice(0,50).map(e=>'<li>'+new Date(e.t).toLocaleString('nl-NL')+' – '+({win:'Winst',loss:'Verlies',draw:'Remise',test:'Niveautest'}[e.res])+': '+e.before+' → '+e.after+'</li>').join('');
  if(pts.length<1){x.fillStyle='#888';x.font='16px sans-serif';x.fillText('Nog geen gegevens',20,40);return}
  const mn=Math.min(...pts)*0.95,mx=Math.max(...pts)*1.05,W=c.width,H=c.height,P=30;
  x.strokeStyle='#333';x.fillStyle='#888';x.font='12px sans-serif';for(let i=0;i<=4;i++){const v=mn+(mx-mn)*i/4,y=H-P-(H-2*P)*i/4;x.beginPath();x.moveTo(P,y);x.lineTo(W-5,y);x.stroke();x.fillText(Math.round(v),2,y-2);}
  x.strokeStyle='#d4a53a';x.lineWidth=3;x.beginPath();pts.forEach((v,i)=>{const X=P+(W-P-10)*(pts.length>1?i/(pts.length-1):0),Y=H-P-(H-2*P)*(v-mn)/(mx-mn);i?x.lineTo(X,Y):x.moveTo(X,Y)});x.stroke();}
$('reset').onclick=()=>{if(confirm('Alle voortgang wissen?')){localStorage.removeItem(KEY);location.reload();}};
// start
window.ST={S,applyResult,engineCfg,E,get game(){return game}};
if(S.niveau){show('play');newGame();}else show('test');
