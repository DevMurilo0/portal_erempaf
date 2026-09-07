import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { before, after, test } from 'node:test';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
let env;
before(async()=>{ env=await initializeTestEnvironment({projectId:'demo-erempaf',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}}); await env.clearFirestore(); });
after(async()=>env?.cleanup());
const month='salas/1ano-a/calendario/2026-09';
const data={avisos:'Aviso',detalhes:{},materias:{},fotos:{},revision:1};
const db=(uid,claims={})=>uid?env.authenticatedContext(uid,claims).firestore():env.unauthenticatedContext().firestore();
test('calendário: só conta da própria turma ou claim explícita escreve',async()=>{
 await assertFails(setDoc(doc(db(null),month),data));
 await assertFails(setDoc(doc(db('email-errado',{email:'3anoa@erempaf.com'}),month),data));
 await assertFails(setDoc(doc(db('outro',{editorTurmas:['3ano-a']}),month),data));
 const contaTurma=db('conta-1a',{email:'1anoa@erempaf.com'});
 await assertSucceeds(setDoc(doc(contaTurma,'salas/1ano-a/calendario/2026-10'),data));
 await assertFails(setDoc(doc(db('conta-f',{email:'1anof@erempaf.com'}),'salas/1ano-f/calendario/2026-10'),data));
 const editor=db('editor',{editorTurmas:['1ano-a']});
 await assertSucceeds(setDoc(doc(editor,month),data));
 await assertSucceeds(getDoc(doc(db('aluno'),month)));
 await assertFails(getDoc(doc(db(null),month)));
 await assertFails(updateDoc(doc(editor,month),{role:'admin'}));
 await assertFails(updateDoc(doc(editor,month),{avisos:42}));
 await assertFails(updateDoc(doc(editor,month),{revision:-1}));
 await assertFails(updateDoc(doc(editor,month),{revision:99}));
 await assertFails(updateDoc(doc(editor,month),{detalhes:{'2026-09-07':42}}));
 await assertFails(updateDoc(doc(editor,month),{detalhes:{'2026-09-99':'data inválida'}}));
 await assertFails(updateDoc(doc(editor,month),{materias:{'2026-09-07':{'Matéria inventada':'x'}}}));
 await assertFails(updateDoc(doc(editor,month),{fotos:{'2026-09-07':Array(7).fill('data:image/png;base64,YQ==')}}));
 await assertFails(updateDoc(doc(editor,month),{fotos:{'2026-09-07':[{id:'id',url:'https://evil.example/x',storagePath:'salas/1ano-a/fotos/2026-09-07/id.jpg',desc:'x',data:'2026-09-07',turma:'1ano-a',size:10,contentType:'image/jpeg'}]}}));
 await assertFails(deleteDoc(doc(editor,month)));
 await assertFails(setDoc(doc(editor,'salas/1ano-a'),{senha:'nova'}));
 await assertFails(getDoc(doc(editor,'config/cardapio')));
});
test('cardápio: leitura pública e toda escrita direta do cliente bloqueada',async()=>{
 const path='cardapio/2026-09-07', menu={'2026-09-07':{almoco:'Arroz',status:'normal'}};
 await assertSucceeds(getDoc(doc(db(null),path)));
 await assertFails(setDoc(doc(db(null),path),menu));
 await assertFails(setDoc(doc(db('aluno'),path),menu));
 await assertFails(setDoc(doc(db('turma',{editorTurmas:['1ano-a']}),path),menu));
 const claimAntiga=db('cozinha',{cardapioEditor:true});
 await assertFails(setDoc(doc(claimAntiga,path),menu));
 await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),path),menu));
 await assertSucceeds(getDoc(doc(db(null),path)));
 await assertFails(updateDoc(doc(claimAntiga,path),{'2026-09-07':{almoco:'Outro'}}));
 await assertFails(deleteDoc(doc(claimAntiga,path)));
 await assertFails(setDoc(doc(claimAntiga,'cardapio/2026-09-07/interno/teste'),{x:1}));
});
test('legado: campos e Base64 preservados; não podem ser usados para escalar privilégios',async()=>{
 const path='salas/1ano-a/calendario/2026-08';
 const old={...data,'2026-08-01':'Nota antiga',fotos:{'2026-08-01':['data:image/png;base64,YQ==']}};
 await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),path),old));
 const editor=db('editor',{editorTurmas:['1ano-a']});
 await assertSucceeds(setDoc(doc(editor,path),{...old,avisos:'Atualizado',revision:2}));
 await assertFails(updateDoc(doc(editor,path),{'2026-08-01':'Alteração fora do esquema'}));
});
test('inscrições: propriedade, limites e reivindicação legada com token',async()=>{
 const token='token-secreto-longo-do-aparelho', path='inscricoes/device-1';
 const payload={token,ownerUid:'aluno',turmas:['1ano-a'],atualizadoEm:serverTimestamp()};
 await assertFails(setDoc(doc(db(null),path),payload));
 await assertSucceeds(setDoc(doc(db('aluno'),path),payload));
 await assertFails(setDoc(doc(db('outro'),path),{...payload,ownerUid:'outro'}));
 await assertFails(updateDoc(doc(db('aluno'),path),{turmas:['inexistente']}));
 const legacy='inscricoes/legacy';
 await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),legacy),{token,turmas:['1ano-a']}));
 await assertFails(setDoc(doc(db('aluno'),legacy),{...payload,token:'outro-token-secreto-longo'}));
 await assertSucceeds(setDoc(doc(db('aluno'),legacy),payload));
});


test('calendário acumulado pode ter até 23 dias; limite é apenas por escrita', async()=>{
 const path='salas/1ano-a/calendario/2026-10';
 const detalhes={};
 const materias={};
 for(let i=1;i<=23;i++) detalhes[`2026-10-${String(i).padStart(2,'0')}`]=`Nota ${i}`;
 for(let i=1;i<=12;i++) materias[`2026-10-${String(i).padStart(2,'0')}`]={Matemática:`Atividade ${i}`};
 await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),path),{avisos:'',detalhes,materias,fotos:{},revision:10}));
 const editor=db('editor-limites',{editorTurmas:['1ano-a']});
 await assertSucceeds(updateDoc(doc(editor,path),{detalhes:{...detalhes,'2026-10-23':'Alterada'},revision:11}));
 const onze={...detalhes};
 for(let i=1;i<=11;i++) onze[`2026-10-${String(i).padStart(2,'0')}`]=`Mudou ${i}`;
 await assertFails(updateDoc(doc(editor,path),{detalhes:onze,revision:12}));
});


test('salvamento conjunto preserva Base64 e aceita nova foto Base64', async()=>{
 const path='salas/1ano-a/calendario/2026-12';
 const day='2026-12-07';
 const legacy='data:image/png;base64,YQ==';
 const nova='data:image/jpeg;base64,Yg==';
 const old={avisos:'Antes',detalhes:{[day]:'Antes'},materias:{[day]:{'Português':'Antes'}},fotos:{[day]:[legacy,{img:legacy,desc:'legada'}]},revision:1};
 await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),path),old));
 const editor=db('editor-conjunto',{editorTurmas:['1ano-a']});
 await assertSucceeds(updateDoc(doc(editor,path),{avisos:'Depois',detalhes:{[day]:'Depois'},materias:{[day]:{'Português':'Antes','Matemática':''}},fotos:{[day]:[legacy,{img:legacy,desc:'legada'},{img:nova,desc:'Nova'}]},revision:2}));
});
