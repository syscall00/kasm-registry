# syntax=docker/dockerfile:1
#
# Minimal Kasm workspace: a terminal with the Kubernetes CLI trio.
#   kubectl - talk to the API server
#   k9s     - TUI dashboard for the cluster
#   kubens  - fast namespace switching
#
# The image is built once per supported Kasm version by passing KASM_VERSION:
#   docker build --build-arg KASM_VERSION=1.18.0 workspaces/Kubernetes-Terminal
#
# Cluster credentials are intentionally not baked in: the user writes
# ~/.kube/config from inside the workspace, per cluster.

ARG KASM_VERSION=1.19.0
FROM kasmweb/core-debian-trixie:${KASM_VERSION}

ARG TARGETARCH
ARG KUBECTL_VERSION=v1.37.1
ARG K9S_VERSION=v0.51.0
ARG KUBENS_VERSION=v0.11.0

USER root

ENV HOME=/home/kasm-user
ENV KUBECONFIG=/home/kasm-user/.kube/config

# A browser is dead weight in a terminal-only workspace, so drop one if the
# base image happens to carry it. The kasmweb debian-trixie bases checked so far
# (1.18.0 and 1.19.0) ship no browser at all, which makes this a no-op there,
# but other Kasm base images do, and the distro spelling varies: debian-trixie
# dropped the -esr suffix, older bases used firefox-esr, and some carry
# chromium.
#
# Enumerate the installed set first instead of listing names for apt. Handing
# dpkg-query a list of names to --show is not a way to ask "which of these are
# installed?": it echoes the unmatched names back and can exit 0, so a typo
# would silently purge nothing. Listing what is installed and filtering that is
# the question actually being asked.
RUN set -eux; \
    targets="$(dpkg-query -W -f='${Package}\n' \
        | grep -xE '(chromium|chromium-common|chromium-sandbox|firefox-esr|firefox)(:[a-z0-9-]+)?' \
        || true)"; \
    if [ -z "${targets}" ]; then \
        echo "no browser package in this base image, nothing to purge"; \
    else \
        echo "purging: ${targets}"; \
        apt-get update; \
        apt-get purge -y ${targets}; \
        rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*.deb; \
    fi

# BuildKit's TARGETARCH does not match every upstream naming scheme: k9s uses
# amd64, while kubectl and kubens use x86_64. Resolve once, reuse in each step.
RUN case "${TARGETARCH}" in \
        amd64) K8S_ARCH=amd64; DEB_ARCH=x86_64 ;; \
        arm64) K8S_ARCH=arm64; DEB_ARCH=arm64 ;; \
        *) echo "unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac && \
    printf 'K8S_ARCH=%s\nDEB_ARCH=%s\n' "${K8S_ARCH}" "${DEB_ARCH}" > /etc/k8s-arch.env

# The checksum files all use the "sha256  filename" layout, except dl.k8s.io which
# ships the bare hash and needs the name appended. Each step below also asserts
# that the filter matched exactly one line: sha256sum exits 0 on empty input, so
# a wrong architecture name would otherwise skip the check without failing.
RUN set -eux; \
    . /etc/k8s-arch.env; \
    cd /tmp; \
    curl -fsSLO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${DEB_ARCH}/kubectl"; \
    curl -fsSLO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${DEB_ARCH}/kubectl.sha256"; \
    printf '%s  kubectl\n' "$(cat kubectl.sha256)" > kubectl.checksum; \
    test "$(wc -l < kubectl.checksum)" -eq 1; \
    sha256sum --check --strict kubectl.checksum; \
    install -m 0755 kubectl /usr/local/bin/kubectl; \
    rm -f kubectl kubectl.sha256 kubectl.checksum

RUN set -eux; \
    . /etc/k8s-arch.env; \
    cd /tmp; \
    archive="k9s_Linux_${K8S_ARCH}.tar.gz"; \
    curl -fsSLO "https://github.com/derailed/k9s/releases/download/${K9S_VERSION}/${archive}"; \
    curl -fsSLO "https://github.com/derailed/k9s/releases/download/${K9S_VERSION}/checksums.sha256"; \
    awk -v name="${archive}" '$2 == name' checksums.sha256 > k9s.checksum; \
    test "$(wc -l < k9s.checksum)" -eq 1; \
    sha256sum --check --strict k9s.checksum; \
    tar -xzf "${archive}" k9s; \
    install -m 0755 k9s /usr/local/bin/k9s; \
    rm -rf "${archive}" checksums.sha256 k9s.checksum k9s

RUN set -eux; \
    . /etc/k8s-arch.env; \
    cd /tmp; \
    archive="kubens_${KUBENS_VERSION}_linux_${DEB_ARCH}.tar.gz"; \
    curl -fsSLO "https://github.com/ahmetb/kubectx/releases/download/${KUBENS_VERSION}/${archive}"; \
    curl -fsSLO "https://github.com/ahmetb/kubectx/releases/download/${KUBENS_VERSION}/checksums.txt"; \
    awk -v name="${archive}" '$2 == name' checksums.txt > kubens.checksum; \
    test "$(wc -l < kubens.checksum)" -eq 1; \
    sha256sum --check --strict kubens.checksum; \
    tar -xzf "${archive}" kubens; \
    install -m 0755 kubens /usr/local/bin/kubens; \
    rm -rf "${archive}" checksums.txt kubens.checksum kubens

# A terminal is the whole point of this workspace, and the Kasm base image only
# starts a bare XFCE session. Autostart one so the user lands in a shell.
# /etc/xdg/autostart is already where the base image registers its own session
# components, so XFCE picks this up. x-terminal-emulator resolves through the
# alternatives system, which keeps this correct whichever terminal the base
# image happens to ship.
#
# Terminal is left false on purpose: it means "run this inside a terminal", so
# setting it on a terminal emulator would nest one inside another.
RUN set -eux; \
    terminal=""; \
    for candidate in x-terminal-emulator xfce4-terminal xterm; do \
        if command -v "${candidate}" > /dev/null 2>&1; then \
            terminal="${candidate}"; \
            break; \
        fi; \
    done; \
    if [ -z "${terminal}" ]; then \
        echo "no terminal emulator in base image, this workspace needs one" >&2; \
        exit 1; \
    fi; \
    mkdir -p /etc/xdg/autostart; \
    printf '[Desktop Entry]\nType=Application\nName=Terminal\nComment=Kubernetes CLI\nExec=%s\nTerminal=false\n' \
        "${terminal}" > /etc/xdg/autostart/k8s-terminal.desktop; \
    chmod 0644 /etc/xdg/autostart/k8s-terminal.desktop

# kubectl creates this file on demand, but only if the directory is writable.
RUN mkdir -p /home/kasm-user/.kube && \
    chown -R kasm-user:kasm-user /home/kasm-user/.kube

USER kasm-user
WORKDIR /home/kasm-user

# Catch a binary that does not run on this arch/libc here, rather than in the
# user's session. kubens is only checked for executability: it refuses to do
# anything useful without a kubeconfig, so --help is not a reliable probe.
RUN kubectl version --client=true && \
    k9s version && \
    test -x /usr/local/bin/kubens
