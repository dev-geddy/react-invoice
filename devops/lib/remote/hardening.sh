#!/usr/bin/env bash
# @spec L2-DEVOPS-01
# Remote fragment: security hardening — key-only ssh, fail2ban, unattended
# security upgrades. One copy for both setup flavors.
# Env: none.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

# SSH hardening: key-only auth. Drop-in wins over sshd_config and cloud-init
# fragments (sshd_config.d is Include'd first). Validate before reload so a
# bad config never kills the running sshd (existing session survives anyway).
echo "--> ssh hardening (key-only auth)"
$SUDO tee /etc/ssh/sshd_config.d/99-backflip-hardening.conf >/dev/null <<'SSHD'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
X11Forwarding no
MaxAuthTries 4
SSHD
$SUDO sshd -t
$SUDO systemctl reload ssh

# fail2ban: ban IPs brute-forcing sshd. systemd backend — works without
# rsyslog/auth.log (minimal cloud images).
if command -v fail2ban-server >/dev/null 2>&1; then
  echo "--> fail2ban already installed, skipping"
else
  echo "--> installing fail2ban"
  $SUDO apt-get install -y fail2ban
fi
$SUDO tee /etc/fail2ban/jail.local >/dev/null <<'JAIL'
[sshd]
enabled = true
backend = systemd
maxretry = 5
bantime = 1h
findtime = 10m
JAIL
$SUDO systemctl enable --now fail2ban
$SUDO systemctl restart fail2ban

# Unattended security updates.
echo "--> unattended-upgrades"
$SUDO apt-get install -y unattended-upgrades
$SUDO tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT
$SUDO systemctl enable --now unattended-upgrades
