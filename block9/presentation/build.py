import json,html
from pathlib import Path
P=Path(__file__).resolve().parent
H=html.escape
raw=json.loads((P/'evidence/http.json').read_text(encoding='utf-8'))
runs=raw['runs']
def table(rows):return '<table><tbody>'+''.join('<tr>'+''.join('<td>'+str(c)+'</td>' for c in r)+'</tr>' for r in rows)+'</tbody></table>'
def image(name):
 f=P/'assets'/name
 return f'<a href="assets/{name}" target="_blank"><img class="proof" src="assets/{name}" alt="Ảnh ứng dụng trong fixture cô lập"></a>' if f.exists() else '<p>Chưa thu thập ảnh này</p>'
def case(id,title,action,expect,indices):
 selected=[runs[i] for i in indices];status='PASS' if all(x['status']=='PASS' for x in selected) else 'FAIL'
 item=dict(id=id,title=title,action=action,expected=expect,status=status,runs=[x['name'] for x in selected],source='api/src/auth.ts · app.ts · tokens.ts',environment=raw['environment'])
 cases.append(item)
 http=[r for x in selected for r in x['http']]
 # Use actual response examples, never constructed success payloads.
 rules={'J05':('OPTIONS',None,204),'J01':('POST','/api/dishes',401),'J02':('GET','/api/auth/me',200),'J03':('GET','/api/auth/me',401),'J04':('GET','/api/auth/me',401),'J06':('GET','/api/dishes',200),'R01':('POST','/api/auth/register',200),'R02':('POST','/api/auth/register',400),'R03':('POST','/api/auth/activate',400),'R04':('POST','/api/auth/login',400),'R05':('POST','/api/auth/login',400),'F01':('POST','/api/auth/forgot',200),'F02':('POST','/api/auth/forgot',429),'F03':('POST','/api/auth/reset/prepare',200),'F04':('POST','/api/auth/reset/prepare',400),'F05':('POST','/api/auth/reset',200)}
 method,path,statusCode=rules[id]
 sample=next((r for r in http if r['method']==method and (path is None or r['path']==path) and r['status']==statusCode),{})
 sample={k:sample[k] for k in ['method','path','status','response'] if k in sample}
 if id=='J05':sample['headers']=next(r['responseHeaders'] for r in http if r['method']=='OPTIONS')
 if id in ['R01','F03']:sample['snapshot']=selected[0]['snapshots']

 body=f'<div class="two-col"><div><h3>Thao tác</h3><p>{action}</p><h3>Kết quả cần chứng minh</h3><p>{expect}</p><p class="result">{status} · assertion đã chạy</p></div><div><h3>Phản hồi quan sát</h3><pre>{H(json.dumps(sample,ensure_ascii=False,indent=None))}</pre></div></div><p class="source-note"><a href="evidence.html#{id}" target="_blank">{id} · Mở toàn bộ request, response và snapshot →</a></p>'
 return body
cases=[]
slides=[]
def add(title,lead,body,notes=''):
 slides.append((title,lead,body,notes or 'Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.'))
add('Block 9 · JWT và API','The Table / React CSR + Express JSON API', '<p class="hero">Minh chứng nghiệm thu<br>Đăng ký · Đăng nhập · Khôi phục tài khoản</p><p>20 slide chính · 4 phụ lục · 15–20 phút</p><div class="callout">Toàn bộ kết quả trong bài được thu thập bằng fixture cô lập. Authorization, OTP, token và mật khẩu đã che.</div>')
add('Phạm vi nghiệm thu','16 dòng yêu cầu trong ba bảng nghiệm thu',table([['JWT và API','6 kịch bản: API trực tiếp, token, role, CORS, đọc công khai'],['Đăng ký và đăng nhập','5 kịch bản: viewer, CAPTCHA, OTP, pending, ngưỡng login'],['Quên mật khẩu','5 kịch bản: phản hồi chung, 429, prepare, token lỗi, reset'],['Bằng chứng nộp','UI, HTTP, storage, email test, repository, sơ đồ và mô-đun chuyển đổi']]))
add('Từ Block 8 sang API','Giữ nghiệp vụ; chuyển rendering và xác thực',table([['Mô-đun','Block 8','Block 9'],['Giao diện','EJS / SSR','React CSR, route /register, /login, /reset'],['Đăng nhập','Session-cookie','JWT Bearer + refresh rotation'],['Auth / OTP / reset','Form server + redirect','JSON /api/auth/* + điều hướng React'],['CRUD / tìm kiếm','Trang server','/api/dishes, /chefs, /ingredients'],['Lưu trữ','Prisma/PostgreSQL','Thêm AuthSession, RefreshToken và version']]),'Đối chiếu block8/src và block9/api/src cùng web/src. Mô-đun nghiệp vụ tiếp tục chạy phía API; trình duyệt dựng trang bằng React. Role viewer chưa phải RBAC.')
add('Luồng đăng nhập JWT','API xác minh tài khoản; trình duyệt giữ access token trong bộ nhớ', '<div class="flow">React /login → CSRF → POST /api/auth/login<br>↓<br>bcrypt + active + CAPTCHA / rate limit<br>↓<br>JWT → bộ nhớ React &nbsp; | &nbsp; refresh → cookie HttpOnly<br>↓<br>Authorization: Bearer → API → chữ ký + hạn + version DB</div><div class="callout">Reload → POST refresh → JWT mới. ACCESS_EXPIRED → refresh và thử lại tối đa một lần.</div>','Bộ nhớ tránh lưu access token lâu dài trong localStorage. Cookie HttpOnly không đọc được bằng JavaScript; refresh vẫn cần CSRF. Logout thu hồi phiên hiện tại, reset thu hồi toàn bộ phiên của user.')
add('Nơi lưu token','Access: bộ nhớ · Refresh: cookie HttpOnly', '<div class="two-col"><div>'+table([['Access','Không lưu localStorage/sessionStorage'],['Refresh','HttpOnly · SameSite=Lax · Path=/api/auth'],['Thời hạn mặc định','Access 600 giây; phiên 28.800 giây'],['Repository','SHA-256 refresh; giữ lịch sử phát hiện replay']])+'</div><div>'+image('admin-1440.png')+'</div></div><p><a href="evidence/storage-1440.json">Cookie/storage quan sát →</a></p>')
add('Preflight và CSRF','OPTIONS cho origin cụ thể; mutation cần X-CSRF-Token',case('J05','Preflight Authorization','OPTIONS /api/dishes/1, origin fixture, method PATCH','204; Allow-Origin đúng origin, Allow-Headers có Authorization; thiếu CSRF bị 403',[1]))
add('CRUD khi chưa đăng nhập','POST · PATCH · DELETE đều bị chặn ở API',case('J01','Mutation không token','Gọi ba phương thức trực tiếp, không có Bearer','401 trước khi thực hiện nghiệp vụ',[18]))
add('Gọi API trực tiếp','Bỏ qua giao diện vẫn chịu cùng middleware',case('J02','API trực tiếp','Dùng HTTP client gọi endpoint bảo vệ và đối chiếu contract mà React gọi','Cookie đơn lẻ không cấp quyền; Bearer hợp lệ cho phép đọc',[0,1]),'Mở hồ sơ HTTP: API middleware áp dụng độc lập giao diện. Các test browser kiểm tra UI gọi ứng dụng thật trên fixture; không tuyên bố có ảnh DevTools thật. So sánh CRUD chi tiết xem test-results.txt.')
add('JWT bị sửa hoặc hết hạn','401 ở request trực tiếp; frontend có thể refresh khi ACCESS_EXPIRED',case('J03','JWT không hợp lệ','Thay chữ ký/claims; tiến đồng hồ fixture qua thời hạn access','Chữ ký/claims sai bị từ chối; token hết hạn trả ACCESS_EXPIRED',[2,4,16]))
add('Role phía client không quyết định quyền','Storage là dữ liệu người dùng có thể tự sửa',case('J04','Sửa role','Gán role admin trong localStorage; thay role trong payload JWT','Identity không đổi khi sửa storage; JWT sửa payload bị 401',[18])+'<p><a href="evidence/role-1440.json">So sánh identity trước/sau sửa storage →</a></p>','Ứng dụng chưa có RBAC: user active role viewer vẫn CRUD. Không diễn giải viewer thành read-only. Browser assertion xác nhận identity trước/sau giống nhau; payload sửa không có chữ ký hợp lệ.')
add('Đọc món không cần token','Thực đơn, chi tiết, tìm kiếm và phân trang tiếp tục công khai',case('J06','GET công khai','GET /api/dishes, facets, detail; tìm kiếm và phân trang theo contract','HTTP 200; envelope và dữ liệu danh sách giữ contract nghiệp vụ',[1,19])+'<p class="source-note">Kiểm thử tìm kiếm/phân trang đầy đủ: api/test/app.test.ts · test-results.txt</p>')
add('Đăng ký luôn tạo viewer','Body role: admin không được tin cậy',case('R01','Đăng ký role admin','POST register kèm role admin và CAPTCHA fixture hợp lệ','User được lưu với role viewer và status pending; password là bcrypt',[7]))
add('CAPTCHA thiếu hoặc sai','Không tạo user và không gửi OTP',case('R02','CAPTCHA đăng ký','Gửi đăng ký không recaptchaToken và gửi token không hợp lệ','400; repository không có user, số email test không tăng',[7,18]))
add('OTP sai, hết hạn hoặc đã dùng','Kích hoạt một lần; tài khoản chưa xác minh không được cấp quyền',case('R03','OTP không hợp lệ','OTP sai, resend thay mã, hết hạn, dùng lại OTP thành công','Các request lỗi bị từ chối; pending giữ nguyên trước kích hoạt; user active không bị đổi về pending',[7,9,19]))
add('Pending đăng nhập qua API','Không cấp accessToken',case('R04','Pending login','Đăng ký thành công nhưng chưa kích hoạt rồi gọi login','Request bị từ chối; không có data.accessToken',[18]))
add('Login đến ngưỡng CAPTCHA','Sau ba lần sai, bỏ CAPTCHA sẽ bị từ chối',case('R05','CAPTCHA login','Sai ba lần, tiếp tục login bỏ recaptchaToken','CAPTCHA_REQUIRED; không cấp token; giải CAPTCHA không xóa số lần sai',[10]))
add('Forgot và giới hạn gửi','Phản hồi chung giúp tránh tiết lộ tài khoản',case('F01','Forgot email có/không','Gửi cùng API với email tồn tại và không tồn tại','Cùng HTTP status và cùng response body',[11])+case('F02','Forgot rate limit','Gửi quá 5 lần/giờ/email bằng fixture','429 RATE_LIMITED; có Retry-After',[18]))
add('Mở reset chưa tiêu thụ token','Prepare lưu digest trong session; URL được làm sạch',case('F03','Reset prepare','Mở link reset rồi reload, chưa submit mật khẩu','usedAt vẫn null; prepare không trả token ra response',[11])+'<p><a href="assets/auth-reset-1440.png">Mở ảnh trang reset →</a></p>')
add('Reset token không hợp lệ','Token cũ, hết hạn, đã dùng đều bị từ chối',case('F04','Reset token lỗi','Tạo link mới, dùng link cũ; tiến quá hạn; dùng lại link đã reset','400; không đổi mật khẩu bằng token lỗi',[11,12]))
add('Sau reset mật khẩu','Không tự đăng nhập; thu hồi mọi phiên cũ',case('F05','Reset thành công','POST reset, thử mật khẩu cũ/mới và JWT/refresh trên hai thiết bị','Không cấp accessToken khi reset; mật khẩu mới đăng nhập được; access/refresh cũ bị từ chối',[11]))
add('A1 · Ma trận nghiệm thu','16 kịch bản có mã liên kết tới hồ sơ',table([[f'<a href="evidence.html#{x["id"]}">{x["id"]}</a>',x['title'],x['status']] for x in cases]),'Mở evidence.html để xem toàn bộ request đã che và assertion nguồn. PASS là kết quả test cô lập, không phải nghiệm thu môi trường thật.')
add('A2 · Danh mục minh chứng','Ảnh ứng dụng thật chạy trên fixture; email/repository là test', '<div class="two-col"><div>'+image('auth-register-1440.png')+'</div><div>'+image('auth-reset-390.png')+'</div></div><p><a href="evidence.html">HTTP + snapshot + ảnh + storage →</a></p>')
add('A3 · API và các ngưỡng','Các mặc định được đối chiếu với mã nguồn Block 9',table([['/api/auth/*','csrf · register · activate · login · refresh · logout · forgot · reset/prepare · reset'],['Login','CAPTCHA sau 3 sai; khóa 15 phút khi sai 10'],['OTP','10 phút; sai 5 khóa 15 phút; resend cooldown 60 giây'],['Forgot / reset','5 lần/giờ/email; reset token 30 phút'],['JWT / refresh','600 giây / 28.800 giây; logout tăng sessionVersion, reset tăng userVersion']]))
add('A4 · Chạy lại và phần cần bổ sung','Không kết luận thay cho nghiệm thu dịch vụ thật', '<pre>cd block9\nnode --import tsx --test presentation/collect.test.ts\nnode --import tsx presentation/collect-browser.ts\npython presentation/build.py\nnode presentation/verify.mjs</pre><div class="callout">Còn cần môi trường thật: Google reCAPTCHA, email SMTP và bản ghi PostgreSQL. Chụp Network/Application và email đã che theo từng mã kịch bản trước khi nộp nếu giảng viên yêu cầu.</div>')
base=(P.parent.parent/'block8/presentation/index.html').read_text(encoding='utf-8')
nav=base[base.index('<nav class="nav"'):];nav=nav.replace('01 / 21','01 / 24')
out='<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Block 9 · Minh chứng</title><link rel="icon" href="data:,"><link rel="stylesheet" href="styles.css"><script src="slides.js" defer></script><body><div class="progress"><div id="progress"></div></div><main class="stage"><div class="deck">'
for i,(title,lead,body,notes) in enumerate(slides,1):
 out+=f'<section class="slide {"active" if i==1 else ""}" id="slide-{i}" data-title="{H(title)}"><div class="masthead"><span>BLOCK 09 / THE TABLE</span><span>Minh chứng · Test cô lập</span></div><h2>{title}</h2><p class="lead">{lead}</p><div class="body">{body}</div><div class="footer"><span>React CSR · Express API · fixture cô lập</span><span>{i:02} / 24</span></div><aside class="speaker-notes"><h3>Lời trình bày</h3><p>{notes}</p><p>Thời lượng: {"45–60 giây" if i<=20 else "Tra cứu"}</p><h3>Nguồn</h3><p>Block 9: api/src, web/src, api/test/auth.test.ts; evidence/http.json</p></aside></section>'
out+='</div></main>'+nav
(P/'index.html').write_text(out,encoding='utf-8')
(P/'evidence/cases.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2),encoding='utf-8')
e='<!doctype html><html lang="vi"><meta charset="utf-8"><title>Block 9 · Hồ sơ minh chứng</title><link rel="stylesheet" href="styles.css"><main class="evidence-page"><a href="index.html">← Slide</a><h1>Hồ sơ minh chứng Block 9</h1><p>HTTP thực tế trong fixture cô lập. Không phải Google / SMTP / PostgreSQL thật. Mỗi nhóm bên dưới chứa toàn bộ request của bài test liên quan; không chỉ trích một phản hồi.</p><input id="filter" class="filter" placeholder="Lọc mã hoặc nội dung"><p><a href="evidence/http.json">Dữ liệu HTTP đã che</a> · <a href="evidence/test-results.txt">Log test</a> · <a href="evidence/storage-1440.json">Storage</a> · <a href="evidence/role-1440.json">Role trước/sau</a></p>'
for c in cases:
 e+=f'<section class="entry" id="{c["id"]}"><h2>{c["id"]} · {c["title"]}</h2><p>{c["action"]}</p><p>Cần chứng minh: {c["expected"]} · {c["status"]}</p>'
 for run in runs:
  if run['name'] in c['runs']:e+=f'<details><summary>{H(run["name"])} · {run["status"]}</summary><pre>{H(json.dumps(run,ensure_ascii=False,indent=2))}</pre></details>'
 e+='</section>'
e+='<h2>Ảnh giao diện fixture</h2><div class="gallery">'+''.join(f'<figure>{image(f.name)}<figcaption>{f.name}</figcaption></figure>' for f in sorted((P/'assets').glob('*.png')) if 'failure' not in f.name)+'</div><script>document.querySelector("#filter").oninput=e=>document.querySelectorAll(".entry").forEach(x=>x.hidden=!x.textContent.toLowerCase().includes(e.target.value.toLowerCase()));</script></main></html>'
(P/'evidence.html').write_text(e,encoding='utf-8')
(P/'SCRIPT.md').write_text('\n\n'.join(f'## {i}. {t}\n{l}\n\n{n}' for i,(t,l,b,n) in enumerate(slides,1)),encoding='utf-8')
print(f'Built {len(slides)} slides; {len(cases)} acceptance cases')
