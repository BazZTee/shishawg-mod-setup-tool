const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const baseline = fs.readFileSync(path.join(__dirname,'fixtures/generate-command-7.3.0.js.txt'),'utf8');
const renderer = fs.readFileSync(path.join(__dirname,'../src/renderer/renderer.js'),'utf8');
const changed = renderer.slice(renderer.indexOf('function generateCommandString() {'),renderer.indexOf('// Smart Tobacco String Splitter'));
function element(value='') { return {value,checked:true,textContent:'',style:{},classList:{add(){},remove(){}},removeAttribute(){},setAttribute(){}}; }
function run(code,persons,promoTarget,unit,flavors,description) {
  const output = element();
  const context = {
    state:{persons:JSON.parse(JSON.stringify(persons)).map(p=>({...p,tobaccoUnit:unit,showTobaccoAmounts:true})),personCount:persons.length,twitchUser:null},
    inputGlobalPromo:element('SWG (10% Rabatt)'),selectPromoTarget:element(promoTarget),chkIncludePromoDesc:{checked:description},
    chkIncludeFlavors:{checked:flavors},inputGlobalKohle:element('Magic Cubes'),inputGlobalExtra:element('Tasting'),
    findTobaccoFlavor:name=> name.includes('Pynkman') ? 'Beere, Minze' : null,
    MAX_COMMAND_LEN_WITH_FLAVORS:300,commandOutput:output,previewChatText:element(),commandLengthBadge:element(),
    document:{getElementById:()=>element()},localStorage:{getItem:()=>null},commandIsReady:false
  };
  vm.createContext(context); vm.runInContext(code,context);
  const result = vm.runInContext('generateCommandString()',context);
  return {command:output.value,returned:result};
}
test('240 combinations produce exactly the same Twitch commands as original 7.3.0',()=> {
  const coal = {name:'Marvin',pipe:'Amotion Futr',bowl:'Cosmo Bowl',hmd:'ONMO',tobaccos:['MustH - Pynkman','Blackburn'],tobaccoAmounts:['12','5,5']};
  const electric = {...coal,name:'Kai',bowl:'XKAH Lite',hmd:'',isElectric:true};
  const scenarios = [[{}],[coal],[electric],[coal,electric],[{...electric,pipe:'XKAH Shii',bowl:'XKAH Shii',vessel:'Bowl',vesselColor:'Blau'}],Array.from({length:10},(_,i)=>({...coal,name:'Person '+i,tobaccos:['MustH - Pynkman '+i,'Lang'.repeat(30)]}))];
  let count=0;
  for(const people of scenarios) for(const target of ['pipe','bowl','hmd','kohle','extra']) for(const unit of ['g','%']) for(const flavors of [true,false]) for(const description of [true,false]) {
    const before=run(baseline,people,target,unit,flavors,description);
    const after=run(changed,people,target,unit,flavors,description);
    assert.equal(after.command,before.command,`Scenario ${count}: ${target},${unit},${flavors},${description}`);
    assert.equal(after.returned,after.command,'Dashboard must receive the canonical generated command');
    count++;
  }
  assert.equal(count,240);
});
