"""
WordWiz - 开发服务器
强制所有响应添加 no-cache 头，彻底杜绝浏览器缓存旧 JS/CSS
"""

import http.server
import socketserver

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 强制不缓存任何文件
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        print(f'[WordWiz] {self.client_address[0]} - {args[0]} {args[1]} {args[2]}')

PORT = 3000

try:
    with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
        print(f'📖 WordWiz 服务器已启动 → http://localhost:{PORT}')
        print(f'   (按 Ctrl+C 停止服务器)')
        httpd.serve_forever()
except OSError as e:
    if e.winerror == 10048:  # 端口被占用
        print(f'❌ 端口 {PORT} 已被占用！')
        print(f'   请先关闭旧进程再重试')
    else:
        print(f'❌ 启动失败: {e}')
except KeyboardInterrupt:
    print('\n👋 服务器已停止')
