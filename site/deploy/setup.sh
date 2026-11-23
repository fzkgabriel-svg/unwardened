#!/usr/bin/env bash
# Tesseract Studio — installation automatique sur Ubuntu (Oracle Cloud Free Tier)
# Usage : bash setup.sh   (depuis le dossier où se trouve le site décompressé)
set -e
cd "$(dirname "$0")/.."   # remonte de deploy/ vers la racine du site

echo "==> Installation de Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null
sudo apt-get install -y nodejs unzip >/dev/null
node --version

echo "==> Pare-feu : ouverture du port 8080..."
sudo iptables -C INPUT -p tcp --dport 8080 -j ACCEPT 2>/dev/null || \
  sudo iptables -I INPUT 6 -p tcp --dport 8080 -j ACCEPT
sudo apt-get install -y iptables-persistent >/dev/null 2>&1 || true
sudo netfilter-persistent save >/dev/null 2>&1 || true
sudo ufw allow 8080/tcp >/dev/null 2>&1 || true

echo "==> Service systemd 'tesseract'..."
sudo tee /etc/systemd/system/tesseract.service >/dev/null <<'EOF'
[Unit]
Description=Tesseract Studio — site officiel
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/tesseract
ExecStart=/usr/bin/node server.js 8080
Restart=always
RestartSec=5
Environment=NODE_ENV=production
# === RENSEIGNEZ VOS IDENTIFIANTS ADMIN ICI ===
Environment=ADMIN_PSEUDO=CHANGE_ME
Environment=ADMIN_EMAIL=CHANGE_ME@example.com
Environment=ADMIN_PASS=CHANGE_ME

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable tesseract >/dev/null 2>&1 || true

echo ""
echo "============================================================"
echo "  INSTALLATION TERMINEE"
echo "============================================================"
echo ""
echo "DERNIERE ETAPE — vos identifiants admin :"
echo "  sudo nano /etc/systemd/system/tesseract.service"
echo "  -> remplacez les 3 lignes CHANGE_ME par vos valeurs"
echo "  -> Ctrl+O, Entree, Ctrl+X pour sauvegarder"
echo ""
echo "  Puis redemarrez :"
echo "  sudo systemctl restart tesseract"
echo ""
echo "  Test : http://$(curl -s ifconfig.me):8080"
echo ""
echo "  Logs : sudo journalctl -u tesseract -f"
echo "============================================================"
