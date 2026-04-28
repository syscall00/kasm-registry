FROM kasmweb/core-debian-bookworm:1.17.0

ENV USER=kasm-user

USER root

RUN install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
    chmod a+r /etc/apt/keyrings/docker.asc && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" > /etc/apt/sources.list.d/docker.list

RUN apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin && \
    rm -rf /var/lib/apt/lists/*

RUN usermod -aG docker $USER
RUN echo "$USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-$USER && chmod 0440 /etc/sudoers.d/90-$USER

RUN cat <<'EOF' > /usr/local/bin/kasm_docker_startup.sh
#!/usr/bin/env bash
set -euo pipefail

start_dockerd() {
  if [ -S /var/run/docker.sock ]; then
    return
  fi

  mkdir -p /var/run
  if [ "$(id -u)" -eq 0 ]; then
    dockerd > /var/log/dockerd.log 2>&1 &
  else
    sudo -n dockerd > /var/log/dockerd.log 2>&1 &
  fi

  for _ in $(seq 1 30); do
    if docker info > /dev/null 2>&1; then
      return
    fi
    sleep 1
  done

  echo "Docker daemon did not become ready. Check /var/log/dockerd.log" >&2
}

start_dockerd || true
exec /dockerstartup/custom_startup.sh "$@"
EOF

RUN chmod +x /usr/local/bin/kasm_docker_startup.sh

USER $USER
WORKDIR /home/$USER

CMD ["/usr/local/bin/kasm_docker_startup.sh", "--go", "--url", "${KASM_URL:-http://localhost:6901}"]
