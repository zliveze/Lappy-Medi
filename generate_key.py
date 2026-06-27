#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime

# Đảm bảo console Windows hỗ trợ in kí tự tiếng Việt unicode không bị crash
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
        sys.stdin.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

def load_secret_key():
    env_path = ".env.local"
    secret_key = None
    
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("ACCESS_SECRET_KEY="):
                    secret_key = line.split("=", 1)[1].strip()
                    if (secret_key.startswith('"') and secret_key.endswith('"')) or \
                       (secret_key.startswith("'") and secret_key.endswith("'")):
                        secret_key = secret_key[1:-1]
                    break
    return secret_key

def main():
    print("=" * 60)
    print("    LAPPY-MEDI - HỆ THỐNG TẠO MÃ KHÓA (WINDOWS LICENSE KEY)    ")
    print("=" * 60)
    
    secret_key = load_secret_key()
    if not secret_key:
        print("\n\033[91m[LỖI] Không tìm thấy ACCESS_SECRET_KEY trong file .env.local.")
        print("Vui lòng khởi chạy ứng dụng web trước để tự động sinh khóa bí mật!\033[0m")
        sys.exit(1)
    
    # 1. Nhập tên người sở hữu key tự do
    user = ""
    while not user:
        user = input("\n- Nhập tên/chức vụ người được cấp key (Ví dụ: Bác sĩ Nguyễn Văn A): ").strip()
        if not user:
            print("  [!] Tên người sở hữu không được để trống. Vui lòng nhập lại.")
        
    # 2. Chọn thời hạn hết hạn
    days_input = input("\n- Nhập số ngày hiệu lực của key (ví dụ: 30, hoặc 0 để VĨNH VIỄN) [mặc định: 30]: ").strip()
    try:
        days = int(days_input) if days_input else 30
        if days < 0:
            days = 0
    except ValueError:
        days = 30
        print("  [! Input không hợp lệ, chuyển về mặc định 30 ngày]")

    # 3. Nhập URL website (hỗ trợ cả môi trường Local và Production)
    url_input = input("\n- Nhập URL trang web Lappy-Medi\n  (Enter để dùng mặc định: http://localhost:3000): ").strip()
    if not url_input:
        base_url = "http://localhost:3000"
    else:
        base_url = url_input.rstrip('/')

    api_url = f"{base_url}/api/auth/keys"

    print(f"\n⏳ Đang kết nối tới {base_url} để tạo và lưu khóa vào MongoDB...")

    # 4. Gửi request POST tới Next.js API
    payload = {
        "user": user,
        "days": days
    }
    
    req_data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(api_url, data=req_data, method='POST')
    req.add_header('Content-Type', 'application/json')
    req.add_header('x-admin-secret', secret_key)

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode('utf-8')
            data = json.loads(res_body)
            
            license_key = data.get("key")
            exp_str = data.get("exp")
            
            if exp_str:
                # Định dạng ngày hết hạn
                dt = datetime.fromisoformat(exp_str.replace('Z', '+00:00'))
                exp_display = dt.strftime('%d/%m/%Y %H:%M:%S')
            else:
                exp_display = "Vĩnh viễn (Không hết hạn)"
                
            # Hiển thị kết quả thành công
            print("\n" + "=" * 60)
            print("🎉 MÃ KHÓA CẤP QUYỀN ĐÃ ĐƯỢC LƯU VÀ TẠO THÀNH CÔNG! 🎉")
            print("=" * 60)
            print(f"👤 Người sở hữu:  {user}")
            print(f"📅 Ngày hết hạn:  {exp_display}")
            print(f"🌐 Hệ thống lưu:  MongoDB thông qua {base_url}")
            print("-" * 60)
            print("\033[92m🔑 WINDOWS LICENSE KEY CỦA BẠN (Hãy copy toàn bộ chuỗi này):\033[0m")
            print(f"\n{license_key}\n")
            print("-" * 60)
            print("📌 Hướng dẫn sử dụng:")
            print("  1. Copy chuỗi mã key ở trên.")
            print("  2. Vào website Lappy-Medi, click vào biểu tượng 🔒 ở góc trên.")
            print("  3. Dán mã key này vào (chấp nhận cả chữ thường và dấu gạch ngang).")
            print("  4. Bấm 'Xác nhận' để mở khóa quyền chỉnh sửa.")
            print("=" * 60)

    except urllib.error.URLError as e:
        print(f"\n\033[91m[LỖI] Không thể kết nối tới máy chủ tại: {base_url}")
        print("Vui lòng đảm bảo rằng:")
        print("  1. Ứng dụng web của bạn đang chạy (chạy 'npm run dev' nếu ở máy local).")
        print("  2. Đường dẫn URL bạn nhập vào là chính xác.")
        print(f"Chi tiết lỗi: {e}\033[0m\n")
    except Exception as e:
        print(f"\n\033[91m[LỖI] Đã xảy ra lỗi không xác định: {e}\033[0m\n")

if __name__ == "__main__":
    main()
