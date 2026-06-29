#!/usr/bin/env bash
set -euo pipefail

# ========== 生产环境配置 ==========
IMAGE_NAME="${IMAGE_NAME:-g.ucas.com.cn:8088/fsdx/fsdx-web}"
CONTAINER_NAME="fsdx-web"
APP_PORT="${APP_PORT:-3000}"
TAG="${1:-latest}"

# 宿主机目录
APP_DIR="${APP_DIR:-/opt/fsdx-web}"
ENV_DIR="${APP_DIR}/env"
DATA_DIR="${APP_DIR}/data"

# 校验 env 文件存在
if [ ! -f "${ENV_DIR}/.env" ]; then
  echo "错误: ${ENV_DIR}/.env 不存在，请先创建配置文件"
  exit 1
fi

# ========== 拉取镜像 ==========
echo "[1/4] 拉取镜像 ${IMAGE_NAME}:${TAG} ..."
docker pull "${IMAGE_NAME}:${TAG}"

# ========== 停止旧容器 ==========
echo "[2/4] 停止旧容器 ..."
docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true

# ========== 启动新容器 ==========
echo "[3/4] 启动容器 ..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  -p "${APP_PORT}:3000" \
  -v "${ENV_DIR}:/app/env:ro" \
  -v "${DATA_DIR}:/app/data" \
  "${IMAGE_NAME}:${TAG}"

# ========== 健康检查 ==========
echo "[4/4] 等待服务就绪 ..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${APP_PORT}/health" > /dev/null 2>&1; then
    echo "部署成功！版本: ${TAG}"
    docker image prune -f
    exit 0
  fi
  sleep 2
done
echo "健康检查超时，请检查容器日志: docker logs ${CONTAINER_NAME}"
exit 1
