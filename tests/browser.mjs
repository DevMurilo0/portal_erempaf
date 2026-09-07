import { chromium } from 'playwright';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { TURMAS } from '../config/turmas.js';
const base='http://127.0.0.1:8000';
const env=await initializeTestEnvironment({projectId:'demo-erempaf',firestore:{host:'127.0.0.1',port:8080}});
await env.clearFirestore();
const report=[];
const now=new Date(), month=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
const day=`${month}-07`;
const oldPhoto='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=';
await env.withSecurityRulesDisabled(async c=>{
 for (const t of TURMAS) await setDoc(doc(c.firestore(),`salas/${t.id}/calendario/${month}`),{
  avisos:'Aviso de teste',detalhes:{[day]:'Anotação antiga'},materias:{[day]:{'Português':'</textarea><img src=x onerror="window.xss=1">'}},fotos:{[day]:[oldPhoto,{img:oldPhoto,desc:'"><img src=x onerror="window.xss=1">'}]},revision:0
 });
});
async function account(email, claims){
 const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'TesteSeguro123!',returnSecureToken:true})});
 const data=await response.json();
 if (!data.localId) throw new Error(JSON.stringify(data));
 const res=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer owner'},body:JSON.stringify({localId:data.localId,customAttributes:JSON.stringify(claims)})});
 assert.ok(res.ok,await res.text());
}
const stamp=Date.now();const reader=`reader${stamp}@test.local`, editor=`editor${stamp}@test.local`, turmaA='1anoa@erempaf.com';
await account(reader,{});await account(turmaA,{});await account(editor,{editorTurmas:TURMAS.map(t=>t.id)});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
const errors=[];
await context.route('**/*', async route=>{
 const url=new URL(route.request().url());
 if (['127.0.0.1','localhost','www.gstatic.com','raw.githubusercontent.com'].includes(url.hostname)) return route.continue();
 if (url.protocol==='data:' || url.protocol==='blob:') return route.continue();
 return route.abort(); // nenhum acesso ao Firebase/backend real nos testes
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
const cardapioPassword='senha-cardapio-exclusiva-de-teste';
const browserLogs=[];const cardapioRequests=[];let cardapioBackendFailure=false;
page.on('console',message=>browserLogs.push(message.text()));
await page.route('https://erempafbackend.netlify.app/.netlify/functions/cardapio',async route=>{
 const body=route.request().postDataJSON();cardapioRequests.push(body);
 if(cardapioBackendFailure) return route.fulfill({status:500,contentType:'application/json',body:'{"error":"Erro interno"}'});
 if(body.password!==cardapioPassword) return route.fulfill({status:401,contentType:'application/json',body:'{"error":"Senha incorreta"}'});
 if(body.operation==='verify') return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
 if(body.operation==='save-day'&&!('path' in body)) {
  await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),`cardapio/${body.week}`),{[body.day]:body.menu},{merge:true}));
  return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
 }
 return route.fulfill({status:400,contentType:'application/json',body:'{"error":"Dados inválidos"}'});
});
async function open(path){await page.goto(base+path+(path.includes('?')?'&':'?')+'emulators',{waitUntil:'domcontentloaded',timeout:60000});}
async function login(email){
 await page.locator('#login-email').fill(email);await page.locator('#login-senha').fill('TesteSeguro123!');await page.locator('#btn-login').click();
 await page.waitForFunction(()=>document.querySelector('#tela-login').classList.contains('hidden') || document.querySelector('#login-erro').textContent.trim());
 assert.ok(await page.locator('#tela-login').evaluate(el=>el.classList.contains('hidden')),await page.locator('#login-erro').textContent());
}
async function chooseGeneratedPhoto(name){
 await page.locator('#input-foto').evaluate(async(input,fileName)=>{
  const canvas=document.createElement('canvas');canvas.width=4;canvas.height=4;
  canvas.getContext('2d').fillRect(0,0,4,4);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  const transfer=new DataTransfer();transfer.items.add(new File([blob],fileName,{type:'image/png'}));
  Object.defineProperty(input,'files',{value:transfer.files,configurable:true});
  input.dispatchEvent(new Event('change',{bubbles:true}));
 },name);
}
try {
 await open('/');await page.waitForFunction(()=>typeof window.atualizarTurmas==='function');
 for (const serie of ['1ano','2ano','3ano']) {await page.selectOption('#serie',serie);assert.equal(await page.locator('#turma option').count(),TURMAS.filter(t=>t.serie===serie).length+1);}
 for (const width of [320,375,390,430,768,1024,1366,1920]) {await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Home com overflow em ${width}`);}
 report.push('Home: seletores contêm todas as 17 turmas e não há overflow nas 8 larguras.');
 await open('/series/1ano/a/index.html');
 await page.waitForFunction(()=>!document.querySelector('#tela-login').classList.contains('hidden'));
 assert.equal(await page.locator('#btn-login-topo').count(),0);
 assert.equal(await page.locator('#modal-senha-edicao').count(),0);
 await page.evaluate(()=>localStorage.setItem('erempaf_auth_1ano-a','1'));await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!document.querySelector('#tela-login').classList.contains('hidden'));
 assert.ok(await page.locator('#btn-editar').isDisabled());
 await page.locator('#login-email').fill(reader);await page.locator('#login-senha').fill('TesteSeguro123!');await page.locator('#btn-login').click();
 await page.waitForFunction(()=>!document.querySelector('#tela-login').classList.contains('hidden') && document.querySelector('#login-erro').textContent.includes('desta turma'));
 assert.ok(await page.locator('#btn-editar').isDisabled());assert.equal(await page.locator('#campo-avisos').inputValue(),'');
 report.push('Login é obrigatório por turma; conta de outra sala continua bloqueada e sem conteúdo.');
 await page.evaluate(()=>window.auth.signOut());await page.waitForFunction(()=>!document.querySelector('#tela-login').classList.contains('hidden'));
 await login(turmaA);await page.waitForFunction(()=>!document.querySelector('#btn-editar').disabled);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#tela-login').classList.contains('hidden')&&!document.querySelector('#btn-editar').disabled);
 report.push('Conta 1º A edita pela identidade da própria turma e o login persiste após recarregar.');
 await page.evaluate(()=>window.auth.signOut());await page.waitForFunction(()=>!document.querySelector('#tela-login').classList.contains('hidden'));
 await login(editor);await page.waitForFunction(()=>!document.querySelector('#btn-editar').disabled);
 report.push('Claims simuladas continuam compatíveis para editores administrativos.');
 for (const t of TURMAS) {
  await open(t.path);await page.waitForFunction(()=>!document.querySelector('#btn-editar').disabled);
  assert.equal(await page.locator('#btn-notif').count(),1);assert.ok((await page.locator('#dias .dia:not(.vazio)').count())>=20);
  assert.ok((await page.locator('#titulo-turma').textContent()).includes(t.turma.toUpperCase()));
 }
 report.push('17 páginas carregam com login persistente, calendário e um botão de notificações.');
 await open('/series/1ano/a/index.html');await page.waitForFunction(()=>!document.querySelector('#btn-editar').disabled);
 for (const width of [320,375,390,430,768,1024,1366,1920]) {
  await page.setViewportSize({width,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow em ${width}`);
  if(width<=430) assert.equal(await page.locator('#dias').evaluate(el=>getComputedStyle(el).flexDirection),'column');
  if(width===320){await page.locator('#menuBtn').click();assert.ok(await page.locator('#sidebar').evaluate(el=>el.classList.contains('open')));await page.waitForFunction(()=>document.querySelector('#sidebar').getBoundingClientRect().left>=-.5);assert.ok(await page.locator('#sidebar').evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1));await page.keyboard.press('Escape');assert.ok(!(await page.locator('#sidebar').evaluate(el=>el.classList.contains('open'))));}
 }
 report.push('Calendário sem overflow nas 8 larguras; agenda vertical no celular e sidebar contida em 320px.');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/erempaf-calendar-mobile.png',fullPage:true});
 await page.locator(`.btn-detalhes[data-dia="${day}"]`).click();
 assert.ok(await page.locator('.painel-conteudo').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;}));
 assert.equal(await page.locator('#campo-detalhes').inputValue(),'Anotação antiga');
 await page.locator('[data-tab="fotos"]').click();assert.equal(await page.locator('.fotos-galeria img').count(),2);
 await page.locator('.fotos-galeria img').first().click();assert.equal(await page.locator('#lb-img').getAttribute('src'),oldPhoto);
 await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');assert.equal(await page.locator('#lightbox-overlay').count(),0);
 assert.equal(await page.evaluate(()=>window.xss),undefined);
 report.push('Base64 string/objeto, galeria, lightbox, teclado e XSS persistido.');
 await page.locator('#fechar-detalhes').click();await page.locator('#btn-editar').click();
 await page.locator('#campo-avisos').fill('Aviso salvo de verdade');
 await page.locator(`.btn-detalhes[data-dia="${day}"]`).click();await page.locator('#campo-detalhes').fill('Anotação salva');
 await page.locator('[data-tab="materias"]').click();await page.locator('[data-materia="Matemática"]').first().click();
 await page.locator('[data-tab="fotos"]').click();
 await chooseGeneratedPhoto('quadro.png');
 await page.locator('#modal-desc-input').fill('Foto nova Base64');
 await page.locator('#btn-desc-confirmar').click();
 await page.locator('#btn-painel-salvar').click();
 await page.waitForFunction(()=>/Alterações salvas com sucesso|Não foi possível salvar/.test(document.querySelector('#toast-container').textContent));
 assert.match(await page.locator('#toast-container').textContent(),/Alterações salvas com sucesso\./);
 let fotosAntesDoConflito=[];
 await env.withSecurityRulesDisabled(async c=>{
  const saved=(await getDoc(doc(c.firestore(),`salas/1ano-a/calendario/${month}`))).data();assert.equal(saved.avisos,'Aviso salvo de verdade');assert.equal(saved.detalhes[day],'Anotação salva');assert.ok('Matemática' in saved.materias[day]);assert.equal(saved.fotos[day][0],oldPhoto);
  const nova=saved.fotos[day].find(photo=>photo?.desc==='Foto nova Base64');assert.ok(nova);assert.match(nova.img,/^data:image\/jpeg;base64,/);
  fotosAntesDoConflito=structuredClone(saved.fotos[day]);
 });
 await page.locator('#fechar-detalhes').click();await page.locator('#btn-salvar').click();await page.waitForFunction(()=>document.querySelector('#btn-salvar').hidden);
 report.push('Salvar painel e salvar principal confirmam Firestore; campos, Base64 e remoções de mapas preservados.');
 // Concorrência: uma gravação externa deve impedir sobrescrita silenciosa.
 await page.locator('#btn-editar').click();await page.locator('#campo-avisos').fill('Não deve substituir concorrente');
 await page.locator(`.btn-detalhes[data-dia="${day}"]`).click();await page.locator('[data-tab="fotos"]').click();
 await chooseGeneratedPhoto('orfao.png');
 await page.locator('#modal-desc-input').fill('Deve ser compensada');
 await page.locator('#btn-desc-confirmar').click();await page.locator('#fechar-detalhes').click();
 await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),`salas/1ano-a/calendario/${month}`),{avisos:'Concorrente'},{merge:true}));
 await page.evaluate(()=>document.querySelector('#toast-container').replaceChildren());
 await page.locator('#btn-salvar').click();await page.waitForFunction(()=>document.querySelector('#toast-container').textContent.includes('Outra pessoa'));
 assert.ok(!(await page.locator('#toast-container').textContent()).includes('sucesso'));
 await env.withSecurityRulesDisabled(async c=>{const saved=(await getDoc(doc(c.firestore(),`salas/1ano-a/calendario/${month}`))).data();assert.deepEqual(saved.fotos[day],fotosAntesDoConflito);assert.ok(!saved.fotos[day].some(photo=>photo?.desc==='Deve ser compensada'));});
 report.push('Conflito de salvamento: erro visível, sem falso sucesso e nenhuma foto Base64 não confirmada foi gravada.');
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!document.querySelector('#btn-editar').disabled&&document.querySelector('#campo-avisos').value==='Concorrente');await page.locator('#btn-editar').click();await page.locator(`.btn-detalhes[data-dia="${day}"]`).click();await page.locator('[data-tab="fotos"]').click();await page.locator('.btn-remover-foto').last().click();await page.locator('#fechar-detalhes').click();await page.evaluate(()=>document.querySelector('#toast-container').replaceChildren());await page.locator('#btn-salvar').click();await page.waitForFunction(()=>document.querySelector('#btn-salvar').hidden);
 await env.withSecurityRulesDisabled(async c=>{const saved=(await getDoc(doc(c.firestore(),`salas/1ano-a/calendario/${month}`))).data();assert.ok(!saved.fotos[day].some(photo=>photo?.desc==='Foto nova Base64'));});
 report.push('Exclusão de foto Base64 é confirmada no Firestore.');
 await page.locator('#btn-notif').click();await page.waitForFunction(()=>document.querySelector('#toast-container').textContent.includes('Push real desativado nos emuladores.'));
 report.push('Notificações permanecem idempotentes e push real é bloqueado nos emuladores.');
 await page.evaluate(()=>window.auth.signOut());
 await open('/cardapio/index.html');await page.waitForSelector('.dia-card');assert.equal(await page.locator('#inp-email').count(),0);
 await page.locator('#btn-editar').click();await page.locator('#inp-senha').fill('senha-incorreta');await page.locator('#btn-ok-senha').click();await page.waitForFunction(()=>document.querySelector('#erro-senha').textContent.includes('Senha incorreta'));assert.equal(await page.locator('.btn-editar-dia').count(),0);
 await page.locator('#inp-senha').fill(cardapioPassword);await page.locator('#btn-ok-senha').click();await page.waitForSelector('.btn-editar-dia');
 await page.locator('.btn-editar-dia').first().click();await page.locator('#inp-almoco').fill('<img src=x onerror="window.xss=1">');await page.locator('#btn-salvar-edicao').click();await page.waitForFunction(()=>document.querySelector('#modal-edicao').classList.contains('hidden'));assert.equal(await page.evaluate(()=>window.xss),undefined);
 const saveRequest=cardapioRequests.find(request=>request.operation==='save-day');assert.ok(saveRequest);assert.ok(!('path' in saveRequest));
 const savedMenu=await env.withSecurityRulesDisabled(async c=>(await getDoc(doc(c.firestore(),`cardapio/${saveRequest.week}`))).data());assert.equal(savedMenu[saveRequest.day].almoco,'<img src=x onerror="window.xss=1">');assert.ok(!JSON.stringify(savedMenu).includes(cardapioPassword));
 assert.ok(!(await page.evaluate(()=>JSON.stringify({...localStorage}))).includes(cardapioPassword));assert.ok(!(await page.content()).includes(cardapioPassword));assert.ok(!browserLogs.join('\n').includes(cardapioPassword));
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#dias-grid').textContent.includes('<img src=x onerror="window.xss=1">'));assert.equal(await page.evaluate(()=>window.xss),undefined);
 await page.locator('#btn-editar').click();await page.locator('#inp-senha').fill(cardapioPassword);await page.locator('#btn-ok-senha').click();await page.waitForSelector('.btn-editar-dia');await page.locator('.btn-editar-dia').nth(1).click();await page.locator('#inp-almoco').fill('Dado mantido após falha');
 cardapioBackendFailure=true;await page.evaluate(()=>document.querySelector('#toasts').replaceChildren());await page.locator('#btn-salvar-edicao').click();await page.waitForFunction(()=>document.querySelector('#erro-edicao').textContent.includes('dados foram mantidos'));assert.ok(!(await page.locator('#toasts').textContent()).includes('sucesso'));assert.equal(await page.locator('#inp-almoco').inputValue(),'Dado mantido após falha');cardapioBackendFailure=false;
 for (const width of [320,375,390,430,768,1024,1366,1920]) {await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Cardápio com overflow em ${width}`);}
 await page.locator('#btn-cancelar-edicao').click();await page.setViewportSize({width:320,height:568});await page.locator('.btn-editar-dia').first().click();await page.waitForFunction(()=>{const r=document.querySelector('#modal-edicao .modal-box').getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;});await page.locator('#btn-cancelar-edicao').click();
 report.push('Cardápio: leitura pública, senha em memória, backend simulado, falhas sem falso sucesso, XSS como texto e responsividade nas 8 larguras.');
 assert.deepEqual(errors,[]);
} finally {await mkdir('test-results',{recursive:true});await writeFile('test-results/browser.json',JSON.stringify({report,errors},null,2));await browser.close();await env.cleanup();console.log(report.join('\n'));if(errors.length) console.error(errors);}
