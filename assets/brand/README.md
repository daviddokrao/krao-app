# Krao — bộ logo cho website (v1.0)

Màu chính: **#0E8C6E** (xanh ngọc) · tâm **#FFC233** (vàng ấm) · nền tối dùng **#17A886** · mực chữ **#16201A**
Font chữ hiệu: **Sora 700**, letter-spacing −0.035em (Google Fonts).

## 1. File trong thư mục này

### Icon vector (ưu tiên dùng)
| File | Dùng khi |
|---|---|
| `krao-icon.svg` | Icon chuẩn, mọi cỡ từ 24px trở lên |
| `krao-icon-small.svg` | Nét dày hơn, dùng khi render ≤ 48px |
| `krao-icon-white.svg` | Đặt trên nền màu đậm hoặc ảnh |
| `krao-icon-darkbg.svg` | Nền tối (#16201A trở xuống) — xanh sáng #17A886 |
| `krao-icon-mono.svg` | Một màu #16201A: in khắc, fax, watermark |
| `favicon.svg` | Favicon vector (nét 18, tâm r22 — bản nhìn rõ ở 16px) |

### Icon PNG (nền trong suốt)
`krao-icon-1024.png` · `512` · `256` · `128` · `64` · `48` · `32` · `favicon-16.png`
`krao-icon-512-white.png` · `krao-icon-512-darkbg.png` · `krao-icon-512-mono.png` · `krao-icon-512-on-green.png`
`apple-touch-icon-180.png` — nền xanh đặc, sao trắng (iOS không hỗ trợ nền trong suốt).

### Lockup (icon + chữ Krao)
| File | Ghi chú |
|---|---|
| `krao-lockup-horizontal.svg` | Chữ còn sống — **cần nhúng font Sora**, nếu không sẽ fallback sang Helvetica |
| `krao-lockup-horizontal-white.svg` | Bản chữ trắng cho nền tối |
| `krao-lockup-horizontal.png` | Ảnh 4x, chữ đã rasterize — an toàn tuyệt đối |
| `krao-lockup-stacked.png` | Bản dọc, có dòng KRAO.COM |
| `krao-lockup-darkbg.png` | Bản nền tối #16201A |
| `krao-og-1200x630.png` | Ảnh Open Graph / Twitter card |

## 2. Quy tắc 51%

Mọi tỷ lệ quy theo **H = chiều cao thật của ngôi sao** (= 0.715 × chiều cao khung SVG/PNG).

- **Chiều cao chữ K = 0.51 × H** ⇒ `font-size ≈ 0.69 × H` (cap height của Sora = 0.742em).
- Khoảng cách icon ↔ chữ (lockup ngang) = **0.30H**, căn giữa theo trục dọc.
- Lockup dọc: `font-size` 0.75H, khoảng cách dọc 0.25H; dòng KRAO.COM cỡ 0.26H, mono, letter-spacing 0.2em.
- Khoảng trống trắng quanh lockup ≥ **1.0H** ở cả bốn phía.
- Cỡ chữ nhỏ nhất 14px; icon nhỏ nhất 16px (dùng bản nét dày).

Ví dụ nhanh: khung icon 80px → H ≈ 57px → chữ ≈ 39px, khoảng cách 17px.

## 3. Nhúng vào website

```html
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/favicon-16.png" sizes="16x16">
<link rel="icon" href="/assets/krao-icon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon-180.png">
<meta property="og:image" content="https://krao.com/assets/krao-og-1200x630.png">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap" rel="stylesheet">
```

Header lockup dựng bằng HTML (đúng quy tắc 51%, icon khung 44px → H 31):

```html
<a href="/" style="display:inline-flex;align-items:center;gap:9px;text-decoration:none">
  <img src="/assets/krao-icon.svg" width="44" height="44" alt="">
  <span style="font:700 21px/1 Sora,Helvetica,sans-serif;letter-spacing:-.035em;color:#16201A">Krao</span>
</a>
```

## 4. Không được

- Đổi độ dày nét tam giác, bán kính viên vàng, hay xoay ngôi sao.
- Bo tròn góc, thêm viền, bóng đổ, chuyển sắc (gradient) cho dấu hiệu.
- Đặt icon màu lên ảnh nhiều chi tiết mà không có đĩa nền hoặc nền phẳng.
- Thay font chữ Krao, kéo giãn hay nén chữ so với icon.
- Tự chỉnh khoảng cách icon–chữ ngoài tỷ lệ 0.30H.
