import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { TURMAS } from '../config/turmas.js';
import { escapeHtml, photoSource, normalizedPhoto, stableJson } from '../shared/content.js';
const walk = dir => readdirSync(dir,{withFileTypes:true}).flatMap(e => e.name.startsWith('.') || e.name === 'node_modules' ? [] : e.isDirectory() ? walk(join(dir,e.name)) : [join(dir,e.name)]);
test('17 turmas físicas, únicas, incluindo 1F/3E/3F', () => {
  assert.equal(TURMAS.length,17); assert.equal(new Set(TURMAS.map(t=>t.id)).size,17);
  for (const t of TURMAS) assert.ok(existsSync('.'+t.path), t.path);
  for (const id of ['1ano-f','3ano-e','3ano-f']) assert.ok(TURMAS.some(t=>t.id===id));
  assert.equal(walk('series').filter(p=>p.endsWith('index.html')).length, TURMAS.length);
});
test('JavaScript local passa no parser', () => {
  for (const file of walk('.').filter(p=>/\.(js|mjs)$/.test(p))) {
    const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'}); assert.equal(r.status,0,file+'\n'+r.stderr);
  }
});
test('links, estilos e scripts locais existem', () => {
 for (const file of walk('.').filter(p=>p.endsWith('.html'))) {
  const html=readFileSync(file,'utf8');
  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
   const url=match[1]; if (/^(https?:|data:|mailto:|tel:|#|javascript:)/.test(url) || url.includes('${')) continue;
   const target=url.split(/[?#]/)[0];
   assert.ok(existsSync(target.startsWith('/')?'.'+target:resolve(dirname(file),target)), `${file}: ${url}`);
  }
 }
});
test('XSS: texto e atributos escapados; URLs executáveis e SVG recusados', () => {
 assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
 for (const src of ['javascript:alert(1)','data:image/svg+xml,<svg onload=alert(1)>','data:text/html,test']) assert.equal(photoSource(src),'');
 assert.equal(normalizedPhoto('data:image/png;base64,YQ==').img,'data:image/png;base64,YQ==');
 assert.equal(photoSource({url:'https://firebasestorage.googleapis.com/a'}),'https://firebasestorage.googleapis.com/a');
});
test('comparação concorrente ignora ordem de campos, preserva diferenças',()=>{
 assert.equal(stableJson({a:1,b:{x:2,y:3}}),stableJson({b:{y:3,x:2},a:1}));
 assert.notEqual(stableJson({a:1}),stableJson({a:2}));
});
test('arquivos de segurança e SEO não contêm marcadores ou URL social provisória',()=>{
 for (const file of ['firestore.rules']) {
  const rules=readFileSync(file,'utf8');
  assert.doesNotMatch(rules,/^\+/m,`${file}: marcador de patch perdido`);
 }
 for (const file of walk('.').filter(p=>p.endsWith('.html'))) {
  assert.doesNotMatch(readFileSync(file,'utf8'),/raw[.]githubusercontent[.]com/,file);
 }
});


test('limites de alteração do frontend continuam alinhados às Firestore Rules', () => {
  const calendar = readFileSync('series/calendario.js', 'utf8');
  const rules = readFileSync('firestore.rules', 'utf8');
  assert.match(calendar, /\['anotações',[\s\S]*?,\s*10\]/);
  assert.match(calendar, /\['matérias',[\s\S]*?,\s*5\]/);
  assert.match(calendar, /\['fotos',[\s\S]*?,\s*3\]/);
  assert.match(rules, /validDetails\(value, keys, mes\)[\s\S]*?keys\.size\(\) <= 10/);
  assert.match(rules, /validSubjectDays\(value, keys, mes\)[\s\S]*?keys\.size\(\) <= 5/);
  assert.match(rules, /validPhotoDays\(value, keys, sala, mes\)[\s\S]*?keys\.size\(\) <= 3/);
  assert.match(rules, /data:image\/\(jpeg\|png\|webp\);base64/);
  assert.doesNotMatch(readFileSync('shared/firebase.js','utf8'),/getStorage|connectStorageEmulator/);
  assert.doesNotMatch(calendar,/uploadPhoto|deletePhoto|storagePath|pendingBlobs/);
});

test('cardápio usa backend por senha e não mantém o modelo Firebase Auth antigo', () => {
  const files = ['cardapio/semana.js','cardapio/cardapio.js'];
  for (const file of files) {
    const source = readFileSync(file,'utf8');
    assert.match(source,/[/][.]netlify[/]functions[/]cardapio/);
    assert.doesNotMatch(source,/requireEditor\(['"]cardapio['"]\)|cardapioEditor|\bsetDoc\s*\(/);
    assert.doesNotMatch(source,/localStorage|sessionStorage/);
  }
  assert.doesNotMatch(readFileSync('shared/firebase.js','utf8'),/cardapioEditor/);
  assert.doesNotMatch(readFileSync('firestore.rules','utf8'),/cardapioEditor|menuEditor/);
  assert.match(readFileSync('firestore.rules','utf8'),/match \/cardapio\/\{document=\*\*\}[\s\S]*?allow read: if true;[\s\S]*?allow write: if false;/);
  for (const file of ['cardapio/index.html','assets/cardapio/index.html','cardapio/cardapio.html','assets/cardapio/cardapio.html']) {
    const html = readFileSync(file,'utf8');
    assert.doesNotMatch(html,/id=["']inp-email["']/);
  }
});

test('login das turmas é obrigatório e edição exige a senha da sala via backend', () => {
  const firebase = readFileSync('shared/firebase.js','utf8');
  const calendar = readFileSync('series/calendario.js','utf8');
  const rules = readFileSync('firestore.rules','utf8');
  assert.match(firebase,/browserLocalPersistence/);
  assert.match(firebase,/\^\[123\]ano-\[a-e\]\$/);
  assert.doesNotMatch(calendar,/btn-login-topo|\blogout\b/);
  assert.match(calendar,/modal-senha-edicao/);
  assert.match(calendar,/\.netlify\/functions\/calendario/);
  assert.match(calendar,/operation: 'verify'/);
  assert.match(calendar,/operation: 'save-month'/);
  assert.match(rules,/1anoa@erempaf[.]com/);
  assert.match(rules,/3anoe@erempaf[.]com/);
  assert.match(rules,/allow read: if editor\(sala\)/);
  assert.match(rules,/allow create, update, delete: if false/);
  assert.doesNotMatch(rules,/1anof@erempaf[.]com|3anof@erempaf[.]com/);
  for (const t of TURMAS) {
    const html = readFileSync('.'+t.path,'utf8');
    assert.match(html,/id=["']tela-login["']/);
    assert.doesNotMatch(html,/id=["']btn-login-topo["']/);
    assert.doesNotMatch(html,/id=["']modal-senha-edicao["']/);
    assert.doesNotMatch(html,/data-close[^>]*>Cancelar<\/button>/);
  }
});
