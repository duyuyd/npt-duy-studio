# NPT Duy Studio — Phase 1

Nền tảng no-code mới cho Founder NPT Duy, tách biệt với Góc Hợp Âm. Phạm vi hiện tại: schema Supabase, RLS, Supabase Auth và giao diện Founder đổi màu, tiêu đề, cờ cấu hình. Trình kéo thả, export, thanh toán và EAS **chưa được triển khai**.

## Thành phần

- Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS 4, Framer Motion.
- PostgreSQL/Supabase: `platform_settings`, `profiles`, `projects`, `pages`, `api_keys`.
- `/settings` là trang Founder; `/admin/settings` chuyển hướng về `/settings`.
- Cấu hình thực được tải vào layout; Server Action kiểm tra Founder rồi lưu qua RPC. React Context và CSS variables cập nhật ngay ở phiên đang mở; các phiên khác nhận thay đổi qua Supabase Realtime khi dịch vụ hoạt động.
- `api_keys` hiện chỉ là schema và RLS. Chưa có cấp phát, xác minh hoặc thu hồi khóa. Client chỉ xem được metadata, không được đọc hash hoặc tự tạo khóa.

## Tạo Supabase riêng

Dùng một dự án Supabase riêng cho nền tảng này. **Không chạy schema lên database của Góc Hợp Âm.** Kiểm tra hạn mức của nhà cung cấp trước khi bật dịch vụ; mã này không tự tạo hay tính phí tài khoản.

1. Mở SQL Editor và chạy toàn bộ `supabase/schema.sql` trên database mới.
2. Trong Authentication → Users, tạo tài khoản Founder và xác thực email theo cài đặt của dự án.
3. Trong SQL Editor, thay email bên dưới bằng email của Founder, rồi chạy:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'FOUNDER@example.com');

select p.id, p.email, p.role
from public.profiles p
where p.id = (select id from auth.users where email = 'FOUNDER@example.com');
```

Kết quả cần có một dòng với `role = admin`. Quản lý mật khẩu trong Supabase Auth; không lưu mật khẩu, service-role key hay token vào GitHub. Tài khoản người dùng không thể tự nâng quyền admin hoặc thay đổi gói qua Data API.

4. Kiểm tra Database → Publications → `supabase_realtime` có `public.platform_settings`, và Realtime được bật. Schema tự thêm bảng khi publication đã tồn tại.

## Khôi phục mật khẩu

Trước khi bật chức năng khôi phục trên website thật, đặt **Authentication → URL Configuration → Site URL** thành URL HTTPS chính thức của website và thêm URL chính xác `<URL website>/auth/confirm` vào **Redirect URLs**. Mẫu email mặc định của Supabase được giữ nguyên, không yêu cầu SMTP tùy chỉnh.

Sau đó kiểm tra thực tế bằng tài khoản do chủ sở hữu kiểm soát: yêu cầu thư từ `/quen-mat-khau`, mở liên kết trong thư **bằng cùng trình duyệt đã gửi yêu cầu**, tự đặt mật khẩu tại `/dat-lai-mat-khau`, rồi đăng nhập và thử `/settings`. Luồng PKCE lưu mã xác minh trong trình duyệt ban đầu; mở liên kết ở trình duyệt hoặc thiết bị khác sẽ không hoàn tất được. Không gửi mật khẩu, mã khôi phục hoặc khóa bí mật qua chat hay lưu vào kho mã. Mã hết hạn, sai hoặc không thuộc luồng khôi phục dẫn về form yêu cầu lại.

## Chạy tại máy

```bash
cp .env.example .env.local
# Điền Project URL và Publishable key (hoặc anon key) của Supabase vào .env.local.
npm ci
npm run dev
```

Mở `http://localhost:3000/settings`, đăng nhập bằng tài khoản Founder đã tạo, đổi thông tin và nhấn Lưu. Mở trang chủ trong một thẻ khác để kiểm tra Realtime. Nếu không kết nối database hoặc chưa có cấu hình, ứng dụng sẽ báo lỗi thay vì dựng dữ liệu giả.

Khi triển khai Sites, cần cung cấp cả hai biến `NEXT_PUBLIC_SUPABASE_*` cho quá trình build và cấu hình runtime của Site; sau khi thay đổi, hãy build và triển khai lại. Chỉ dùng publishable/anon key công khai, không dùng service-role key.

Kiểm tra: `npm run typecheck`, `npm run test:rls`, `npm run build`. Test RLS chạy PostgreSQL PGlite cục bộ với Auth fixture; vẫn cần kiểm thử với dự án Supabase thực và trình duyệt thực.

## Phân quyền

- Khách đọc các giá trị cấu hình nền tảng; **không lưu bí mật hay thông tin riêng trong `platform_settings`**.
- User chỉ được truy cập project/page mình sở hữu. `profiles.role` và `subscription_plan` không thể thay đổi trực tiếp từ client.
- Cập nhật settings là một transaction; RLS bảo vệ ngay cả khi gọi database trực tiếp. Chỉ SQL Editor hoặc backend tin cậy mới được cấp quyền Founder.
- Giá trị mặc định trong `schema.sql` là cấu hình ban đầu lưu trong database, không phải dữ liệu giả trong component. Cờ AI chỉ là cấu hình và không kích hoạt dịch vụ AI nào.
