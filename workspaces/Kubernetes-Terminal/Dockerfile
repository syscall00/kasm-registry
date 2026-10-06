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
ARG ARGOCD_VERSION=v3.5.3
ARG HELM_VERSION=v4.3.0

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

# The three upstreams do not agree on how to name an architecture, and only
# one of them is the odd one out:
#
#   kubectl  GOARCH-style : amd64, arm64
#   k9s      GOARCH-style : amd64, arm64
#   kubens   Debian-style : x86_64, arm64
#
# So there are two names to carry around, and DEB_ARCH must be used for kubens
# only. Pointing kubectl at DEB_ARCH builds fine on arm64 and fails only on
# amd64, with dl.k8s.io answering 404 and curl exiting 22.
RUN case "${TARGETARCH}" in \
        amd64) GO_ARCH=amd64; DEB_ARCH=x86_64 ;; \
        arm64) GO_ARCH=arm64; DEB_ARCH=arm64 ;; \
        *) echo "unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac && \
    printf 'GO_ARCH=%s\nDEB_ARCH=%s\n' "${GO_ARCH}" "${DEB_ARCH}" > /etc/k8s-arch.env

# The checksum files all use the "sha256  filename" layout, except dl.k8s.io which
# ships the bare hash and needs the name appended. Each step below also asserts
# that the filter matched exactly one line: sha256sum exits 0 on empty input, so
# a wrong architecture name would otherwise skip the check without failing.
#
# Every download echoes its URL and gets an explicit destination, because curl
# -f turns a 404 into a bare "exit code: 22" that says nothing about which URL
# or which status was at fault.
RUN set -eux; \
    . /etc/k8s-arch.env; \
    cd /tmp; \
    url="https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${GO_ARCH}/kubectl"; \
    echo "GET ${url}"; \
    curl -fsSL --retry 3 --retry-delay 5 -o kubectl "${url}"; \
    url="https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${GO_ARCH}/kubectl.sha256"; \
    echo "GET ${url}"; \
    curl -fsSL --retry 3 --retry-delay 5 -o kubectl.sha256 "${url}"; \
    printf '%s  kubectl\n' "$(cat kubectl.sha256)" > kubectl.checksum; \
    test "$(wc -l < kubectl.checksum)" -eq 1; \
    sha256sum --check --strict kubectl.checksum; \
    install -m 0755 kubectl /usr/local/bin/kubectl; \
    rm -f kubectl kubectl.sha256 kubectl.checksum

RUN set -eux; \
    . /etc/k8s-arch.env; \
    cd /tmp; \
    archive="k9s_Linux_${GO_ARCH}.tar.gz"; \
    url="https://github.com/derailed/k9s/releases/download/${K9S_VERSION}/${archive}"; \
    echo "GET ${url}"; \
    curl -fsSL --retry 3 --retry-delay 5 -o "${archive}" "${url}"; \
    curl -fsSL --retry 3 --retry-delay 5 -o checksums.sha256 \
        "https://github.com/derailed/k9s/releases/download/${K9S_VERSION}/checksums.sha256"; \
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
    url="https://github.com/ahmetb/kubectx/releases/download/${KUBENS_VERSION}/${archive}"; \
    echo "GET ${url}"; \
    curl -fsSL --retry 3 --retry-delay 5 -o "${archive}" "${url}"; \
    curl -fsSL --retry 3 --retry-delay 5 -o checksums.txt \
        "https://github.com/ahmetb/kubectx/releases/download/${KUBENS_VERSION}/checksums.txt"; \
    awk -v name="${archive}" '$2 == name' checksums.txt > kubens.checksum; \
    test "$(wc -l < kubens.checksum)" -eq 1; \
    sha256sum --check --strict kubens.checksum; \
    tar -xzf "${archive}" kubens; \
    install -m 0755 kubens /usr/local/bin/kubens; \
    rm -rf "${archive}" checksums.txt kubens.checksum kubens

# The Argo CD CLI, for reading Application state without leaving the workspace.
# Its releases are named by GOARCH like kubectl and k9s, so it takes GO_ARCH, and
# its checksums live in cli_checksums.txt in the same layout as the others.
#
# Budget for this one: the binary is 226 MB on arm64 and 238 MB on amd64, more
# than k9s, kubectl and kubens put together, because it embeds kubectl and
# helm. That is the price of the GitOps side of the workflow living in the
# workspace.
RUN set -eux; \
    . /etc/k8s-arch.env; \
    cd /tmp; \
    binary="argocd-linux-${GO_ARCH}"; \
    url="https://github.com/argoproj/argo-cd/releases/download/${ARGOCD_VERSION}/${binary}"; \
    echo "GET ${url}"; \
    curl -fsSL --retry 3 --retry-delay 5 -o "${binary}" "${url}"; \
    curl -fsSL --retry 3 --retry-delay 5 -o cli_checksums.txt \
        "https://github.com/argoproj/argo-cd/releases/download/${ARGOCD_VERSION}/cli_checksums.txt"; \
    awk -v name="${binary}" '$2 == name' cli_checksums.txt > argocd.checksum; \
    test "$(wc -l < argocd.checksum)" -eq 1; \
    sha256sum --check --strict argocd.checksum; \
    install -m 0755 "${binary}" /usr/local/bin/argocd; \
    rm -rf "${binary}" cli_checksums.txt argocd.checksum

# Helm, for working with charts from the terminal. Two things differ from the
# steps above:
#
# It comes from get.helm.sh, not the GitHub release. Helm's releases publish
# only GPG-signed .asc assets now and no plain tarballs, so the release URL
# 404s; get.helm.sh still serves the tarball with a per-file .sha256sum next
# to it, which is enough to keep the same verify-then-install shape.
#
# And the binary is not at the root of the tarball. It sits in
# linux-<arch>/helm, so extracting a member called "helm" fails with
# "not found in archive". GO_ARCH names both the archive and that directory.
RUN set -eux; \
    . /etc/k8s-arch.env; \
    cd /tmp; \
    archive="helm-${HELM_VERSION}-linux-${GO_ARCH}.tar.gz"; \
    url="https://get.helm.sh/${archive}"; \
    echo "GET ${url}"; \
    curl -fsSL --retry 3 --retry-delay 5 -o "${archive}" "${url}"; \
    curl -fsSL --retry 3 --retry-delay 5 -o helm.sha256sum "${url}.sha256sum"; \
    awk -v name="${archive}" '$2 == name' helm.sha256sum > helm.checksum; \
    test "$(wc -l < helm.checksum)" -eq 1; \
    sha256sum --check --strict helm.checksum; \
    member="linux-${GO_ARCH}/helm"; \
    tar -xzf "${archive}" "${member}"; \
    install -m 0755 "${member}" /usr/local/bin/helm; \
    rm -rf "${archive}" helm.sha256sum helm.checksum "linux-${GO_ARCH}"

# Terminal-only session, the way kasmweb/terminal builds it.
#
# Removing the XFCE panel is what actually gets rid of the desktop: the session
# tries to start xfce4-panel, the binary is gone, and it carries on without it.
# dpkg --purge rather than deleting files by hand, so the package database
# stays consistent; --force-depends is needed because xfce4 depends on the
# panel. The window manager (xfwm4) stays, which is what makes the maximized
# terminal below work. Costs about 8 MB.
#
# The presence test asks for the status field rather than using "dpkg-query -W",
# which also exits 0 for a package that is not installed and so would enter the
# purge branch every time. The purge itself is idempotent, but then the message
# in the else branch could never be true.
RUN set -eux; \
    if [ "$(dpkg-query -W -f='${db:Status-Status}' xfce4-panel 2>/dev/null)" = "installed" ]; then \
        dpkg --purge --force-depends xfce4-panel; \
    else \
        echo "xfce4-panel not installed, panel already absent"; \
    fi; \
    rm -rf /var/lib/apt/lists/*

# vnc_startup.sh runs /dockerstartup/custom_startup.sh in the background once
# the session is up, and restarts it if it ever exits, so this has to be a loop
# that never returns. It is also the target of the registry's exec_config.
# Everything it does is open one terminal that fills the screen, and reopen it
# if the user closes it.
#
# --maximize rather than --fullscreen on purpose: a real fullscreen terminal
# swallows the title bar, so there is no way back out of it with the mouse,
# while a maximized one with no borders and no menubar looks identical and can
# still be un-maximized.
RUN cat <<'EOF' > /dockerstartup/custom_startup.sh
#!/usr/bin/env bash
set -e

TERMINAL_ARGS=(--maximize --hide-borders --hide-menubar --hide-scrollbar)

# Kasm's "go" and "assign" actions exec into the container with --go/--assign.
# By then the session is already up and the loop below owns the terminal, so
# there is nothing to start and starting one would just pile up windows.
case "${1:-}" in
    --go|--assign)
        exit 0
        ;;
esac

while true; do
    if pgrep -x xfce4-terminal > /dev/null 2>&1; then
        sleep 1
        continue
    fi

    # Both are Kasm's own readiness signals: the first filters input until the
    # session is usable, the second marks the desktop ready. Neither is allowed
    # to kill the loop. Under "set -e" a non-zero from either would abort the
    # script and leave the user with no terminal at all, and "filter_ready"
    # does exit non-zero when its filter is not configured.
    /usr/bin/filter_ready || true
    /usr/bin/desktop_ready || true

    cd "${HOME:-/home/kasm-user}"
    # Foreground, so this loop only comes back around once the terminal is
    # actually gone rather than guessing with a race.
    xfce4-terminal "${TERMINAL_ARGS[@]}" || true
    sleep 1
done
EOF

RUN chmod 0755 /dockerstartup/custom_startup.sh

# kubectl creates this file on demand, but only if the directory is writable.
RUN mkdir -p /home/kasm-user/.kube && \
    chown -R kasm-user:kasm-user /home/kasm-user/.kube

USER kasm-user
WORKDIR /home/kasm-user

# Catch a binary that does not run on this arch/libc here, rather than in the
# user's session. kubens is only checked for executability: it refuses to do
# anything useful without a kubeconfig, so --help is not a reliable probe.
# argocd has a --client form that needs no server. Helm 4 dropped --client
# entirely, and plain "helm version" is already cluster-free and exits 0.
RUN kubectl version --client=true && \
    k9s version && \
    argocd version --client && \
    helm version --short && \
    test -x /usr/local/bin/kubens
