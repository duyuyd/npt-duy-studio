# NPT Duy Studio

Nền tảng tạo website và ứng dụng của NPT Duy. Dự án dùng Next.js 15, React 19, Supabase, Tailwind 4 và @dnd-kit; tách biệt với Góc Hợp Âm.

## Chức năng trong mã

- Đăng ký, đăng nhập và khôi phục mật khẩu qua Supabase Auth; chủ tài khoản tự đặt mật khẩu.
- Founder đổi màu chủ đạo, tiêu đề và mô tả trang chủ; dữ liệu lưu trong `platform_settings`. Cập nhật được áp dụng ngay ở phiên hiện tại và các phiên khác khi Realtime hoạt động.
- Tạo dự án thật; kéo, thả và lồng khối văn bản, nút, ảnh, khung chứa. Có hoàn tác, làm lại, thu phóng, tự lưu sau 2 giây và kiểm tra phiên bản để tránh ghi đè thay đổi từ phiên khác.
- Xuất mã nguồn React Web hoặc Expo/React Native thành ZIP từ cấu trúc đã lưu.
- Hàng đợi `build_jobs` và workflow EAS. Nút build mặc định bị khóa cho đến khi chủ sở hữu cấu hình và bật dịch vụ; không có APK/IPA giả. Thanh toán Stripe/PayOS chưa được kết nối.

## Cơ sở dữ liệu

Với dự án Supabase mới, chạy `supabase/schema.sql`. Với cơ sở dữ liệu NPT Duy Studio đã có Phase 1, chạy riêng `supabase/migrations/20261114_builder.sql`; migration này bổ sung bảng, hàm và cột, không xóa dữ liệu hiện có. Không chạy lên cơ sở dữ liệu Góc Hợp Âm.

Trong Authentication → URL Configuration, đặt Site URL về địa chỉ HTTPS chính thức và thêm chính xác `<URL website>/auth/confirm` vào Redirect URLs. Cấu hình `NEXT_PUBLIC_SITE_URL` giống địa chỉ này. Mẫu email mặc định của Supabase được giữ nguyên. Dùng cùng trình duyệt để yêu cầu và mở liên kết xác nhận hoặc khôi phục vì luồng PKCE lưu mã xác minh trong trình duyệt ban đầu. Dịch vụ email mặc định của Supabase có giới hạn người nhận; cần cấu hình SMTP phù hợp trước khi mở đăng ký rộng rãi.

Chỉ cấp quyền Founder cho tài khoản được chủ sở hữu chỉ định trong SQL Editor hoặc backend tin cậy. Không lưu mật khẩu, service-role key hay token vào GitHub.

## Build APK/IPA

Workflow `.github/workflows/build-app.yml` nhận một `build_jobs.id`, lấy bản chụp giao diện đã lưu, gửi mã đã tạo tới Expo EAS, rồi lưu file thành công vào R2 riêng tư. Link tải được ký và chỉ cấp sau khi kiểm tra quyền sở hữu. Đây là tích hợp cần cấu hình, không phải bằng chứng đã build thành công.

Trước khi bật, chủ sở hữu cần tạo cấu hình Expo EAS, chuẩn bị ký Android/iOS và một bucket R2 riêng tư; kiểm tra hạn mức và chi phí trước khi sử dụng. Trên GitHub Actions, cấu hình secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EXPO_TOKEN`, `EAS_PROJECT_ID`, `EAS_OWNER`, `EAS_PROJECT_SLUG`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Thiết lập Expo project và signing phù hợp với từng ứng dụng trước khi dùng thực tế. IPA thiết bị cần thông tin ký Apple hợp lệ.

Trên Sites, cấu hình riêng các biến bảo mật `BUILD_DISPATCH_TOKEN`, `BUILD_WORKFLOW_REPOSITORY`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Chỉ sau khi kiểm tra đầy đủ mới đặt `BUILD_PIPELINE_ENABLED=true`. Token GitHub chỉ cần quyền chạy workflow ở kho này. Các secrets chỉ đặt trong hệ thống quản lý secrets, không ghi vào mã hoặc chat. Hệ thống cần bổ sung quản lý hạn mức và chi phí theo người dùng trước khi mở build cho công chúng.

## Chạy và kiểm tra

```bash
cp .env.example .env.local
# Điền URL và publishable/anon key của Supabase, cùng URL website.
npm ci
npm run dev
npm run typecheck
npm run test:rls
npm run test:builder
npm run build
```

Khi triển khai Sites, cung cấp `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` và `NEXT_PUBLIC_SITE_URL` cho cả quá trình build lẫn runtime. Không dùng service-role key làm khóa công khai. Kiểm thử cục bộ không thay thế việc đăng nhập, kéo thả, lưu và build thật sau khi cấu hình dịch vụ.

## NuvoraCraft brand / Capacitor APK on feature branch

This older independent Next.js prototype is branded as part of NuvoraCraft, but it **does not share the production SaaS deployment** automatically. Puter.js is loaded after hydration; it is not an API key nor a promise of free unlimited AI. The Capacitor workflow uses a remote **HTTPS website** and only builds after the repository variable `APK_WEB_URL` is configured to this prototype's real deployment. Without a real URL it does not manufacture a working APK. Existing Supabase data and build pipelines are left unchanged. PR is held for Founder `VERIFIED` before merge.
