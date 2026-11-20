import 'dotenv/config';
import pg from 'pg';
import { databaseConfig } from '../src/config.js';

// Source and destination use the same PostgreSQL database; the source is SELECT-only.
const config=databaseConfig(), pool=new pg.Pool({connectionString:config.url,connectionTimeoutMillis:15000});
if(config.schema!=='block10')throw new Error('Lệnh sao chép chỉ chấp nhận schema đích block10.');
const apply=process.argv.includes('--apply');
const client=await pool.connect();
try{
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
 await client.query("SELECT pg_advisory_xact_lock(hashtext('block10-copy-data'))");
 const tables=['Chef','Ingredient','Dish','_ChefToDish','_DishToIngredient'];
 const counts:Record<string,number>={};
 for(const name of tables){
  const count=await client.query(`SELECT count(*)::int AS n FROM block9."${name}"`);counts[name]=count.rows[0].n;
  const dest=await client.query(`SELECT count(*)::int AS n FROM block10."${name}"`);if(dest.rows[0].n)throw new Error('Đích đã có dữ liệu; từ chối ghi đè.');
 }
 console.log({mode:apply?'apply':'dry-run',source:'block9',destination:'block10',counts});
 if(apply){
  for(const name of tables){
   const cols=name==='Dish'?'"id","name","description","price","category","available"':name==='Chef'?'"id","name","specialty"':name==='Ingredient'?'"id","name","unit"':'"A","B"';
   await client.query(`INSERT INTO block10."${name}" (${cols}) SELECT ${cols} FROM block9."${name}"`);
   const check=await client.query(`SELECT count(*)::int AS n FROM block10."${name}"`);if(check.rows[0].n!==counts[name])throw new Error('Số lượng sao chép không khớp.');
  }
  for(const name of ['Dish','Chef','Ingredient'])await client.query(`SELECT setval(pg_get_serial_sequence('block10."${name}"','id'),COALESCE((SELECT max(id) FROM block10."${name}"),1),EXISTS(SELECT 1 FROM block10."${name}"))`);
 }
 await client.query(apply?'COMMIT':'ROLLBACK');
 console.log(apply?'Đã sao chép; không sao chép tài khoản.':'Kiểm tra thành công; thêm --apply để sao chép.');
}catch{await client.query('ROLLBACK');console.error('Không sao chép được. Kiểm tra schema nguồn/đích, đích phải trống. Không thay đổi block9.');process.exitCode=1;}
finally{client.release();await pool.end();}
