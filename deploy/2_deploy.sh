#!/bin/bash
# =============================================================
# AIrchieve 应用部署/更新脚本
# 用法：bash deploy/2_deploy.sh
# 初次部署和后续更新都用此脚本
# =============================================================

set -e

# ==================== 配置区（按需修改）====================
APP_USER="airchieve"
APP_DIR="/opt/airchieve"
SERVICE_NAME="airchieve"
NGINX_CONF="/etc/nginx/conf.d/airchieve.conf"
# ==========================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo "=============================================="
echo "      AIrchieve 应用部署脚本"
echo "=============================================="

# ── 前置检查 ─────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && err "请以 root 身份运行: sudo bash deploy/2_deploy.sh"
[[ ! -f "$APP_DIR/.env" ]] && err ".env 文件不存在！请先执行：\n  cp ${APP_DIR}/deploy/.env.production ${APP_DIR}/.env\n  vim ${APP_DIR}/.env"

# 读取域名配置
DOMAIN=$(grep '^DOMAIN=' "$APP_DIR/.env" | cut -d'=' -f2 | tr -d ' "')
[[ -z "$DOMAIN" ]] && err ".env 中未配置 DOMAIN，请填写后重试"

cd "$APP_DIR"

# ── 1. 安装/更新 Python 依赖 ─────────────────────────────────
echo ""
info "步骤 1/5: 安装 Python 依赖..."
VENV_DIR="$APP_DIR/.venv"
if [[ ! -d "$VENV_DIR" ]]; then
    python3.12 -m venv "$VENV_DIR"
    log "虚拟环境创建完成"
fi
source "$VENV_DIR/bin/activate"

# 使用阿里云 PyPI 镜像加速
pip install --upgrade pip -i https://mirrors.aliyun.com/pypi/simple/
pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/
pip install gunicorn -i https://mirrors.aliyun.com/pypi/simple/
deactivate
log "Python 依赖安装完成"

# ── 2. 构建前端 ───────────────────────────────────────────────
echo ""
info "步骤 2/5: 构建前端..."
cd "$APP_DIR/frontend"

# 使用淘宝 npm 镜像加速
npm config set registry https://registry.npmmirror.com
npm install
npm run build

log "前端构建完成 → frontend/dist/"
cd "$APP_DIR"

# ── 3. 创建/更新 systemd 服务 ────────────────────────────────
echo ""
info "步骤 3/5: 配置 systemd 服务..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=AIrchieve FastAPI Backend
After=network.target

[Service]
Type=exec
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=${VENV_DIR}/bin/gunicorn app.main:app \\
    --workers 2 \\
    --worker-class uvicorn.workers.UvicornWorker \\
    --bind 127.0.0.1:8000 \\
    --log-level info \\
    --access-logfile ${APP_DIR}/logs/access.log \\
    --error-logfile ${APP_DIR}/logs/error.log \\
    --timeout 120
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

mkdir -p "$APP_DIR/logs"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/logs"

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
    log "后端服务启动成功"
else
    err "后端服务启动失败，请检查日志: journalctl -u ${SERVICE_NAME} -n 50"
fi

# ── 4. 配置 Nginx ────────────────────────────────────────────
echo ""
info "步骤 4/5: 配置 Nginx..."

# 初次部署：写入 HTTP 配置（先用 HTTP，certbot 后自动升级 HTTPS）
if [[ ! -f "$NGINX_CONF" ]]; then
    cp "$APP_DIR/deploy/nginx.conf" "$NGINX_CONF"
    # 替换域名占位符
    sed -i "s/YOUR_DOMAIN/${DOMAIN}/g" "$NGINX_CONF"
    # 替换应用目录占位符
    sed -i "s|APP_DIR|${APP_DIR}|g" "$NGINX_CONF"
    log "Nginx 配置写入: ${NGINX_CONF}"
else
    warn "Nginx 配置已存在，跳过覆盖（如需更新请手动编辑 ${NGINX_CONF}）"
fi

nginx -t
if systemctl is-active --quiet nginx; then
    systemctl reload nginx
    log "Nginx 重载完成"
else
    systemctl start nginx
    log "Nginx 启动完成"
fi

# ── 5. 申请 SSL 证书（首次） ─────────────────────────────────
echo ""
info "步骤 5/5: 检查 SSL 证书..."
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
if [[ -f "$CERT_PATH" ]]; then
    warn "SSL 证书已存在，跳过申请"
else
    echo ""
    warn "即将申请 SSL 证书，请确保："
    warn "  1. 域名 ${DOMAIN} 已解析到本服务器 IP"
    warn "  2. 80 端口可从外网访问"
    echo ""
    read -r -p "是否立即申请 Let's Encrypt SSL 证书？(y/N): " CONFIRM
    if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
        EMAIL=$(grep '^SSL_EMAIL=' "$APP_DIR/.env" | cut -d'=' -f2 | tr -d ' "')
        [[ -z "$EMAIL" ]] && read -r -p "请输入用于证书通知的邮箱: " EMAIL
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL"
        systemctl reload nginx
        log "SSL 证书申请完成，已自动配置 HTTPS"

        # 设置自动续期
        (crontab -l 2>/dev/null; echo "0 2 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx") | crontab -
        log "SSL 自动续期定时任务已设置（每天凌晨2点检查）"
    else
        warn "跳过 SSL 申请，可稍后手动执行："
        warn "  certbot --nginx -d ${DOMAIN} -m your@email.com --agree-tos"
    fi
fi

# ── 完成 ──────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  ✅ 部署完成！"
echo ""
if [[ -f "$CERT_PATH" ]]; then
    echo "  访问地址: https://${DOMAIN}"
else
    echo "  访问地址: http://${DOMAIN}  (HTTP，SSL 待配置)"
fi
echo ""
echo "  常用运维命令："
echo "  查看后端日志:  journalctl -u ${SERVICE_NAME} -f"
echo "  重启后端:      systemctl restart ${SERVICE_NAME}"
echo "  重载Nginx:     systemctl reload nginx"
echo "  查看访问日志:  tail -f ${APP_DIR}/logs/access.log"
echo "=============================================="
