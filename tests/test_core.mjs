import assert from 'node:assert/strict';
import '../web/core.js';
const C=globalThis.SupplyLensCore;
const rows=[
  {topic:'Fabric',status:'aligned',question:'',explanation:'Matches',requirement_quote:'Nylon',supplier_quote:'Nylon'},
  {topic:'Zipper',status:'conflict',question:'Can you use YKK?',explanation:'SBS instead',requirement_quote:'YKK',supplier_quote:'SBS'},
  {topic:'Label',status:'missing',question:'Confirm Polish labels?',explanation:'Not mentioned',requirement_quote:'Polish',supplier_quote:''}
];
const states=[{include:false,reviewed:false,note:''},{include:true,reviewed:true,note:'Ask design team'},{include:false,reviewed:false,note:''}];
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
test('attention filter prioritizes conflict, excludes aligned',()=>assert.deepEqual(C.filterFindings(rows,states,'open','').map(r=>r.index),[1,2]));
test('search includes reviewer notes',()=>assert.deepEqual(C.filterFindings(rows,states,'all','DESIGN').map(r=>r.index),[1]));
test('reviewed filter does not rewrite classifications',()=>{const filtered=C.filterFindings(rows,states,'reviewed','');assert.equal(filtered.length,1);assert.equal(filtered[0].row.status,'conflict');});
test('follow-up includes only selected questions, including reviewed ones',()=>{const draft=C.compose(rows,states,'direct');assert.equal(draft.count,1);assert.ok(draft.text.includes('Can you use YKK?'));assert.ok(!draft.text.includes('Confirm Polish'));});
test('empty question selection is explicit',()=>{const draft=C.compose(rows,states.map(s=>({...s,include:false})),'formal');assert.equal(draft.count,0);assert.ok(draft.text.includes('No follow-up questions'));});
test('tone changes wording, preserves question',()=>{const a=C.compose(rows,states,'formal').text,b=C.compose(rows,states,'friendly').text;assert.ok(a.startsWith('Dear supplier'));assert.ok(b.startsWith('Hi,'));assert.ok(a.includes('Can you use YKK?')&&b.includes('Can you use YKK?'));});
test('CSV escapes formula prefixes and quotes',()=>{for(const value of ['=1+1',' +cmd','@SUM(A1)','-12','\tvalue'])assert.ok(C.csvCell(value).startsWith('"\''));assert.equal(C.csvCell('a,"b"'),'"a,""b"""');});
test('exports preserve notes and escape markup',()=>{const report={mode:'demo',exported_at:'2026-10-21',findings:[{...rows[1],reviewed:true,note:'<img src=x>',include_in_follow_up:true}],documents:{brief:'YKK',reply:'SBS'},subject:'Clarification',follow_up:'Please confirm.'};assert.ok(C.csv(report).includes('<img src=x>'));assert.ok(C.markdown(report).includes('\\<img src=x\\>'));assert.ok(C.markdown(report).includes('Sample replay'));});
test('filtering never reorders the source array',()=>{C.filterFindings(rows,states,'all','');assert.equal(rows[0].topic,'Fabric');});
console.log(`${passed} frontend logic checks passed.`);
