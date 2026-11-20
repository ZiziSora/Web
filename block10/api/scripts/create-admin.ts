import 'dotenv/config';
import { createDatabase } from '../src/db.js';
import { normalizeEmail, validEmail, validPassword } from '../src/auth.js';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';

const email=normalizeEmail(process.argv[2] ?? 'trannguyenduythinhhvn@gmail.com');
if(!validEmail(email)){console.error('Email admin không hợp lệ.');process.exit(1);}
if(!process.stdin.isTTY){console.error('Cần chạy lệnh trong terminal PowerShell/CMD tương tác, không qua pipe hoặc cửa sổ Output.');process.exit(1);}
let muted=false;
const output=new Writable({write(chunk,_encoding,callback){if(!muted)process.stdout.write(chunk);callback();}});
const rl=createInterface({input:process.stdin,output,terminal:true});
async function hidden(prompt:string){process.stdout.write(prompt);muted=true;try{return await rl.question('');}finally{muted=false;process.stdout.write('\n');}}
let db: ReturnType<typeof createDatabase> | undefined;
try{
 console.log('Ký tự mật khẩu được ẩn hoàn toàn khi gõ. Nhấn Enter sau mỗi lần nhập.');
 const password=await hidden('Mật khẩu admin (ẩn): '), confirm=await hidden('Nhập lại mật khẩu: ');
 if(!validPassword(password)){console.error('Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.');process.exitCode=1;}
 else if(password!==confirm){console.error('Mật khẩu nhập lại không khớp. Chạy lại lệnh và nhập cùng một mật khẩu hai lần.');process.exitCode=1;}
 else {
 db=createDatabase();
 await db.user.create({data:{id:randomBytes(32).toString('hex'),email,passwordHash:await bcrypt.hash(password,12),role:'admin',status:'active'}});
 console.log('Đã tạo admin: '+email);
 }
}catch(error){
 const code=(error as {code?:string}).code;
 if(code==='P2002')console.error('Email này đã có tài khoản. Lệnh tạo admin không ghi đè hoặc tự nâng quyền tài khoản có sẵn.');
 else console.error('Không tạo được admin do cấu hình hoặc kết nối database. Kiểm tra DATABASE_URL trong block10/api/.env.');
 process.exitCode=1;
}
finally{rl.close();await db?.$disconnect();}
