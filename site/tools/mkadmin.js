// Crée un compte administrateur : node tools/mkadmin.js <pseudo> <email> <motdepasse>
import { q } from '../db.js';
import crypto from 'node:crypto';

const [pseudo, email, pass] = process.argv.slice(2);
if (!pseudo || !email || !pass || pass.length < 8) {
  console.log('Usage : node tools/mkadmin.js <pseudo> <email> <motdepasse(8+)>');
  process.exit(1);
}
if (q.userByPseudo.get(pseudo) || q.userByEmail.get(email.toLowerCase())) {
  console.log('Pseudo ou e-mail déjà utilisé.');
  process.exit(1);
}
const SCRYPT = { N: 16384, r: 8, p: 1 };
const salt = crypto.randomBytes(16).toString('hex');
const h = crypto.scryptSync(pass, salt, 64, SCRYPT).toString('hex');
const r = q.insertUser.run(pseudo, email.toLowerCase(), `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${h}`);
q.setRole.run('admin', Number(r.lastInsertRowid));
q.setVerified.run(Number(r.lastInsertRowid));
console.log(`Admin créé : ${pseudo} <${email}> (id ${r.lastInsertRowid})`);
