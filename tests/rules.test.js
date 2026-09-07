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

test('calendário: leitura só da própria turma; escrita direta sempre bloqueada',async()=>{
 await env.withSecurityRulesDisabled(async c=>{
   await setDoc(doc(c.firestore(),month),data);
   await setDoc(doc(c.firestore(),'salas/1ano-a'),{senha:'senha-de-teste'});
 });
 const contaTurma=db('conta-1a',{email:'1anoa@erempaf.com'});
 const outraTurma=db('conta-1b',{email:'1anob@erempaf.com'});
 const admin=db('editor',{editorTurmas:['1ano-a']});
 await assertSucceeds(getDoc(doc(contaTurma,month)));
 await assertSucceeds(getDoc(doc(admin,month)));
 await assertFails(getDoc(doc(outraTurma,month)));
 await assertFails(getDoc(doc(db(null),month)));
 await assertFails(setDoc(doc(contaTurma,month),{...data,revision:2}));
 await assertFails(updateDoc(doc(contaTurma,month),{avisos:'x'}));
 await assertFails(setDoc(doc(admin,month),{...data,revision:2}));
 await assertFails(deleteDoc(doc(admin,month)));
 await assertFails(getDoc(doc(contaTurma,'salas/1ano-a'))); // a senha da sala nunca vai para o navegador
 await assertFails(setDoc(doc(contaTurma,'salas/1ano-a'),{senha:'nova'}));
});

test('cardápio: leitura pública e toda escrita direta do cliente bloqueada',async()=>{
 const path='cardapio/2026-09-07', menu={'2026-09-07':{almoco:'Arroz',status:'normal'}};
 await assertSucceeds(getDoc(doc(db(null),path)));
 await assertFails(setDoc(doc(db(null),path),menu));
 await assertFails(setDoc(doc(db('aluno'),path),menu));
 await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),path),menu));
 await assertSucceeds(getDoc(doc(db(null),path)));
 await assertFails(updateDoc(doc(db('aluno'),path),{'2026-09-07':{almoco:'Outro'}}));
 await assertFails(deleteDoc(doc(db('aluno'),path)));
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
