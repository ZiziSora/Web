"""Build the offline Block 10 deck and original SVG flow diagrams."""
from html import escape as h
from pathlib import Path

P = Path(__file__).resolve().parent
A = P / 'assets'
A.mkdir(exist_ok=True)


def node(x, y, w, lines, tone='normal', height=98):
    fill, stroke = {'normal': ('#f3f6f9', '#0874bb'), 'good': ('#e7f4ed', '#087146'), 'bad': ('#fff2f4', '#df1740')}[tone]
    text_y = y + height / 2 - (len(lines) - 1) * 14 + 7
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{height}" rx="8" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
            + ''.join(f'<text x="{x+w/2}" y="{text_y+i*28}" text-anchor="middle">{h(line)}</text>' for i, line in enumerate(lines)))


def arrow(points, label='', at=None):
    s = f'<polyline points="{points}" fill="none" stroke="#637386" stroke-width="2.5" marker-end="url(#arrow)"/>'
    if label and at:
        s += f'<text class="label" x="{at[0]}" y="{at[1]}" text-anchor="middle" paint-order="stroke" stroke="white" stroke-width="7">{h(label)}</text>'
    return s


def svg(name, title, description, content, height=430):
    data = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1184 {height}" role="img" aria-labelledby="title desc">'
            f'<title id="title">{h(title)}</title><desc id="desc">{h(description)}</desc>'
            '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#637386"/></marker></defs>'
            '<style>text{font:600 21px "Segoe UI",Arial,sans-serif;fill:#083b79}.label{font-size:18px;font-weight:500;fill:#637386}</style>'
            + content + '</svg>')
    (A / name).write_text(data, encoding='utf-8')


svg('rbac-flow.svg', 'Sơ đồ luồng phân quyền tại API',
    'Request được kiểm tra JWT, tài khoản và phiên trong database, rồi kiểm tra role theo thao tác. Xác thực sai trả 401, thiếu quyền trả 403, đủ quyền đi tiếp tới nghiệp vụ.',
    node(10, 62, 180, ['Request', 'Bearer token'])
    + node(245, 62, 205, ['Kiểm tra JWT', 'chữ ký / hạn'])
    + node(505, 62, 235, ['Đọc user / session', 'active / version'])
    + node(795, 62, 165, ['Role được', 'phép?'])
    + node(1010, 62, 164, ['CSRF¹', '→ Nghiệp vụ'], 'good')
    + node(355, 278, 300, ['401 · Chưa xác thực', 'hoặc phiên hết hiệu lực'], 'bad')
    + node(760, 278, 260, ['403 · FORBIDDEN', 'Không đủ quyền'], 'bad')
    + arrow('190,111 245,111') + arrow('450,111 505,111')
    + arrow('740,111 795,111') + arrow('960,111 1010,111', 'Có', (985, 94))
    + arrow('347,160 347,232 425,232 425,278', 'Sai', (328, 204))
    + arrow('622,160 622,232 585,232 585,278', 'Sai', (647, 204))
    + arrow('877,160 877,278', 'Không', (915, 224)))

svg('mfa-setup-flow.svg', 'Sơ đồ bật hoặc thay Authenticator',
    'Từ Settings, xác thực mật khẩu và yếu tố cũ nếu có, tạo secret và QR tạm, xác minh TOTP mới, rồi mới lưu MFA chính thức và cấp recovery code. Sai hoặc hết hạn không thay secret đang dùng.',
    node(10, 70, 185, ['Settings', 'Bật / thay MFA'])
    + node(240, 70, 215, ['Mật khẩu hiện tại', '+ yếu tố cũ¹'])
    + node(500, 70, 205, ['Secret + QR tạm', 'Hạn 5 phút'])
    + node(750, 70, 180, ['Nhập TOTP', 'của secret mới'])
    + node(975, 70, 199, ['Xác nhận đúng', 'Lưu MFA mới'], 'good')
    + node(550, 285, 300, ['Sai / hết hạn', 'Giữ trạng thái MFA cũ'], 'bad')
    + node(930, 285, 244, ['10 recovery code', 'Thu hồi mọi phiên'], 'good')
    + arrow('195,119 240,119') + arrow('455,119 500,119')
    + arrow('705,119 750,119') + arrow('930,119 975,119', 'Đúng', (952, 102))
    + arrow('840,168 840,236 700,236 700,285', 'Sai', (790, 222))
    + arrow('1074,168 1074,285'))

svg('mfa-login-flow.svg', 'Sơ đồ đăng nhập với MFA',
    'Đăng nhập kiểm tra mật khẩu, trạng thái tài khoản và CAPTCHA theo quy tắc. Nếu chưa bật MFA thì cấp phiên; nếu đã bật thì chỉ tạo challenge 5 phút. TOTP hoặc recovery hợp lệ mới cấp access và refresh. Sai năm lần khóa xác minh 15 phút.',
    node(10, 45, 185, ['POST /login', 'Email / password'])
    + node(240, 45, 235, ['Password / active', 'CAPTCHA / giới hạn'])
    + node(525, 45, 205, ['MFA đang bật?'])
    + node(800, 45, 374, ['Challenge 5 phút · cookie HttpOnly', 'Chưa cấp access / refresh'])
    + node(235, 269, 240, ['Từ chối đăng nhập', 'Không cấp grant'], 'bad')
    + node(525, 269, 205, ['Cấp JWT access', '+ refresh cookie'], 'good')
    + node(800, 210, 374, ['POST /mfa/verify', 'TOTP hoặc recovery code'])
    + node(800, 365, 374, ['Sai 5 lần → khóa 15 phút', '429 + Retry-After'], 'bad', 78)
    + arrow('195,94 240,94') + arrow('475,94 525,94', 'Đúng', (500, 77))
    + arrow('730,94 800,94', 'Có', (764, 77))
    + arrow('357,143 357,269', 'Sai', (335, 216))
    + arrow('627,143 627,269', 'Không', (661, 216))
    + arrow('987,143 987,210')
    + arrow('800,259 765,259 765,318 730,318', 'Đúng¹', (760, 245))
    + arrow('987,308 987,365', 'Sai', (1012, 344)), height=460)


def table(headers, rows, css=''):
    return (f'<table class="{css}"><thead><tr>' + ''.join(f'<th scope="col">{h(x)}</th>' for x in headers)
            + '</tr></thead><tbody>' + ''.join('<tr><th scope="row">' + h(row[0]) + '</th>'
            + ''.join(f'<td>{value}</td>' for value in row[1:]) + '</tr>' for row in rows) + '</tbody></table>')


def diagram(name, caption):
    return f'<figure class="diagram"><img src="assets/{name}" alt="{h(caption)}"><figcaption>{h(caption)}</figcaption></figure>'


slides = []


def add(title, lead, body, notes, sources, appendix=False):
    slides.append(dict(title=title, lead=lead, body=body, notes=notes, sources=sources, appendix=appendix))


add('Block 10 · Phân quyền & MFA', 'THE TABLE / React CSR + Express API + PostgreSQL',
    '<div class="cover-content"><p class="hero">Đúng người.<br>Đúng quyền.<br>Thêm một lớp xác thực.</p><div class="cover-topics"><span>01 · Ma trận RBAC</span><span>02 · Luồng & thông số MFA</span></div><p class="muted">11 slide chính · 1 phụ lục · Khoảng 12–15 phút</p></div>',
    'Giới thiệu hai nội dung trọng tâm: ma trận quyền viewer/editor/admin và các sơ đồ nhóm tự dựng theo mã nguồn để giải thích luồng phân quyền, bật MFA và đăng nhập MFA. Bộ slide dùng template Block 9 nhưng trình bày hành vi Block 10.',
    ['../README.md'])

add('Từ Block 9 đến Block 10', 'Giữ nền tảng JWT; bổ sung quyền theo vai trò và bảo mật tài khoản',
    table(['Thành phần', 'Block 9', 'Block 10'], [
        ['Vai trò', 'viewer là nhãn tài khoản', 'viewer / editor / admin có quyền riêng'],
        ['Đăng nhập', 'Password → access / refresh', 'Bật MFA → xác minh thêm trước khi cấp phiên'],
        ['Tài khoản', 'Đăng ký / kích hoạt / reset', 'Thêm Settings, Authenticator, recovery code'],
        ['Quản trị', 'Người dùng active truy cập CRUD', 'Admin cấp / thu hồi editor'],
    ]) + '<div class="callout"><strong>Phân quyền</strong> quyết định được làm gì. <strong>MFA</strong> bổ sung yếu tố xác thực khi đăng nhập.</div>',
    'Block 9 đặt nền móng JWT và refresh rotation. Block 10 thêm kiểm tra role ở API và route guard ở React. MFA xác minh thêm yếu tố sở hữu ứng dụng Authenticator, sau bước mật khẩu. Quyền và MFA giải quyết hai câu hỏi khác nhau.',
    ['../../block9/README.md', '../README.md', '../api/src/app.ts', '../api/src/security.ts'])

permissions = [
    ['Xem thực đơn / chi tiết món', True, True, True],
    ['Thêm / sửa / xóa món ăn', False, True, True],
    ['Xem / chọn đầu bếp, nguyên liệu¹', False, True, True],
    ['Thêm / sửa / xóa đầu bếp, nguyên liệu', False, False, True],
    ['Xem tài khoản; cấp / thu hồi editor²', False, False, True],
    ['Settings / mật khẩu / MFA của bản thân', True, True, True],
]
matrix = [[r[0]] + [f'<span class="permission {"allowed" if v else "denied"}">{"Có" if v else "Không"}</span>' for v in r[1:]] for r in permissions]
add('Ma trận RBAC', 'Ba vai trò · Quyền tăng theo phạm vi công việc',
    table(['Chức năng', 'viewer', 'editor', 'admin'], matrix, 'rbac-matrix')
    + '<p class="footnote">¹ Trong trang quản trị; thực đơn / chi tiết món vẫn công khai.<br>² Chỉ đổi viewer ↔ editor của tài khoản active; không thay đổi admin.</p>'
    + '<div class="callout"><strong>Đăng ký luôn tạo viewer.</strong> Role do client gửi không được dùng để tự cấp quyền.</div>',
    'Đọc từng cột: viewer xem món và quản lý bảo mật bản thân; editor CRUD món nhưng chỉ xem/chọn đầu bếp và nguyên liệu có sẵn; admin còn CRUD hai danh mục đó và quản lý quyền editor. Xem/chọn ở đây nói về màn hình quản trị và API danh mục; chi tiết món công khai vẫn có thể chứa thông tin liên quan. Admin không được dùng trang này để đổi tài khoản admin.',
    ['../README.md', '../api/src/app.ts', '../api/src/security.ts', '../web/src/App.tsx'])

add('Sơ đồ luồng phân quyền', 'Kiểm tra tại API, kể cả khi gọi trực tiếp và bỏ qua giao diện',
    diagram('rbac-flow.svg', '¹ Với mutation: còn kiểm tra origin / CSRF trước khi thực hiện nghiệp vụ. GET món ăn và chi tiết món là công khai.'),
    'Theo luồng từ trái sang phải: request bảo vệ cần Bearer token có chữ ký hợp lệ. API đọc tài khoản và session từ database, kiểm tra trạng thái active, hạn phiên và version. Xác thực sai hoặc phiên bị thu hồi trả 401; role không được phép thao tác trả 403 FORBIDDEN. Đủ quyền vẫn cần CSRF và origin hợp lệ khi thay đổi dữ liệu. Sơ đồ này áp dụng cho route bảo vệ; GET dishes công khai không yêu cầu token. React ẩn thao tác và chặn route để hỗ trợ trải nghiệm, nhưng API là nơi quyết định quyền.',
    ['../api/src/app.ts', '../api/src/token-sessions.ts', '../web/src/pages/Security.tsx'])

add('Cấp / thu hồi editor', 'Admin đổi quyền; các phiên cũ của tài khoản đích bị thu hồi',
    '<div class="cols"><div><h3>Luồng thao tác</h3><ol class="steps"><li>Admin mở <code>/admin/users</code>, tìm email.</li><li>Chọn tài khoản active có role viewer hoặc editor.</li><li>Cấp editor hoặc thu hồi về viewer.</li><li>Tài khoản đích đăng nhập lại để dùng quyền mới.</li></ol></div><div><h3>API thực thi</h3><div class="request">POST /api/auth/users/:id/role<br><code>{role: "viewer" | "editor"}</code></div><ul class="clean-list detail-list"><li>Đọc lại quyền admin trong transaction.</li><li>Tăng <code>userVersion</code>.</li><li>Thu hồi mọi session của tài khoản đích.</li></ul></div></div><div class="callout">JWT cũ chưa hết hạn vẫn bị từ chối ở lần kiểm tra kế tiếp vì version / phiên đã thay đổi.</div>',
    'Admin chỉ chuyển viewer sang editor hoặc ngược lại cho tài khoản active. Backend kiểm tra lại actor là admin trong transaction để tránh dựa vào dữ liệu cũ. Việc tăng userVersion và thu hồi session làm access token và refresh token cũ không còn sử dụng được. Sau đăng nhập, viewer đến /dishes; editor/admin đến /admin/dishes.',
    ['../api/src/security.ts', '../api/src/token-sessions.ts', '../web/src/pages/Security.tsx', '../web/src/auth/state.ts'])

add('Sơ đồ bật / thay Authenticator', 'Chỉ kích hoạt secret mới sau khi xác minh TOTP thành công',
    diagram('mfa-setup-flow.svg', '¹ Nếu đã bật MFA: cần thêm TOTP hoặc recovery code hiện tại. QR được tạo cục bộ; secret MFA được mã hóa AES-256-GCM.'),
    'Người dùng vào Settings, xác nhận mật khẩu; nếu đang bật MFA thì còn phải chứng minh yếu tố cũ bằng OTP hoặc recovery code. Server sinh secret và QR tạm, hết hạn sau 5 phút. Người dùng quét QR và nhập TOTP của secret mới. Chỉ khi confirm thành công mới thay trạng thái MFA chính thức, sinh 10 recovery code và thu hồi mọi phiên. Khi thay thiết bị, secret cũ tiếp tục có hiệu lực cho đến khi xác nhận secret mới thành công. TOTP dùng SHA1, 6 số và chu kỳ 30 giây.',
    ['../api/src/security.ts', '../web/src/pages/Security.tsx'])

add('Sơ đồ đăng nhập MFA', 'Tài khoản bật MFA phải hoàn tất yếu tố thứ hai trước khi có phiên đăng nhập',
    diagram('mfa-login-flow.svg', '¹ Challenge phải còn hạn và khớp version; mã hợp lệ được tiêu thụ cùng transaction cấp phiên.'),
    'Sau khi password, trạng thái active và CAPTCHA theo quy tắc đều đạt, hệ thống kiểm tra MFA. Chưa bật MFA thì cấp access và refresh như bình thường. Đã bật thì chỉ tạo challenge 5 phút trong cookie block10.mfa HttpOnly; chưa có grant. Ở /mfa, người dùng nhập TOTP hoặc recovery code chưa dùng. API kiểm tra hạn challenge, account version và khóa xác minh; thành công mới tiêu thụ challenge và cấp phiên. Mỗi bước TOTP chỉ chấp nhận một lần trên toàn tài khoản. Sai 5 lần khóa xác minh 15 phút; đăng nhập lại không xóa bộ đếm.',
    ['../api/src/auth.ts', '../api/src/security.ts', '../api/src/token-sessions.ts'])

add('Thông số thời gian MFA', 'TOTP đổi mỗi 30 giây; thiết lập và phiên chờ có hạn riêng',
    table(['Thông số', 'Giá trị đang áp dụng'], [
        ['Mã Authenticator', '<strong>6 chữ số</strong> · TOTP SHA1'],
        ['Chu kỳ đổi OTP', '<strong>30 giây</strong>'],
        ['Cửa sổ xác minh OTP', 'Bước hiện tại và <strong>±1 bước 30 giây</strong>'],
        ['Thiết lập QR / secret mới', '<strong>5 phút</strong> để xác nhận mã từ secret mới'],
        ['Phiên chờ MFA khi đăng nhập', '<strong>5 phút</strong> sau bước mật khẩu hợp lệ'],
        ['Thời gian khóa xác minh', '<strong>15 phút</strong> khi nhập sai đủ 5 lần'],
    ], 'mfa-params') + '<div class="callout">OTP đã được chấp nhận không dùng lại. Chưa xác minh MFA thì chưa cấp access / refresh token.</div>',
    'Phân biệt chu kỳ mã với thời hạn thao tác: mã TOTP gồm 6 số, đổi mỗi 30 giây; server xét bước hiện tại, bước trước và bước sau để dung sai đồng hồ. Đây không phải một mã cố định có hạn 5 phút. Hạn 5 phút áp dụng riêng cho thiết lập QR/secret và challenge đăng nhập. Challenge hết hạn thì phải đăng nhập lại; thiết lập hết hạn thì tạo lại QR. OTP đã chấp nhận không dùng lại ở thao tác tiếp theo: cần chờ mã mới hoặc dùng recovery code chưa dùng.',
    ['../api/src/security.ts'])

add('Giới hạn nhập mã MFA', 'Bộ đếm lưu theo tài khoản, dùng chung giữa các thao tác xác minh bảo mật',
    table(['Tình huống', 'Hành vi'], [
        ['Nhập sai đủ 5 lần', '<strong>Khóa 15 phút</strong>; API trả 429 và Retry-After'],
        ['Đổi tab / đăng nhập lại', '<strong>Không xóa</strong> bộ đếm sai hoặc thời gian khóa'],
        ['Xác minh thành công', 'Đưa bộ đếm sai về <strong>0</strong>'],
        ['Hết thời gian khóa', 'Xóa bộ đếm và trạng thái khóa khi kiểm tra lại'],
        ['Dùng lại OTP đã được chấp nhận', '<strong>Từ chối</strong> trên toàn tài khoản'],
        ['Recovery code sai / đã dùng', 'Từ chối; tính vào bộ đếm sai khi xác minh MFA'],
    ], 'mfa-params') + '<div class="callout">Giới hạn MFA tách biệt với giới hạn nhập sai mật khẩu đăng nhập và OTP kích hoạt email.</div>',
    'Bộ đếm attempts và lockedUntil nằm trong trạng thái bảo mật của tài khoản ở PostgreSQL, không phụ thuộc tab hoặc bộ nhớ trình duyệt. Các bước xác minh MFA, xác nhận setup và xác thực lại trong Settings dùng chung bộ đếm; xác thực lại sai mật khẩu hiện tại cũng tính là một lần sai. Xác minh thành công xóa attempts; sau khi hết khóa, lần kiểm tra tiếp theo xóa bộ đếm và khóa. Mã sai, mã TOTP bị dùng lại hoặc recovery code đã dùng đều bị từ chối. Hết hạn challenge không được xử lý như một lần nhập mã sai.',
    ['../api/src/security.ts', '../api/src/auth.ts'])

add('Recovery code & Settings', 'Giữ quyền kiểm soát khi đổi mật khẩu hoặc thay thiết bị',
    '<div class="cols"><div><h3>Recovery code</h3><ul class="clean-list"><li><strong>10 mã/bộ</strong> · 32 ký tự hex/mã · dùng 1 lần.</li><li>Hiển thị một lần; có sao chép / tải xuống.</li><li>Không đặt hạn thời gian; database lưu HMAC.</li><li>Mã đã dùng bị hủy; tạo bộ mới hoặc thay / tắt MFA hủy cả bộ cũ.</li></ul></div><div><h3>Thao tác bảo mật</h3><ul class="clean-list"><li>Đổi mật khẩu, bật / thay / tắt MFA.</li><li>Xác nhận mật khẩu và yếu tố cũ nếu MFA đang bật.</li><li>Thành công → thu hồi mọi phiên; vẫn cho lưu recovery mới.</li></ul></div></div><div class="callout"><strong>Reset mật khẩu giữ nguyên MFA.</strong> Mất cả Authenticator và recovery code: hiện chưa có luồng admin / email bỏ qua MFA.</div>',
    'Recovery code thay thế OTP khi mất thiết bị; có 10 mã mỗi bộ, mỗi mã là 128 bit ngẫu nhiên được biểu diễn bằng 32 ký tự hex và dùng một lần. Chưa đặt thời hạn cho recovery code; mã mất hiệu lực khi đã dùng, tạo bộ mới, thay hoặc tắt MFA. Chỉ mã HMAC được lưu, không lưu plaintext. Sau các thao tác bảo mật, người dùng cần đăng nhập lại; giao diện giữ recovery mới để họ lưu trước khi rời trang. Việc reset password không được dùng để tắt MFA.',
    ['../api/src/security.ts', '../web/src/pages/Security.tsx', '../README.md'])

add('Kịch bản trình diễn', 'Thực hiện lần lượt để đối chiếu ma trận quyền và hai lớp xác thực',
    table(['Bước', 'Thao tác', 'Kết quả cần quan sát'], [
        ['1 · viewer', 'Mở thực đơn; thử truy cập quản trị', 'Xem món; thao tác quản trị bị chặn'],
        ['2 · editor', 'Sửa món; mở danh mục đầu bếp', 'Sửa món được; chỉ xem / chọn đầu bếp'],
        ['3 · admin', 'Cấp rồi thu hồi editor', 'Phiên tài khoản đích mất hiệu lực'],
        ['4 · Bật MFA', 'Quét QR; xác nhận TOTP mới', 'Hiện recovery code; yêu cầu đăng nhập lại'],
        ['5 · Đăng nhập', 'Password → OTP / recovery', 'Chỉ cấp phiên sau xác minh MFA'],
    ], 'demo-table') + '<div class="callout">Đây là kịch bản demo. Các sơ đồ mô tả mã nguồn; kết quả quan sát cần đối chiếu khi chạy ứng dụng.</div>',
    'Chuẩn bị ba tài khoản active mang ba vai trò. Dùng các cửa sổ hoặc profile riêng để tránh lẫn phiên. Trình diễn phần quyền trước, sau đó bật MFA, lưu recovery code và đăng nhập lại. Nếu thử recovery, chỉ dùng một mã chưa dùng. Không trình chiếu mật khẩu, secret QR, OTP còn hiệu lực hoặc bộ recovery thật. Đây là hướng dẫn demo chứ không phải log bằng chứng đã chạy.',
    ['../README.md', '../api/test/security.test.ts', '../scripts/security-browser-check.ts'])

add('A1 · Nguồn đối chiếu', 'Sơ đồ tự dựng theo mã nguồn Block 10; template kế thừa Block 9',
    table(['Nội dung', 'Nguồn trong repository'], [
        ['Ma trận quyền và middleware', '<code>api/src/app.ts</code>'],
        ['Cấp editor; setup / verify MFA; recovery', '<code>api/src/security.ts</code>'],
        ['JWT; kiểm tra phiên và version', '<code>api/src/token-sessions.ts</code>'],
        ['Route guard; Settings; quản lý editor', '<code>web/src/App.tsx</code> · <code>web/src/pages/Security.tsx</code>'],
        ['Kiểm thử tham khảo', '<code>api/test/security.test.ts</code> · <code>scripts/security-browser-check.ts</code>'],
    ]) + '<p class="footnote">Sơ đồ SVG có thể mở độc lập trong assets/. Không dùng log hoặc ảnh Block 9 làm minh chứng RBAC / MFA của Block 10.</p>',
    'Khi cần giải thích chi tiết, mở trực tiếp các file nguồn được liệt kê. Các SVG là sơ đồ do bộ slide tự dựng, không dùng hình từ Internet. Bộ slide không đọc .env và không chứa credential hay dữ liệu tài khoản thật.',
    ['../README.md', '../../block9/presentation/README.md'], appendix=True)

nav_source = (P.parents[1] / 'block9/presentation/index.html').read_text(encoding='utf-8')
nav = nav_source[nav_source.index('<nav class="nav"'):]
# Initial counter is replaced by slides.js; keep the no-JS source accurate too.
import re
nav = re.sub(r'(id="counter">)01 / \d+', rf'\g<1>01 / {len(slides)}', nav)
out = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Block 10 · RBAC &amp; MFA</title><link rel="icon" href="data:,"><link rel="stylesheet" href="styles.css"><script src="slides.js" defer></script></head><body><div class="progress"><div id="progress"></div></div><main class="stage"><div class="deck">'
script = []
for i, s in enumerate(slides, 1):
    links = ' · '.join(f'<a href="{h(src)}" target="_blank" rel="noopener">{h(src)}</a>' for src in s['sources'])
    out += (f'<section class="slide {"active" if i == 1 else ""}" id="slide-{i}" data-title="{h(s["title"])}" data-appendix="{str(s["appendix"]).lower()}">'
            '<div class="masthead"><span>BLOCK 10 / THE TABLE</span><span>RBAC · Settings · MFA</span></div>'
            f'<h2>{h(s["title"])}</h2><p class="lead">{h(s["lead"])}</p><div class="body">{s["body"]}</div>'
            f'<div class="footer"><span>React CSR · Express API · Prisma / PostgreSQL</span><span>{i:02} / {len(slides)}</span></div>'
            f'<aside class="speaker-notes"><h3>Lời trình bày</h3><p>{h(s["notes"])}</p><h3>Nguồn đối chiếu</h3><p>{links}</p></aside></section>')
    script.append(f'## {i}. {s["title"]}\n\n{s["lead"]}\n\n{s["notes"]}\n\nNguồn: ' + ', '.join(s['sources']))
out += '</div></main>' + nav
(P / 'index.html').write_text(out, encoding='utf-8')
(P / 'SCRIPT.md').write_text('# Block 10 — Ghi chú trình bày\n\n' + '\n\n'.join(script) + '\n', encoding='utf-8')
print(f'Built {len(slides)} slides and 3 original SVG diagrams.')
