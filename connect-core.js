/* RPG Connect: pure public projection and authoritative request checks. */
(function(root){
  'use strict';
  const field={action:'actionUsed',bonus:'bonusActionUsed',reaction:'reactionUsed'};
  function permissions(p,active,enabled){
    const alive=!!p&&p.hp>0&&!p.conditions?.some(c=>['Inconscient','Paralysé','Pétrifié','Étourdi','Incapacité'].includes(c.name));
    return {prepare:true,action:!!(enabled&&alive&&active===p.id&&!p.actionUsed),bonus:!!(enabled&&alive&&active===p.id&&!p.bonusActionUsed),reaction:!!(enabled&&alive&&!p.reactionUsed)};
  }
  function publicEnemy(p,boss){
    const v=p.sharing||{};
    return {id:p.id,name:v.name||p.name,boss:!!boss,color:/^#[0-9a-f]{6}$/i.test(v.color)?v.color:(boss?'#cf9b49':'#719bb5'),
      damageTaken:Math.max(0,Number(v.damageTaken)||0),defeated:p.hp<=0,
      conditions:(p.conditions||[]).filter(c=>(v.conditions||[]).includes(c.id)).map(c=>({id:c.id,name:c.name})),effect:String(v.effect||'').slice(0,240)};
  }
  function validate(request,ctx){
    const p=ctx.participants.find(p=>p.id===ctx.bindings[request.actor?.id]);
    const a=request.payload||{};
    if(!p||p.kind!=='player')return 'Personnage non associé par le MJ.';
    if(a.turnToken!==ctx.turnToken)return 'Autorisation périmée : resynchroniser.';
    if(!field[a.economy]||!permissions(p,ctx.activeId,ctx.enabled)[a.economy])return 'Action indisponible ou hors tour.';
    if(typeof a.title!=='string'||!a.title.trim()||a.title.length>160)return 'Intitulé invalide.';
    if(!['damage','heal','none'].includes(a.effect))return 'Effet invalide.';
    if(a.effect!=='none'){
      if(!Number.isSafeInteger(a.amount)||a.amount<1||a.amount>10000)return 'Montant invalide.';
      const target=ctx.participants.find(t=>t.id===a.targetId);
      if(!target||target.kind==='lair'||(target.kind!=='player'&&!target.sharing?.visible))return 'Cible indisponible.';
      if(a.effect==='damage'&&target.hp<=0)return 'Cible déjà à terre.';
      if(a.damageType&&!ctx.damageTypes.includes(a.damageType))return 'Type de dégâts invalide.';
    }
    return null;
  }
  const api={permissions,publicEnemy,validate,field};
  if(typeof module!=='undefined')module.exports=api;
  root.EncounterConnectCore=api;
})(typeof window==='undefined'?globalThis:window);
