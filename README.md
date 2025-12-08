# MediExcel Lap

Ứng dụng nhập liệu khám sức khỏe bệnh nhân với khả năng import/export Excel.

## Tính năng

- **Import Excel**: Hỗ trợ file `.xlsx`, `.xls`. Tự động nhận diện dòng header và các cột tiêu chuẩn.
- **Export Excel**: Xuất dữ liệu ra file Excel với các cột đã chọn.
- **Chỉnh sửa bệnh nhân**: Modal chỉnh sửa với 3 tab:
  - Tab 1: Thể Lực & Phân Loại (BMI, Thể trạng, Phân loại sức khỏe)
  - Tab 2: Khám Tổng Quát (Nội khoa, Mắt, TMH, RHM, Ngoại khoa, Da liễu)
  - Tab 3: Cận Lâm Sàng (X-Quang, Siêu âm, Điện tim)
- **Tự động tính BMI**: Nhập cân nặng và chiều cao, hệ thống tự động tính BMI và phân loại thể trạng.
- **Hiển thị/Ẩn cột**: Tùy chọn hiển thị các cột trong bảng.

## Cài đặt

```bash
# Cài đặt dependencies
npm install

# Chạy development server
npm run dev

# Build production
npm run build
```

## Sử dụng

1. **Import file Excel**: Click nút "Import Excel" và chọn file `.xlsx` hoặc `.xls`.
2. **Chỉnh sửa**: Double-click vào dòng bệnh nhân hoặc click nút Edit.
3. **Điều hướng**: Sử dụng nút mũi tên trong modal để chuyển giữa các bệnh nhân.
4. **Export**: Click nút "Export Excel" để xuất file kết quả.

## Cấu trúc dữ liệu

| Cột | Mô tả |
|-----|-------|
| CODE | Mã nhân viên/Bệnh nhân |
| HỌ VÀ TÊN | Tên đầy đủ |
| NS | Năm sinh |
| GT | Giới tính |
| Cân nặng | Đơn vị kg |
| Chiều cao | Đơn vị mét |
| BMI | Tự động tính |
| THỂ TRẠNG | Thiếu cân/Bình thường/Thừa cân |
| KHÁM TỔNG QUÁT | Tổng hợp kết quả khám |
| PHÂN LOẠI SỨC KHỎE | Loại I-V |
| Xquang | Kết quả X-Quang |
| Siêu âm | Kết quả siêu âm |
| Điện tim | Kết quả ECG |

## Tech Stack

- Next.js 14
- TypeScript
- TailwindCSS
- Radix UI
- SheetJS (xlsx)
