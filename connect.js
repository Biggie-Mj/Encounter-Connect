/* MJ authority. Never sends Encounter state or applies companion state.patch. */
'use strict';
(()=>{
 const core=window.EncounterConnectCore, peers=new Map(),seen=new Set(),pending=new Map();
 let socket=null,channel=null,retry=null,running=false,status='Hors ligne',lastPublic='',lastTurn='',turnToken=crypto.randomUUID(),previous=new Map(),connectionId=0;
 let config={code:'',endpoint:''};try{config={...config,...JSON.parse(localStorage.getItem('encounter-connect-config')||'{}')};}catch(e){}
 let paused=true;
 const bindings=()=>state.encounter.connections||(state.encounter.connections={});
 const enabled=()=>running&&(socket?.readyState===1||!!channel)&&!paused&&state.ui.mode==='combat'&&!ui.pendingAdvance;
 const context=()=>({participants:state.encounter.participants,bindings:bindings(),turnToken,activeId:activeParticipant()?.id,enabled:enabled(),damageTypes:DAMAGE_TYPES});
 function envelope(type,payload){return {protocol:'rpg-connect',version:'1.0',id:crypto.randomUUID(),timestamp:new Date().toISOString(),session:{code:config.code},actor:{id:'encounter-mj',kind:'gm',name:'MJ'},source:{app:'encounter'},type,payload};}
 function send(type,payload){if(!running)return;const e=envelope(type,payload);if(socket?.readyState===1)socket.send(JSON.stringify(e));else if(channel)channel.postMessage(e);}
 function snapshot(){return {turnToken,round:state.encounter.round,paused:!enabled(),activeActorId:enabled()?Object.keys(bindings()).find(id=>bindings()[id]===activeParticipant()?.id)||null:null,
  players:state.encounter.participants.filter(p=>p.kind==='player').map(p=>({id:p.id,name:p.name,actorId:Object.keys(bindings()).find(id=>bindings()[id]===p.id)||null,permissions:core.permissions(p,activeParticipant()?.id,enabled())})),
  enemies:state.encounter.participants.filter(p=>p.kind!=='player'&&p.kind!=='lair'&&p.sharing?.visible).map(p=>core.publicEnemy(p,isBossParticipant(p)))};}
 function sync(force=false){
  const signature=JSON.stringify([state.encounter.savedId,state.encounter.round,state.encounter.currentTurn,activeParticipant()?.id,enabled(),bindings()]);
  const changed=signature!==lastTurn;
  if(changed){lastTurn=signature;turnToken=crypto.randomUUID();for(const e of pending.values())result(e,'rejected','Le contexte de tour a changé.');pending.clear();}
  const snap=snapshot(),serialized=JSON.stringify(snap);
  if(force||lastPublic!==serialized){lastPublic=serialized;send('encounter.snapshot',snap);}
  if(changed&&snap.activeActorId)send('turn.started',{actorId:snap.activeActorId,round:snap.round,turnToken,permissions:snap.players.find(p=>p.actorId===snap.activeActorId)?.permissions});
  for(const p of snap.enemies){if(previous.get(p.id)===false&&p.defeated)send('enemy.defeated',{targetId:p.id,name:p.name});}
  previous=new Map(snap.enemies.map(p=>[p.id,p.defeated]));
  refresh();
 }
 function result(e,status,reason){send('action.result',{requestId:e.id,actorId:e.actor.id,status,reason});}
 function receive(e){
  if(!running||!e||e.protocol!=='rpg-connect'||String(e.version).split('.')[0]!=='1'||e.session?.code!==config.code||typeof e.id!=='string'||e.id.length>128||typeof e.actor?.id!=='string'||e.actor.kind==='gm')return;
  if(seen.has(e.id))return;seen.add(e.id); // retained until session closes: no replay on undo
  if(seen.size>100000){disconnect();toast('Session fermée : limite des événements atteinte.');return;}
  if(e.actor.id.length>100)return;
  if(!peers.has(e.actor.id)&&peers.size>=32)return;
  peers.set(e.actor.id,{name:String(e.actor.name||e.actor.id).slice(0,80),last:Date.now(),type:e.type});
  if(e.type==='companion.hello'||e.type==='session.resync'){send('cockpit.hello',{capabilities:['encounter.snapshot','turn.started','action.request','action.result','enemy.defeated']});sync(true);}
  else if(e.type==='action.request'){
   const error=core.validate(e,context());if(error)result(e,'rejected',error);
   else if(pending.size>=30)result(e,'rejected','Trop de demandes en attente.');
   else {pending.set(e.id,e);toast(`${peers.get(e.actor.id).name} propose une action.`);result(e,'pending','Validation MJ attendue.');}
  }
  // Wonq v1 resolves locally. Its observations never authorize a mutation.
  refresh();
 }
 function disconnect(){paused=true;if(running)sync(true);connectionId++;running=false;clearTimeout(retry);if(socket){socket.onclose=null;socket.close();socket=null;}channel?.close();channel=null;pending.clear();peers.clear();seen.clear();status='Hors ligne';sync();}
 function connect(){
  disconnect();config.code=document.getElementById('connectCode').value.trim().toUpperCase();config.endpoint=document.getElementById('connectEndpoint').value.trim();
  if(!/^[A-Z0-9_-]{4,24}$/.test(config.code))return toast('Code : 4 à 24 lettres, chiffres, tirets.');
  if(config.endpoint){try{const u=new URL(config.endpoint);if(u.protocol!=='wss:'&&!(u.protocol==='ws:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error();}catch(e){return toast('Adresse wss:// requise (ws:// accepté sur localhost).');}}
  localStorage.setItem('encounter-connect-config',JSON.stringify(config));running=true;lastPublic='';lastTurn='';
  if(config.endpoint)openSocket(connectionId);
  else {channel=new BroadcastChannel('rpg-connect:'+config.code);channel.onmessage=e=>receive(e.data);status='Test local · même origine';sync(true);}
 }
 function openSocket(id){
  if(!running||id!==connectionId)return;status='Connexion…';refresh();
  socket=new WebSocket(config.endpoint);
  socket.onopen=()=>{status='Connecté · relais';send('cockpit.hello',{});send('state.request',{});sync(true);};
  socket.onmessage=e=>{if(typeof e.data==='string'&&e.data.length<65536)try{receive(JSON.parse(e.data));}catch(err){}};
  socket.onerror=()=>{status='Relais inaccessible';refresh();};
  socket.onclose=()=>{if(!running||id!==connectionId)return;paused=true;status='Connexion perdue · reconnexion…';sync();retry=setTimeout(()=>openSocket(id),3000);};
 }
 function approve(id){
  const e=pending.get(id);if(!e)return;pending.delete(id);
  const error=core.validate(e,context());if(error){result(e,'rejected',error);refresh();return;}
  const a=e.payload,p=state.encounter.participants.find(p=>p.id===bindings()[e.actor.id]);
  mutate(()=>{markEconomy(p,a.economy,true);if(a.effect!=='none'){
   const t=state.encounter.participants.find(t=>t.id===a.targetId);
   if(a.effect==='damage'){applyDamageDirect(t,a.amount,a.damageType||'');}
   else applyHealDirect(t,a.amount);
  }},`${p.name} — ${a.title} · ${a.effect==='none'?'sans modification de PV':a.amount+' '+(a.damageType||a.effect)} (validé par le MJ).`);
  result(e,'accepted','Action appliquée.');sync(true);
 }
 const button=document.createElement('button');button.id='btnConnect';button.className='ghost persistent-action';button.textContent='◎ Joueurs';document.querySelector('.top-actions').prepend(button);
 const modal=document.createElement('dialog');modal.id='connectDialog';modal.className='modal wide';modal.innerHTML=`<div class="modal-shell connect-shell"><div class="modal-head"><div><span class="eyebrow">TABLE CONNECTÉE</span><h2>Applications des joueurs</h2></div><button id="connectClose" class="icon-btn" aria-label="Fermer">×</button></div>
 <p id="connectStatus" role="status"></p><div class="connect-settings"><label>Code de session<input id="connectCode" maxlength="24" autocomplete="off"></label><label>Relais WebSocket<input id="connectEndpoint" type="url" placeholder="wss://…"></label></div><div class="connect-actions"><button id="connectOpen" class="primary">Connecter</button><button id="connectStop" class="ghost">Déconnecter</button><button id="connectPause" class="ghost">Autoriser le jeu</button></div>
 <p class="muted tiny">Sans relais : test entre onglets de même origine uniquement. Les menus restent libres ; les demandes d’action sont contrôlées ici. Wonq v1 transmet des observations, mais doit encore intégrer les autorisations et les cibles.</p>
 <h3>Personnages connectés</h3><div id="connectPeers"></div><h3>Actions à valider</h3><div id="connectPending"></div><h3>Fiches visibles des joueurs</h3><p class="muted tiny">Les adversaires sont cachés par défaut. Aucun PV, maximum, CA, résistance ou détail privé n’est transmis. Le compteur indique les dégâts observés depuis la révélation.</p><div id="connectEnemies"></div></div>`;
 document.body.append(modal);document.getElementById('connectCode').value=config.code;document.getElementById('connectEndpoint').value=config.endpoint;
 button.onclick=()=>{modal.showModal();refresh();};document.getElementById('connectClose').onclick=()=>modal.close();document.getElementById('connectOpen').onclick=connect;document.getElementById('connectStop').onclick=disconnect;
 document.getElementById('connectPause').onclick=()=>{if(!running)return toast('Connecte une session.');paused=!paused;sync(true);};
 function refresh(){
  button.textContent=`◎ Joueurs${pending.size?' · '+pending.size:''}`;
  if(!modal.open)return;
  document.getElementById('connectStatus').textContent=`${status} · ${enabled()?'Jeu autorisé':'Actions en pause'} · Tour : ${activeParticipant()?.name||'—'}`;
  document.getElementById('connectPause').textContent=paused?'Autoriser le jeu':'Suspendre le jeu';
  document.getElementById('connectPeers').innerHTML=[...peers].map(([id,p])=>`<div class="connect-peer"><div><b>${esc(p.name)}</b><small>${esc(p.type)} · ${Date.now()-p.last<45000?'vu récemment':'sans nouvelles'}</small></div><label>Associer au PJ<select data-bind="${esc(id)}"><option value="">Non associé</option>${state.encounter.participants.filter(p=>p.kind==='player').map(p=>`<option value="${esc(p.id)}" ${bindings()[id]===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label></div>`).join('')||'<p class="muted">Aucune application détectée. Connecte le même code et le même relais sur chaque appareil.</p>';
  document.getElementById('connectPending').innerHTML=[...pending].map(([id,e])=>`<div class="connect-request"><strong>${esc(peers.get(e.actor.id)?.name)} · ${esc(e.payload.title)}</strong><p>${esc(e.payload.economy)} · ${esc(e.payload.effect)} ${e.payload.effect==='none'?'':esc(e.payload.amount)+' → '+esc(state.encounter.participants.find(p=>p.id===e.payload.targetId)?.name)}</p><button data-approve="${esc(id)}" class="primary">Valider</button> <button data-reject="${esc(id)}" class="ghost">Refuser</button></div>`).join('')||'<p class="muted">Aucune demande en attente.</p>';
  document.getElementById('connectEnemies').innerHTML=state.encounter.participants.filter(p=>p.kind!=='player'&&p.kind!=='lair').map(p=>{const v=p.sharing||{};return `<details class="connect-enemy" ${v.visible?'open':''}><summary>${isBossParticipant(p)?'♛ ':''}${esc(p.name)} · ${v.visible?'Visible':'Caché'}</summary><div class="connect-enemy-body" data-share-id="${esc(p.id)}"><label class="check-label"><input type="checkbox" data-share="visible" ${v.visible?'checked':''}> Révéler aux joueurs</label><label>Nom public<input data-share="name" value="${esc(v.name||'')}" placeholder="${esc(p.name)}" maxlength="100"></label><label>Couleur<input type="color" data-share="color" value="${esc(v.color||'#719bb5')}"></label><label>Effet connu<input data-share="effect" value="${esc(v.effect||'')}" maxlength="240" placeholder="Ex. protégé par une aura"></label><div>${p.conditions.map(c=>`<label class="check-label"><input type="checkbox" data-condition="${esc(c.id)}" ${(v.conditions||[]).includes(c.id)?'checked':''}> Montrer : ${esc(c.name)}</label>`).join('')||'<small>Aucun état actif.</small>'}</div><p>${v.damageTaken||0} dégâts observés · ${p.hp<=0?'À terre':'Actif'} ${isBossParticipant(p)?'· ♛ BOSS':''}</p></div></details>`;}).join('')||'<p class="muted">Ajoute des adversaires à la rencontre.</p>';
 }
 modal.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.approve)approve(b.dataset.approve);if(b.dataset.reject){const r=pending.get(b.dataset.reject);if(r)result(r,'rejected','Refus du MJ.');pending.delete(b.dataset.reject);refresh();}});
 modal.addEventListener('change',e=>{
  const el=e.target;
  if(el.dataset.bind){mutate(()=>{for(const key of Object.keys(bindings()))if(bindings()[key]===el.value)delete bindings()[key];if(el.value)bindings()[el.dataset.bind]=el.value;else delete bindings()[el.dataset.bind];},'Association de joueur modifiée.');return;}
  const p=state.encounter.participants.find(p=>p.id===el.closest('[data-share-id]')?.dataset.shareId);if(!p)return;
  mutate(()=>{p.sharing=p.sharing||{visible:false,conditions:[],damageTaken:0};if(el.dataset.share){if(el.dataset.share==='visible'&&el.checked&&!p.sharing.visible)p.sharing.damageTaken=0;p.sharing[el.dataset.share]=el.type==='checkbox'?el.checked:el.value;}if(el.dataset.condition){const ids=new Set(p.sharing.conditions||[]);el.checked?ids.add(el.dataset.condition):ids.delete(el.dataset.condition);p.sharing.conditions=[...ids];}},'Visibilité des joueurs modifiée.');
 });
 const baseNext=requestNextTurn;requestNextTurn=function(){baseNext();sync();};
 const baseRender=render;render=function(){baseRender();sync();};
 // Include all ordinary MJ damage paths without counting healing or hidden damage.
 const baseDamage=applyDamageDirect;applyDamageDirect=function(p,n,t){const before=p.hp+p.tempHp,r=baseDamage(p,n,t);if(p.sharing?.visible)p.sharing.damageTaken=(p.sharing.damageTaken||0)+Math.max(0,before-p.hp-p.tempHp);return r;};
 const baseMany=applyDamageMany;applyDamageMany=function(ids,n,t){const before=new Map(state.encounter.participants.filter(p=>ids.includes(p.id)).map(p=>[p.id,p.hp+p.tempHp]));baseMany(ids,n,t);for(const p of state.encounter.participants)if(p.sharing?.visible&&before.has(p.id))p.sharing.damageTaken=(p.sharing.damageTaken||0)+Math.max(0,before.get(p.id)-p.hp-p.tempHp);saveState();sync();};
 window.EncounterConnect={snapshot,receive};
 sync();
})();
