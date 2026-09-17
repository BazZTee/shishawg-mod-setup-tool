/* Presentation layer: move original controls, retain their handlers and IPC. */
(() => {
  'use strict';
  const view=document.getElementById('view-quickactions');
  if(!view)return;
  const grid=view.querySelector('.qa-grid-container');
  const cards=Object.fromEntries([...grid.querySelectorAll('[data-glass-area]')].map(el=>[el.dataset.glassArea,el]));
  if(!['stream','clip','raid','commands','videos'].every(key=>cards[key]))return;
  const make=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text)el.textContent=text;return el;};
  const button=(text,fn)=>{const el=make('button','btn btn-secondary',text);el.type='button';el.addEventListener('click',fn);return el;};
  const root=make('div','sa-workspace');
  function fold(card,title,subtitle) {
    const section=make('section','sa-fold');
    const trigger=button('',()=>{const open=trigger.getAttribute('aria-expanded')!=='true';trigger.setAttribute('aria-expanded',String(open));section.classList.toggle('is-open',open);panel.inert=!open;});
    trigger.className='sa-fold-trigger';trigger.setAttribute('aria-expanded','false');
    const label=make('span','sa-fold-label');label.append(make('strong','',title),make('span','sa-fold-description',subtitle));
    trigger.append(label,make('span','sa-chevron','⌄'));
    const panel=make('div','sa-fold-panel');panel.id='sa-panel-'+card.dataset.glassArea;panel.inert=true;trigger.setAttribute('aria-controls',panel.id);
    const inner=make('div','sa-fold-inner');inner.append(card);panel.append(inner);section.append(trigger,panel);return {section,trigger,label};
  }
  const stream=fold(cards.stream,'Titel & Kategorie','Streamdaten laden …');
  const summary=stream.label.lastChild;
  const updateSummary=()=>{if(view.classList.contains('hidden'))return;const title=document.getElementById('qa-input-title').value;const game=document.getElementById('qa-input-game').value;const text=[title,game].filter(Boolean).join(' · ')||'Titel und Kategorie bearbeiten';if(summary.textContent!==text)summary.textContent=text;};
  setInterval(updateSummary,1000);
  const quick=make('section','sa-quick');
  const favorites=make('section','qa-card sa-favorites');
  const favHeader=make('div','qa-card-header');
  const favGroup=make('div','qa-title-group');
  const favIcon=make('span','qa-header-icon');
  favIcon.innerHTML='<svg class="ws-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  const favTitles=make('div','');
  favTitles.append(make('h3','','Dein Schnellzugriff'),make('p','qa-subtitle','Befehle mit dem Stern anheften. Ein Klick führt sie aus.'));
  favGroup.append(favIcon,favTitles);
  favHeader.append(favGroup);
  const favBody=make('div','qa-card-body');
  const favoriteList=make('div','sa-shortcuts');
  const recentTitle=make('h4','sa-recent-title','Zuletzt verwendet');
  const recentList=make('div','sa-shortcuts');
  favBody.append(favoriteList,recentTitle,recentList);
  favorites.append(favHeader,favBody);
  quick.append(cards.clip,favorites);
  cards.clip.querySelector('h3').textContent='Moment festhalten';
  const library=make('section','sa-library');
  const tabs=make('div','sa-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Befehle und Videos');
  const panels=[cards.videos,cards.commands];
  panels.forEach((panel,i)=>{panel.id='sa-library-'+i;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','sa-tab-'+i);});
  function select(index,focus=false){panels.forEach((panel,i)=>{panel.hidden=i!==index;const tab=tabs.querySelectorAll('button')[i];tab.classList.toggle('active',i===index);tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});if(focus)tabs.querySelectorAll('button')[index].focus();}
  ['Videos teilen','Chat-Befehle'].forEach((name,i)=>{const tab=button(name,()=>select(i));tab.id='sa-tab-'+i;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',panels[i].id);tabs.append(tab);});
  tabs.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();select(event.key==='Home'?0:event.key==='End'?1:tabs.querySelectorAll('button')[0].getAttribute('aria-selected')==='true'?1:0,true);}});
  library.append(tabs,...panels);select(0);
  const search=make('input','sa-command-search');search.type='search';search.placeholder='Befehl suchen …';search.setAttribute('aria-label','Chat-Befehle suchen');
  const commandGrid=cards.commands.querySelector('#qa-commands-grid');commandGrid.before(search);
  const noResults=make('p','sa-help','Keine passenden Befehle.');commandGrid.after(noResults);
  const read=(key)=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string'):[];}catch{return [];}};
  let pinned=read('swg-actions-pinned'),recent=read('swg-actions-recent');
  const save=()=>{try{localStorage.setItem('swg-actions-pinned',JSON.stringify(pinned));localStorage.setItem('swg-actions-recent',JSON.stringify(recent));}catch{}};
  const key=card=>JSON.stringify([card.querySelector('.qa-cmd-label').textContent,card.querySelector('.qa-cmd-text').textContent]);
  const originals=()=>[...commandGrid.querySelectorAll('.qa-cmd-card')];
  function filter(){const query=search.value.toLocaleLowerCase('de');let count=0;originals().forEach(card=>{card.hidden=!card.querySelector('.qa-cmd-info').textContent.toLocaleLowerCase('de').includes(query);if(!card.hidden)count++;});noResults.hidden=count>0;}
  function renderShortcuts(){
    const all=originals();
    const validKeys=new Set(all.map(key));
    if(pinned.some(k=>!validKeys.has(k))||recent.some(k=>!validKeys.has(k))){
      pinned=pinned.filter(k=>validKeys.has(k));
      recent=recent.filter(k=>validKeys.has(k));
      save();
    }
    for(const [container,keys] of [[favoriteList,pinned],[recentList,recent]]){
      container.replaceChildren();keys.forEach(id=>{
        const card=all.find(c=>key(c)===id);
        if(!card)return;
        const chip=make('div','sa-shortcut-chip');
        const b=button(card.querySelector('.qa-cmd-label').textContent,()=>card.click());
        b.title=card.querySelector('.qa-cmd-text').textContent;
        const del=make('button','sa-shortcut-del','✕');
        del.type='button';
        del.title=container===favoriteList?'Aus Favoriten entfernen':'Aus „Zuletzt verwendet“ entfernen';
        del.setAttribute('aria-label',del.title);
        del.addEventListener('click',e=>{
          e.stopPropagation();
          if(container===favoriteList){
            pinned=pinned.filter(x=>x!==id);
            save();
            decorate();
          }else{
            recent=recent.filter(x=>x!==id);
            save();
            renderShortcuts();
          }
        });
        chip.append(b,del);
        container.append(chip);
      });
    }
    recentTitle.hidden=!recentList.children.length;
  }
  function decorate(){originals().forEach(card=>{
    if(!card.querySelector('.sa-pin')){const pin=button('☆',()=>{});pin.className='sa-pin';pin.title='Im Schnellzugriff anheften';pin.setAttribute('aria-label','Befehl anheften');card.querySelector('.qa-cmd-actions').prepend(pin);card.tabIndex=0;card.addEventListener('keydown',e=>{if(e.target===card && (e.key==='Enter'||e.key===' ')){e.preventDefault();card.click();}});}
    const active=pinned.includes(key(card));card.querySelector('.sa-pin').textContent=active?'★':'☆';card.querySelector('.sa-pin').setAttribute('aria-pressed',String(active));
  });filter();renderShortcuts();}
  commandGrid.addEventListener('click',event=>{
    const card=event.target.closest('.qa-cmd-card');if(!card)return;
    const id=key(card);
    if(event.target.closest('.sa-pin')){event.stopPropagation();pinned=pinned.includes(id)?pinned.filter(x=>x!==id):[...pinned,id];save();decorate();return;}
    if(event.target.closest('.btn-delete-cmd')||event.target.closest('.btn-edit-cmd'))return;
    recent=[id,...recent.filter(x=>x!==id)].slice(0,4);save();renderShortcuts();
  },true);
  new MutationObserver(decorate).observe(commandGrid,{childList:true});search.addEventListener('input',filter);decorate();
  const raid=fold(cards.raid,'Raid vorbereiten','Zielkanal suchen, Live-Status prüfen und Raid steuern');
  root.append(stream.section,quick,library,raid.section);
  grid.replaceChildren(root);view.classList.add('sa-ready');
})();



