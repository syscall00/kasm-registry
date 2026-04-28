FROM kasmweb/core-debian-trixie:1.18.0

USER root

RUN install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
    chmod a+r /etc/apt/keyrings/docker.asc && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian trixie stable" > /etc/apt/sources.list.d/docker.list

RUN apt-get update && apt-get install -y \
    sudo \
    nano \
    chromium \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

RUN usermod -aG docker kasm-user && \
    echo "kasm-user ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-kasm-user && \
    chmod 0440 /etc/sudoers.d/90-kasm-user

RUN cat <<'EOF' > /dockerstartup/custom_startup.sh
#!/usr/bin/env bash
set -e

if [ ! -S /var/run/docker.sock ]; then
  sudo dockerd > /var/log/dockerd.log 2>&1 &

  for i in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi
EOF

RUN chmod +x /dockerstartup/custom_startup.sh

USER kasm-user
WORKDIR /home/kasm-user
