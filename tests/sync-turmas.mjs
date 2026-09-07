import { readFileSync, writeFileSync } from 'node:fs';
import { TURMAS } from '../config/turmas.js';
const file='firestore.rules';
const rules=readFileSync(file,'utf8');
const next=rules.replace(/d\.turmas\.hasOnly\(\[[^\]]*\]\)/,`d.turmas.hasOnly([${TURMAS.map(t=>`'${t.id}'`).join(',')}])`).replace(/d\.turmas\.size\(\) <= \d+/, `d.turmas.size() <= ${TURMAS.length}`);
if(next!==rules) writeFileSync(file,next);
