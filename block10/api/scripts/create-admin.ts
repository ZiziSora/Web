import 'dotenv/config';
import { createDatabase } from '../src/db.js';
import { normalizeEmail, validEmail, validPassword } from '../src/auth.js';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';

const email=normalizeEmail(process.argv[2] ?? 'trannguyenduythinhhvn@gmail.com');
if(!validEmail(email)||!process.stdin.isTTY)throw new Error('Cần terminal tương tác và email hợp lệ.');
let muted=false;
const output=new Writable({write(chunk,_encoding,callback){if(!muted)process.stdout.write(chunk);callback();}});
const rl=createInterface({input:process.stdin,output,terminal:true});
async function hidden(prompt:string){process.stdout.write(prompt);muted=true;try{return await rl.question('');}finally{muted=false;process.stdout.write('\n');}}
const db=createDatabase();
try{
 const password=await hidden('Mật khẩu admin (ẩn): '), confirm=await hidden('Nhập lại mật khẩu: ');
 if(!validPassword(password)||password!==confirm)throw new Error('Mật khẩu không hợp lệ hoặc không khớp.');
 await db.user.create({data:{id:randomBytes(32).toString('hex'),email,passwordHash:await bcrypt.hash(password,12),role:'admin',status:'active'}});
 console.log('Đã tạo admin: '+email);
}catch{console.error('Không tạo được admin. Kiểm tra email trùng, mật khẩu và kết nối database.');process.exitCode=1;}
finally{rl.close();await db.$disconnect();}
