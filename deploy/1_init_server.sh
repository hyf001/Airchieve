#!/bin/bash
# =============================================================
# AIrchieve 服务器初始化脚本（仅需执行一次）
# 适用：CentOS 8 阿里云
# 用法：bash deploy/1_init_server.sh
# =============================================================

set -e

# ==================== 配置区（按需修改）====================
APP_USER="airchieve"
APP_DIR="/opt/airchieve"
NODE_VERSION="20"
# ==========================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo "=============================================="
echo "      AIrchieve 服务器初始化脚本"
echo "      CentOS 8 / 阿里云"
echo "=============================================="

[[ $EUID -ne 0 ]] && err "请以 root 身份运行: sudo bash deploy/1_init_server.sh"

# ── 1. 基础工具 ─────────────────────────────────────────────
echo ""
log "步骤 1/6: 安装基础工具..."
dnf install -y epel-release
dnf install -y wget curl git vim tar \
    gcc gcc-c++ make \
    openssl-devel bzip2-devel libffi-devel \
    zlib-devel readline-devel sqlite-devel xz-devel

# ── 2. Python 3.12（源码编译） ───────────────────────────────
PYTHON_VERSION="3.12.9"
echo ""
log "步骤 2/6: 编译安装 Python ${PYTHON_VERSION}（约5分钟）..."
if python3.12 --version &>/dev/null; then
    warn "Python 3.12 已安装 ($(python3.12 --version))，跳过"
else
    PYTHON_SRC="/usr/local/src/Python-${PYTHON_VERSION}"
    if [[ ! -d "$PYTHON_SRC" ]]; then
        cd /usr/local/src
        # 优先用阿里云镜像加速
        wget -c "https://mirrors.aliyun.com/python/ftp/python/${PYTHON_VERSION}/Python-${PYTHON_VERSION}.tgz" \
            || wget -c "https://www.python.org/ftp/python/${PYTHON_VERSION}/Python-${PYTHON_VERSION}.tgz"
        tar -xzf "Python-${PYTHON_VERSION}.tgz"
    fi
    cd "$PYTHON_SRC"
    # CentOS 8 自带 OpenSSL 1.1.1，无需额外配置
    ./configure \
        --prefix=/usr/local \
        --enable-optimizations \
        --enable-shared \
        LDFLAGS="-Wl,-rpath /usr/local/lib"
    make -j"$(nproc)"
    make altinstall
    # 建立 python / python3 / pip 软链接
    ln -sf /usr/local/bin/python3.12 /usr/local/bin/python3
    ln -sf /usr/local/bin/python3.12 /usr/local/bin/python
    ln -sf /usr/local/bin/pip3.12    /usr/local/bin/pip3
    ln -sf /usr/local/bin/pip3.12    /usr/local/bin/pip
    log "Python $(python3.12 --version) 编译安装完成"
fi

# ── 3. Node.js 20 ───────────────────────────────────────────
echo ""
log "步骤 3/6: 安装 Node.js ${NODE_VERSION}..."
if node --version &>/dev/null; then
    warn "Node.js 已安装 ($(node --version))，跳过"
else
    curl -fsSL "https://rpm.nodesource.com/setup_${NODE_VERSION}.x" | bash -
    dnf install -y nodejs
    log "Node.js $(node --version) 安装完成"
fi

# ── 4. Nginx ─────────────────────────────────────────────────
echo ""
log "步骤 4/6: 安装 Nginx..."
if nginx -v &>/dev/null; then
    warn "Nginx 已安装 ($(nginx -v 2>&1))，跳过"
else
    cat > /etc/yum.repos.d/nginx.repo << 'EOF'
[nginx-stable]
name=nginx stable repo
baseurl=http://nginx.org/packages/centos/$releasever/$basearch/
gpgcheck=1
enabled=1
gpgkey=https://nginx.org/keys/nginx_signing.key
module_hotfixes=true
EOF
    dnf install -y nginx
    systemctl enable nginx
    log "Nginx 安装完成"
fi

# ── 5. Certbot ───────────────────────────────────────────────
echo ""
log "步骤 5/6: 安装 Certbot..."
if certbot --version &>/dev/null; then
    warn "Certbot 已安装，跳过"
else
    dnf install -y certbot python3-certbot-nginx
    log "Certbot 安装完成"
fi

# ── 6. 创建应用用户和目录 ────────────────────────────────────
echo ""
log "步骤 6/6: 创建应用用户 [${APP_USER}] 和目录 [${APP_DIR}]..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -r -s /bin/bash -d "$APP_DIR" "$APP_USER"
    log "用户 ${APP_USER} 创建完成"
else
    warn "用户 ${APP_USER} 已存在，跳过"
fi

mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/data"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# SELinux: 允许 Nginx 连接后端
if command -v setsebool &>/dev/null; then
    setsebool -P httpd_can_network_connect 1
    log "SELinux: 已允许 Nginx 反向代理连接"
fi

echo ""
echo "=============================================="
echo "  ✅ 服务器初始化完成！"
echo ""
echo "  下一步操作："
echo "  1. 将项目代码部署到服务器："
echo "     git clone <your-repo-url> ${APP_DIR}"
echo "     （或 scp/rsync 上传）"
echo ""
echo "  2. 配置生产环境变量："
echo "     cp ${APP_DIR}/deploy/.env.production ${APP_DIR}/.env"
echo "     vim ${APP_DIR}/.env   # 填写域名、密钥等"
echo ""
echo "  3. 运行部署脚本："
echo "     bash ${APP_DIR}/deploy/2_deploy.sh"
echo "=============================================="
